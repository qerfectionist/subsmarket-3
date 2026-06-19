from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from subsmarket.core.config import settings
from subsmarket.core.database import utcnow
from subsmarket.families.models import (
    Family,
    FamilyMember,
    FamilyPayment,
    FamilyRequest,
)
from subsmarket.jobs.schemas import (
    DueBacklogStatus,
    JobsStatusResult,
    NotificationFailureSample,
    NotificationQueueStatus,
)
from subsmarket.notifications.models import NotificationJob

STALE_NOTIFICATION_AFTER = timedelta(minutes=15)
RECENT_FAILURE_WINDOW = timedelta(hours=24)


def get_jobs_status(db: Session) -> JobsStatusResult:
    now = utcnow()
    today = date.today()
    notification_queue = _notification_queue_status(db, now=now)
    due_backlog = _due_backlog_status(db, now=now, today=today)
    warnings = _status_warnings(notification_queue, due_backlog)
    return JobsStatusResult(
        status="attention" if warnings else "ok",
        checked_at=now,
        warnings=warnings,
        notification_queue=notification_queue,
        due_backlog=due_backlog,
        recent_notification_failures=_recent_notification_failures(db),
    )


def _notification_queue_status(
    db: Session,
    *,
    now,
) -> NotificationQueueStatus:
    raw_counts = dict(
        db.execute(
            select(NotificationJob.status, func.count(NotificationJob.id)).group_by(
                NotificationJob.status
            )
        ).all()
    )
    stale_cutoff = now - STALE_NOTIFICATION_AFTER
    pending_due = _count(
        db,
        select(NotificationJob.id)
        .where(NotificationJob.status == "pending")
        .where(NotificationJob.available_at <= now),
    )
    stale_due = _count(
        db,
        select(NotificationJob.id)
        .where(NotificationJob.status == "pending")
        .where(NotificationJob.available_at <= stale_cutoff),
    )
    failed_last_24h = _count(
        db,
        select(NotificationJob.id)
        .where(NotificationJob.status == "failed")
        .where(NotificationJob.failed_at >= now - RECENT_FAILURE_WINDOW),
    )
    return NotificationQueueStatus(
        pending_total=int(raw_counts.get("pending", 0)),
        pending_due=pending_due,
        pending_future=_count(
            db,
            select(NotificationJob.id)
            .where(NotificationJob.status == "pending")
            .where(NotificationJob.available_at > now),
        ),
        sent_total=int(raw_counts.get("sent", 0)),
        failed_total=int(raw_counts.get("failed", 0)),
        cancelled_total=int(raw_counts.get("cancelled", 0)),
        stale_due=stale_due,
        failed_last_24h=failed_last_24h,
        oldest_due_at=db.scalar(
            select(func.min(NotificationJob.available_at))
            .where(NotificationJob.status == "pending")
            .where(NotificationJob.available_at <= now)
        ),
        oldest_pending_at=db.scalar(
            select(func.min(NotificationJob.available_at)).where(
                NotificationJob.status == "pending"
            )
        ),
        dispatch_capacity_per_run=(
            settings.notification_dispatch_batch_size
            * settings.notification_dispatch_max_batches
        ),
    )


def _due_backlog_status(
    db: Session,
    *,
    now,
    today: date,
) -> DueBacklogStatus:
    per_step_capacity = settings.job_batch_size * settings.job_max_batches_per_step
    return DueBacklogStatus(
        expired_family_requests=_count(
            db,
            select(FamilyRequest.id)
            .where(FamilyRequest.status == "pending")
            .where(FamilyRequest.expires_at <= now),
        ),
        access_confirmations_overdue=_count(
            db,
            select(FamilyMember.id)
            .where(FamilyMember.status == "awaiting_confirmation")
            .where(FamilyMember.access_provided_at <= now - timedelta(hours=24)),
        ),
        first_payments_overdue=_count(
            db,
            select(FamilyPayment.id)
            .where(FamilyPayment.kind == "first")
            .where(FamilyPayment.status == "due")
            .where(FamilyPayment.due_at <= now),
        ),
        regular_payment_creation_due=_count(
            db,
            select(Family.id)
            .where(Family.status.in_({"active", "full"}))
            .where(
                or_(
                    and_(
                        Family.period == "monthly",
                        Family.next_payment_date <= today + timedelta(days=3),
                    ),
                    and_(
                        Family.period == "yearly",
                        Family.next_payment_date <= today + timedelta(days=30),
                    ),
                )
            ),
        ),
        regular_payments_to_activate=_count(
            db,
            select(FamilyPayment.id)
            .where(FamilyPayment.kind == "regular")
            .where(FamilyPayment.status == "scheduled")
            .where(FamilyPayment.due_at <= now)
            .where(FamilyPayment.due_at > now - timedelta(hours=24)),
        ),
        regular_payments_overdue=_count(
            db,
            select(FamilyPayment.id)
            .where(FamilyPayment.kind == "regular")
            .where(FamilyPayment.status.in_({"scheduled", "due"}))
            .where(FamilyPayment.due_at <= now - timedelta(hours=24)),
        ),
        owner_payment_confirmations_waiting=_count(
            db,
            select(FamilyPayment.id)
            .where(FamilyPayment.status == "payment_reported")
            .where(FamilyPayment.reported_paid_at <= now - timedelta(minutes=10)),
        ),
        closing_acknowledgements_due=_count(
            db,
            select(FamilyMember.id)
            .join(Family, Family.id == FamilyMember.family_id)
            .where(Family.status == "closing")
            .where(Family.closes_at > now)
            .where(Family.closing_started_at <= now - timedelta(days=1))
            .where(FamilyMember.role == "member")
            .where(
                FamilyMember.status.in_(
                    {
                        "awaiting_access",
                        "awaiting_confirmation",
                        "payment_due",
                        "active",
                        "removal_pending",
                    }
                )
            )
            .where(FamilyMember.closing_acknowledged_at.is_(None)),
        ),
        member_removals_due=_count(
            db,
            select(FamilyMember.id)
            .where(FamilyMember.status == "removal_pending")
            .where(FamilyMember.removal_scheduled_at <= now),
        ),
        family_closures_due=_count(
            db,
            select(Family.id)
            .where(Family.status == "closing")
            .where(Family.closes_at <= now),
        ),
        per_step_capacity=per_step_capacity,
    )


def _recent_notification_failures(db: Session) -> list[NotificationFailureSample]:
    jobs = list(
        db.scalars(
            select(NotificationJob)
            .where(NotificationJob.status == "failed")
            .order_by(
                NotificationJob.failed_at.desc(),
                NotificationJob.updated_at.desc(),
            )
            .limit(10)
        ).all()
    )
    return [
        NotificationFailureSample(
            id=str(job.id),
            event_type=job.event_type,
            attempts=job.attempts,
            failed_at=job.failed_at,
            error=job.error[:300] if job.error else None,
        )
        for job in jobs
    ]


def _status_warnings(
    notification_queue: NotificationQueueStatus,
    due_backlog: DueBacklogStatus,
) -> list[str]:
    warnings: list[str] = []
    if notification_queue.failed_last_24h:
        warnings.append("notification_failures_last_24h")
    if notification_queue.stale_due:
        warnings.append("stale_due_notifications")
    if (
        notification_queue.pending_due
        > notification_queue.dispatch_capacity_per_run
    ):
        warnings.append("notification_due_backlog_exceeds_dispatch_capacity")
    for field_name in (
        "expired_family_requests",
        "access_confirmations_overdue",
        "first_payments_overdue",
        "regular_payment_creation_due",
        "regular_payments_to_activate",
        "regular_payments_overdue",
        "owner_payment_confirmations_waiting",
        "closing_acknowledgements_due",
        "member_removals_due",
        "family_closures_due",
    ):
        if getattr(due_backlog, field_name) > due_backlog.per_step_capacity:
            warnings.append(f"{field_name}_exceeds_due_job_capacity")
    return warnings


def _count(db: Session, statement) -> int:
    return int(db.scalar(select(func.count()).select_from(statement.subquery())) or 0)
