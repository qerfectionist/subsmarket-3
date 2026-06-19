from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, date, timedelta
from uuid import UUID

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session, joinedload

from subsmarket.core.config import settings
from subsmarket.core.database import utcnow
from subsmarket.families.audit import record_family_audit_event
from subsmarket.families.calendar import add_payment_period, payment_due_at
from subsmarket.families.models import (
    Family,
    FamilyMember,
    FamilyPayment,
    FamilyRequest,
)
from subsmarket.families.service import cancel_scheduled_payments
from subsmarket.jobs.schemas import RunDueJobError, RunDueJobsResult
from subsmarket.notifications.models import NotificationJob
from subsmarket.notifications.service import enqueue_notification

REGULAR_PAYMENT_MEMBER_STATUSES = {"active"}
OPEN_PAYMENT_STATUSES = {"due", "overdue", "payment_reported"}
CLOSING_ACK_MEMBER_STATUSES = {
    "awaiting_access",
    "awaiting_confirmation",
    "payment_due",
    "active",
    "removal_pending",
}
logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class DueJobStep:
    name: str
    run: Callable[[Session], int | tuple[int, int]]
    apply: Callable[[RunDueJobsResult, int | tuple[int, int]], None]
    drain_batches: bool = False


def run_due_jobs(db: Session) -> RunDueJobsResult:
    logger.info("Due job run started")
    result = RunDueJobsResult(
        expired_family_requests=0,
        access_confirmation_reminders_sent=0,
        overdue_first_payments=0,
        created_regular_payments=0,
        activated_regular_payments=0,
        overdue_regular_payments=0,
        regular_payment_reminders_sent=0,
        owner_payment_confirmation_reminders_sent=0,
        closing_acknowledgement_reminders_sent=0,
        executed_member_removals=0,
        closed_families=0,
        notification_jobs_created=0,
    )
    for step in _due_job_steps():
        _run_due_job_step(db, result, step)
    logger.info(
        "Due job run completed",
        extra={
            "expired_family_requests": result.expired_family_requests,
            "overdue_first_payments": result.overdue_first_payments,
            "created_regular_payments": result.created_regular_payments,
            "notification_jobs_created": result.notification_jobs_created,
            "job_errors": len(result.job_errors),
        },
    )
    return result


def _run_due_job_step(
    db: Session,
    result: RunDueJobsResult,
    step: DueJobStep,
) -> None:
    max_batches = settings.job_max_batches_per_step if step.drain_batches else 1
    for batch_number in range(1, max_batches + 1):
        try:
            step_result = step.run(db)
            db.commit()
        except Exception as exc:
            db.rollback()
            logger.exception(
                "Due job step failed",
                extra={"job_step": step.name, "job_batch": batch_number},
            )
            result.job_errors.append(
                RunDueJobError(
                    step=step.name,
                    error_type=type(exc).__name__,
                    message=str(exc),
                )
            )
            return
        step.apply(result, step_result)
        processed_count = _step_processed_count(step_result)
        logger.info(
            "Due job step batch completed",
            extra={
                "job_step": step.name,
                "job_batch": batch_number,
                "job_step_result": str(step_result),
            },
        )
        if not step.drain_batches or processed_count < settings.job_batch_size:
            break


def _step_processed_count(step_result: int | tuple[int, int]) -> int:
    return step_result if isinstance(step_result, int) else step_result[0]


def _job_scan_limit() -> int:
    return settings.job_batch_size * settings.job_max_batches_per_step


def _due_job_steps() -> tuple[DueJobStep, ...]:
    return (
        DueJobStep(
            name="expire_family_requests",
            run=expire_family_requests,
            apply=lambda result, step_result: _apply_count_and_notifications(
                result,
                step_result,
                count_field="expired_family_requests",
            ),
            drain_batches=True,
        ),
        DueJobStep(
            name="send_access_confirmation_reminders",
            run=send_access_confirmation_reminders,
            apply=lambda result, step_result: _apply_notification_count(
                result,
                step_result,
                count_field="access_confirmation_reminders_sent",
            ),
        ),
        DueJobStep(
            name="mark_overdue_first_payments",
            run=mark_overdue_first_payments,
            apply=lambda result, step_result: _apply_count_and_notifications(
                result,
                step_result,
                count_field="overdue_first_payments",
            ),
            drain_batches=True,
        ),
        DueJobStep(
            name="create_regular_payments",
            run=create_regular_payments,
            apply=lambda result, step_result: _apply_count(
                result,
                step_result,
                count_field="created_regular_payments",
            ),
        ),
        DueJobStep(
            name="activate_regular_payments",
            run=activate_regular_payments,
            apply=lambda result, step_result: _apply_count_and_notifications(
                result,
                step_result,
                count_field="activated_regular_payments",
            ),
            drain_batches=True,
        ),
        DueJobStep(
            name="mark_overdue_regular_payments",
            run=mark_overdue_regular_payments,
            apply=lambda result, step_result: _apply_count_and_notifications(
                result,
                step_result,
                count_field="overdue_regular_payments",
            ),
            drain_batches=True,
        ),
        DueJobStep(
            name="send_regular_payment_reminders",
            run=send_regular_payment_reminders,
            apply=lambda result, step_result: _apply_notification_count(
                result,
                step_result,
                count_field="regular_payment_reminders_sent",
            ),
        ),
        DueJobStep(
            name="send_owner_payment_confirmation_reminders",
            run=send_owner_payment_confirmation_reminders,
            apply=lambda result, step_result: _apply_notification_count(
                result,
                step_result,
                count_field="owner_payment_confirmation_reminders_sent",
            ),
        ),
        DueJobStep(
            name="send_closing_acknowledgement_reminders",
            run=send_closing_acknowledgement_reminders,
            apply=lambda result, step_result: _apply_notification_count(
                result,
                step_result,
                count_field="closing_acknowledgement_reminders_sent",
            ),
        ),
        DueJobStep(
            name="execute_member_removals",
            run=execute_member_removals,
            apply=lambda result, step_result: _apply_count_and_notifications(
                result,
                step_result,
                count_field="executed_member_removals",
            ),
            drain_batches=True,
        ),
        DueJobStep(
            name="close_due_families",
            run=close_due_families,
            apply=lambda result, step_result: _apply_count_and_notifications(
                result,
                step_result,
                count_field="closed_families",
            ),
            drain_batches=True,
        ),
    )


def _apply_count(
    result: RunDueJobsResult,
    step_result: int | tuple[int, int],
    *,
    count_field: str,
) -> None:
    if not isinstance(step_result, int):
        raise TypeError(f"{count_field} expected integer result")
    setattr(result, count_field, getattr(result, count_field) + step_result)


def _apply_notification_count(
    result: RunDueJobsResult,
    step_result: int | tuple[int, int],
    *,
    count_field: str,
) -> None:
    if not isinstance(step_result, int):
        raise TypeError(f"{count_field} expected integer result")
    setattr(result, count_field, getattr(result, count_field) + step_result)
    result.notification_jobs_created += step_result


def _apply_count_and_notifications(
    result: RunDueJobsResult,
    step_result: int | tuple[int, int],
    *,
    count_field: str,
) -> None:
    if not isinstance(step_result, tuple):
        raise TypeError(f"{count_field} expected count and notifications")
    count, notifications = step_result
    setattr(result, count_field, getattr(result, count_field) + count)
    result.notification_jobs_created += notifications


def expire_family_requests(db: Session) -> tuple[int, int]:
    now = utcnow()
    requests = list(
        db.scalars(
            select(FamilyRequest)
            .options(joinedload(FamilyRequest.family))
            .where(FamilyRequest.status == "pending")
            .where(FamilyRequest.expires_at <= now)
            .order_by(FamilyRequest.expires_at.asc())
            .limit(settings.job_batch_size)
            .with_for_update(skip_locked=True)
        ).all()
    )

    notification_count = 0
    for request in requests:
        old_status = request.status
        request.status = "expired"
        request.expired_at = now
        family = request.family
        record_family_audit_event(
            db,
            family_id=request.family_id,
            action="family_request_expired",
            target_user_id=request.user_id,
            target_request_id=request.id,
            old_status=old_status,
            new_status=request.status,
            details={"expired_at": request.expired_at.isoformat()},
        )
        enqueue_notification(
            db,
            recipient_user_id=request.user_id,
            event_type="family_request_expired_candidate",
            payload={
                "family_id": str(request.family_id),
                "request_id": str(request.id),
                "message": "Заявка истекла. Владелец не ответил за 24 часа.",
            },
        )
        notification_count += 1
        enqueue_notification(
            db,
            recipient_user_id=family.owner_user_id,
            event_type="family_request_expired_owner",
            payload={
                "family_id": str(request.family_id),
                "request_id": str(request.id),
                "message": "Заявка закрылась из-за молчания.",
            },
        )
        notification_count += 1

    return len(requests), notification_count


def send_access_confirmation_reminders(db: Session) -> int:
    now = utcnow()
    members = list(
        db.scalars(
            select(FamilyMember)
            .options(joinedload(FamilyMember.family))
            .where(FamilyMember.status == "awaiting_confirmation")
            .where(FamilyMember.access_provided_at <= now - timedelta(hours=24))
            .order_by(FamilyMember.access_provided_at.asc())
            .limit(_job_scan_limit())
            .with_for_update(skip_locked=True)
        ).all()
    )

    notification_count = 0
    for member in members:
        family = member.family
        member_notification_created = _enqueue_member_notification_once(
            db,
            member=member,
            recipient_user_id=member.user_id,
            event_type="access_confirmation_overdue_member",
            message=(
                "Доступ выдан больше суток назад. Проверьте его и подтвердите "
                "получение в SubsMarket."
            ),
        )
        owner_notification_created = _enqueue_member_notification_once(
            db,
            member=member,
            recipient_user_id=family.owner_user_id,
            event_type="access_confirmation_overdue_owner",
            message=(
                "Участник не подтвердил получение доступа за 24 часа. "
                "Место остается занятым; вы можете напомнить еще раз."
            ),
        )
        created = member_notification_created + owner_notification_created
        if created:
            record_family_audit_event(
                db,
                family_id=family.id,
                action="family_access_confirmation_overdue_reminded",
                target_user_id=member.user_id,
                target_member_id=member.id,
                details={
                    "access_provided_at": member.access_provided_at.isoformat(),
                    "reminded_at": now.isoformat(),
                },
            )
            notification_count += created

    if notification_count:
        db.flush()
    return notification_count


def mark_overdue_first_payments(db: Session) -> tuple[int, int]:
    now = utcnow()
    payments = list(
        db.scalars(
            select(FamilyPayment)
            .options(
                joinedload(FamilyPayment.family),
                joinedload(FamilyPayment.member),
            )
            .where(FamilyPayment.kind == "first")
            .where(FamilyPayment.status == "due")
            .where(FamilyPayment.due_at <= now)
            .order_by(FamilyPayment.due_at.asc())
            .limit(settings.job_batch_size)
            .with_for_update(skip_locked=True)
        ).all()
    )

    notification_count = 0
    for payment in payments:
        old_status = payment.status
        payment.status = "overdue"
        payment.overdue_at = now
        member = payment.member
        family = payment.family
        record_family_audit_event(
            db,
            family_id=payment.family_id,
            action="first_payment_overdue",
            target_user_id=member.user_id,
            target_member_id=member.id,
            target_payment_id=payment.id,
            old_status=old_status,
            new_status=payment.status,
            details={"overdue_at": payment.overdue_at.isoformat()},
        )
        enqueue_notification(
            db,
            recipient_user_id=member.user_id,
            event_type="first_payment_overdue_member",
            payload={
                "family_id": str(payment.family_id),
                "member_id": str(payment.member_id),
                "payment_id": str(payment.id),
                "message": (
                    "Время на первый платеж истекло. Если вы уже оплатили, "
                    "нажмите \"Оплатил\". Если нет - оплатите или напишите владельцу."
                ),
            },
        )
        notification_count += 1
        enqueue_notification(
            db,
            recipient_user_id=family.owner_user_id,
            event_type="first_payment_overdue_owner",
            payload={
                "family_id": str(payment.family_id),
                "member_id": str(payment.member_id),
                "payment_id": str(payment.id),
                "message": "Участник не подтвердил первый платеж за 30 минут.",
            },
        )
        notification_count += 1

    return len(payments), notification_count


def create_regular_payments(db: Session) -> int:
    today = date.today()
    families = list(
        db.scalars(
            select(Family)
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
            )
            .order_by(Family.next_payment_date.asc())
            .limit(settings.job_batch_size)
            .with_for_update(skip_locked=True)
        ).all()
    )

    created_count = 0
    for family in families:
        period_start = family.next_payment_date
        period_end = add_payment_period(period_start, family.period)

        members = list(
            db.scalars(
                select(FamilyMember)
                .where(FamilyMember.family_id == family.id)
                .where(FamilyMember.role == "member")
                .where(FamilyMember.status.in_(REGULAR_PAYMENT_MEMBER_STATUSES))
            ).all()
        )
        if not members:
            family.next_payment_date = period_end
            continue

        due_at = payment_due_at(period_start)
        family_created_count = 0
        covered_member_count = 0
        for member in members:
            if _regular_payment_exists(
                db,
                member_id=member.id,
                period_start=period_start,
                period_end=period_end,
            ):
                covered_member_count += 1
                continue
            payment = FamilyPayment(
                family_id=family.id,
                member_id=member.id,
                kind="regular",
                status="scheduled",
                amount_kzt=family.member_share_kzt,
                period=family.period,
                period_start=period_start,
                period_end=period_end,
                due_at=due_at,
            )
            db.add(payment)
            db.flush()
            record_family_audit_event(
                db,
                family_id=family.id,
                action="regular_payment_created",
                target_user_id=member.user_id,
                target_member_id=member.id,
                target_payment_id=payment.id,
                new_status=payment.status,
                details={
                    "amount_kzt": payment.amount_kzt,
                    "period": payment.period,
                    "period_start": payment.period_start.isoformat(),
                    "period_end": payment.period_end.isoformat(),
                    "due_at": payment.due_at.isoformat(),
                },
            )
            family_created_count += 1
            covered_member_count += 1

        created_count += family_created_count
        if covered_member_count == len(members):
            family.next_payment_date = period_end

    return created_count


def activate_regular_payments(db: Session) -> tuple[int, int]:
    now = utcnow()
    payments = list(
        db.scalars(
            select(FamilyPayment)
            .options(joinedload(FamilyPayment.member))
            .where(FamilyPayment.kind == "regular")
            .where(FamilyPayment.status == "scheduled")
            .where(FamilyPayment.due_at <= now)
            .where(FamilyPayment.due_at > now - timedelta(hours=24))
            .order_by(FamilyPayment.due_at.asc())
            .limit(settings.job_batch_size)
            .with_for_update(skip_locked=True)
        ).all()
    )

    notification_count = 0
    for payment in payments:
        member = payment.member
        old_payment_status = payment.status
        old_member_status = member.status
        payment.status = "due"
        payment.requisites_opened_at = now
        if member.status == "active":
            member.status = "payment_due"
        record_family_audit_event(
            db,
            family_id=payment.family_id,
            action="regular_payment_due",
            target_user_id=member.user_id,
            target_member_id=member.id,
            target_payment_id=payment.id,
            old_status=old_payment_status,
            new_status=payment.status,
            details={
                "old_member_status": old_member_status,
                "new_member_status": member.status,
                "requisites_opened_at": payment.requisites_opened_at.isoformat(),
            },
        )
        enqueue_notification(
            db,
            recipient_user_id=member.user_id,
            event_type="regular_payment_due_member",
            payload={
                "family_id": str(payment.family_id),
                "member_id": str(payment.member_id),
                "payment_id": str(payment.id),
                "message": (
                    "Сегодня день оплаты семьи. "
                    "Оплатите владельцу и нажмите «Оплатил»."
                ),
            },
        )
        notification_count += 1

    return len(payments), notification_count


def mark_overdue_regular_payments(db: Session) -> tuple[int, int]:
    now = utcnow()
    payments = list(
        db.scalars(
            select(FamilyPayment)
            .options(
                joinedload(FamilyPayment.family),
                joinedload(FamilyPayment.member),
            )
            .where(FamilyPayment.kind == "regular")
            .where(FamilyPayment.status.in_({"scheduled", "due"}))
            .where(FamilyPayment.due_at <= now - timedelta(hours=24))
            .order_by(FamilyPayment.due_at.asc())
            .limit(settings.job_batch_size)
            .with_for_update(skip_locked=True)
        ).all()
    )

    notification_count = 0
    for payment in payments:
        member = payment.member
        family = payment.family
        old_payment_status = payment.status
        old_member_status = member.status
        payment.status = "overdue"
        payment.overdue_at = now
        payment.requisites_opened_at = payment.requisites_opened_at or now
        if member.status == "active":
            member.status = "payment_due"
        record_family_audit_event(
            db,
            family_id=payment.family_id,
            action="regular_payment_overdue",
            target_user_id=member.user_id,
            target_member_id=member.id,
            target_payment_id=payment.id,
            old_status=old_payment_status,
            new_status=payment.status,
            details={
                "old_member_status": old_member_status,
                "new_member_status": member.status,
                "overdue_at": payment.overdue_at.isoformat(),
            },
        )
        enqueue_notification(
            db,
            recipient_user_id=member.user_id,
            event_type="regular_payment_overdue_member",
            payload={
                "family_id": str(payment.family_id),
                "member_id": str(payment.member_id),
                "payment_id": str(payment.id),
                "message": "Платеж просрочен. Если уже оплатили, нажмите «Оплатил».",
            },
        )
        notification_count += 1
        enqueue_notification(
            db,
            recipient_user_id=family.owner_user_id,
            event_type="regular_payment_overdue_owner",
            payload={
                "family_id": str(payment.family_id),
                "member_id": str(payment.member_id),
                "payment_id": str(payment.id),
                "message": "Участник не отметил регулярный платеж в течение 24 часов.",
            },
        )
        notification_count += 1

    return len(payments), notification_count


def send_regular_payment_reminders(db: Session) -> int:
    today = date.today()
    scheduled_payments = list(
        db.scalars(
            select(FamilyPayment)
            .join(Family, Family.id == FamilyPayment.family_id)
            .join(FamilyMember, FamilyMember.id == FamilyPayment.member_id)
            .options(
                joinedload(FamilyPayment.family),
                joinedload(FamilyPayment.member),
            )
            .where(FamilyPayment.kind == "regular")
            .where(FamilyPayment.status == "scheduled")
            .where(Family.status.in_({"active", "full"}))
            .where(FamilyMember.status.in_(REGULAR_PAYMENT_MEMBER_STATUSES))
            .order_by(FamilyPayment.due_at.asc())
            .limit(_job_scan_limit())
            .with_for_update(skip_locked=True)
        ).all()
    )

    notification_count = 0
    for payment in scheduled_payments:
        days_until_due = (payment.period_start - today).days
        if payment.period == "yearly" and 3 < days_until_due <= 30:
            notification_count += _enqueue_payment_notification_once(
                db,
                payment=payment,
                recipient_user_id=payment.member.user_id,
                event_type="regular_payment_reminder_30d_member",
                message=(
                    "Через месяц годовая оплата семьи. "
                    "Подготовьте сумму заранее."
                ),
            )
        if 0 < days_until_due <= 3:
            notification_count += _enqueue_payment_notification_once(
                db,
                payment=payment,
                recipient_user_id=payment.member.user_id,
                event_type="regular_payment_reminder_3d_member",
                message=(
                    "Через 3 дня оплата семьи. "
                    "В день оплаты нажмите «Оплатил» после перевода."
                ),
            )

    open_payments = list(
        db.scalars(
            select(FamilyPayment)
            .join(Family, Family.id == FamilyPayment.family_id)
            .join(FamilyMember, FamilyMember.id == FamilyPayment.member_id)
            .options(
                joinedload(FamilyPayment.family),
                joinedload(FamilyPayment.member),
            )
            .where(FamilyPayment.kind == "regular")
            .where(FamilyPayment.status.in_({"due", "overdue"}))
            .where(Family.status.in_({"active", "full", "closing"}))
            .where(
                FamilyMember.status.in_(
                    {"payment_due", "active", "removal_pending"}
                )
            )
            .order_by(FamilyPayment.due_at.asc())
            .limit(_job_scan_limit())
            .with_for_update(skip_locked=True)
        ).all()
    )
    for payment in open_payments:
        days_late = (today - payment.period_start).days
        if days_late < 2:
            continue
        notification_count += _enqueue_payment_notification_once(
            db,
            payment=payment,
            recipient_user_id=payment.member.user_id,
            event_type="regular_payment_daily_reminder_member",
            message="Напоминание: регулярный платеж еще не подтвержден.",
            reminder_date=today,
        )

    return notification_count


def send_owner_payment_confirmation_reminders(db: Session) -> int:
    now = utcnow()
    payments = list(
        db.scalars(
            select(FamilyPayment)
            .options(joinedload(FamilyPayment.family))
            .where(FamilyPayment.status == "payment_reported")
            .where(FamilyPayment.reported_paid_at.is_not(None))
            .order_by(FamilyPayment.reported_paid_at.asc())
            .limit(_job_scan_limit())
            .with_for_update(skip_locked=True)
        ).all()
    )

    notification_count = 0
    for payment in payments:
        reported_paid_at = payment.reported_paid_at
        if reported_paid_at is None:
            continue
        if reported_paid_at.tzinfo is None:
            reported_paid_at = reported_paid_at.replace(tzinfo=UTC)
        elapsed = now - reported_paid_at
        if elapsed >= timedelta(days=1):
            notification_count += _enqueue_payment_notification_once(
                db,
                payment=payment,
                recipient_user_id=payment.family.owner_user_id,
                event_type="payment_confirmation_daily_reminder_owner",
                message=(
                    "Напоминание: участник отметил оплату, но вы еще не "
                    "подтвердили получение."
                ),
                reminder_date=now.date(),
            )
            continue

        for minutes in (10, 20, 40):
            if elapsed < timedelta(minutes=minutes):
                continue
            created = _enqueue_payment_notification_once(
                db,
                payment=payment,
                recipient_user_id=payment.family.owner_user_id,
                event_type=f"payment_confirmation_reminder_{minutes}m_owner",
                message=(
                    "Участник отметил оплату. Проверьте перевод и подтвердите "
                    "получение в SubsMarket."
                ),
            )
            notification_count += created
            if created:
                break

    if notification_count:
        db.flush()
    return notification_count


def send_closing_acknowledgement_reminders(db: Session) -> int:
    now = utcnow()
    today = now.date()
    members = list(
        db.scalars(
            select(FamilyMember)
            .join(Family, Family.id == FamilyMember.family_id)
            .options(joinedload(FamilyMember.family))
            .where(Family.status == "closing")
            .where(Family.closes_at > now)
            .where(Family.closing_started_at <= now - timedelta(days=1))
            .where(FamilyMember.role == "member")
            .where(FamilyMember.status.in_(CLOSING_ACK_MEMBER_STATUSES))
            .where(FamilyMember.closing_acknowledged_at.is_(None))
            .order_by(Family.closes_at.asc(), FamilyMember.created_at.asc())
            .limit(_job_scan_limit())
            .with_for_update(skip_locked=True)
        ).all()
    )

    notification_count = 0
    for member in members:
        existing_jobs = list(
            db.scalars(
                select(NotificationJob)
                .where(NotificationJob.recipient_user_id == member.user_id)
                .where(
                    NotificationJob.event_type
                    == "family_closing_ack_reminder_member"
                )
            ).all()
        )
        if any(
            job.payload.get("family_id") == str(member.family_id)
            and job.payload.get("reminder_date") == today.isoformat()
            for job in existing_jobs
        ):
            continue
        enqueue_notification(
            db,
            recipient_user_id=member.user_id,
            event_type="family_closing_ack_reminder_member",
            payload={
                "family_id": str(member.family_id),
                "member_id": str(member.id),
                "reminder_date": today.isoformat(),
                "message": (
                    "Напоминание: семья закрывается. Подтвердите, что увидели "
                    "предупреждение."
                ),
            },
        )
        notification_count += 1

    if notification_count:
        db.flush()
    return notification_count


def _regular_payment_exists(
    db: Session,
    *,
    member_id: UUID,
    period_start: date,
    period_end: date,
) -> bool:
    payment = db.scalar(
        select(FamilyPayment.id)
        .where(FamilyPayment.member_id == member_id)
        .where(FamilyPayment.kind.in_({"regular", "prepaid"}))
        .where(FamilyPayment.status != "cancelled")
        .where(FamilyPayment.period_start == period_start)
        .where(FamilyPayment.period_end == period_end)
    )
    return payment is not None


def _enqueue_payment_notification_once(
    db: Session,
    *,
    payment: FamilyPayment,
    recipient_user_id: UUID,
    event_type: str,
    message: str,
    reminder_date: date | None = None,
) -> int:
    if _payment_notification_exists(
        db,
        recipient_user_id=recipient_user_id,
        event_type=event_type,
        payment_id=payment.id,
        reminder_date=reminder_date,
    ):
        return 0

    payload = {
        "family_id": str(payment.family_id),
        "member_id": str(payment.member_id),
        "payment_id": str(payment.id),
        "message": message,
    }
    if reminder_date is not None:
        payload["reminder_date"] = reminder_date.isoformat()

    enqueue_notification(
        db,
        recipient_user_id=recipient_user_id,
        event_type=event_type,
        payload=payload,
    )
    return 1


def _enqueue_member_notification_once(
    db: Session,
    *,
    member: FamilyMember,
    recipient_user_id: UUID,
    event_type: str,
    message: str,
) -> int:
    jobs = list(
        db.scalars(
            select(NotificationJob)
            .where(NotificationJob.recipient_user_id == recipient_user_id)
            .where(NotificationJob.event_type == event_type)
        ).all()
    )
    if any(job.payload.get("member_id") == str(member.id) for job in jobs):
        return 0

    enqueue_notification(
        db,
        recipient_user_id=recipient_user_id,
        event_type=event_type,
        payload={
            "family_id": str(member.family_id),
            "member_id": str(member.id),
            "message": message,
        },
    )
    return 1


def _payment_notification_exists(
    db: Session,
    *,
    recipient_user_id: UUID,
    event_type: str,
    payment_id: UUID,
    reminder_date: date | None,
) -> bool:
    jobs = list(
        db.scalars(
            select(NotificationJob)
            .where(NotificationJob.recipient_user_id == recipient_user_id)
            .where(NotificationJob.event_type == event_type)
        ).all()
    )
    for job in jobs:
        if job.payload.get("payment_id") != str(payment_id):
            continue
        if reminder_date is None:
            return True
        if job.payload.get("reminder_date") == reminder_date.isoformat():
            return True
    return False


def execute_member_removals(db: Session) -> tuple[int, int]:
    now = utcnow()
    members = list(
        db.scalars(
            select(FamilyMember)
            .options(joinedload(FamilyMember.user))
            .where(FamilyMember.status == "removal_pending")
            .where(FamilyMember.removal_scheduled_at <= now)
            .order_by(FamilyMember.removal_scheduled_at.asc())
            .limit(settings.job_batch_size)
            .with_for_update(skip_locked=True)
        ).all()
    )

    notification_count = 0
    for member in members:
        old_member_status = member.status
        member.status = "removed"
        member.removed_at = now
        family = db.scalar(
            select(Family).where(Family.id == member.family_id).with_for_update()
        )
        if family is None:
            raise RuntimeError(f"Family {member.family_id} disappeared during removal")
        cancel_scheduled_payments(
            db,
            family_id=family.id,
            member_id=member.id,
            reason="member_removed",
        )
        family.active_members_count = max(1, family.active_members_count - 1)
        if family.status == "full" and family.active_members_count < family.max_members:
            family.status = "active"
        record_family_audit_event(
            db,
            family_id=member.family_id,
            action="family_member_removed_by_timeout",
            target_user_id=member.user_id,
            target_member_id=member.id,
            old_status=old_member_status,
            new_status=member.status,
            details={"removed_at": member.removed_at.isoformat()},
        )
        enqueue_notification(
            db,
            recipient_user_id=member.user_id,
            event_type="family_member_removed",
            payload={
                "family_id": str(member.family_id),
                "member_id": str(member.id),
                "message": "Вы удалены из семьи после 12-часового предупреждения.",
            },
        )
        notification_count += 1

    if members:
        db.flush()
    return len(members), notification_count


def close_due_families(db: Session) -> tuple[int, int]:
    now = utcnow()
    families = list(
        db.scalars(
            select(Family)
            .where(Family.status == "closing")
            .where(Family.closes_at <= now)
            .order_by(Family.closes_at.asc())
            .limit(settings.job_batch_size)
            .with_for_update(skip_locked=True)
        ).all()
    )

    notification_count = 0
    for family in families:
        old_family_status = family.status
        family.status = "closed"
        cancel_scheduled_payments(
            db,
            family_id=family.id,
            reason="family_closed",
        )
        record_family_audit_event(
            db,
            family_id=family.id,
            action="family_closed",
            old_status=old_family_status,
            new_status=family.status,
        )
        members = list(
            db.scalars(
                select(FamilyMember)
                .where(FamilyMember.family_id == family.id)
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
            ).all()
        )
        for member in members:
            enqueue_notification(
                db,
                recipient_user_id=member.user_id,
                event_type="family_closed",
                payload={
                    "family_id": str(family.id),
                    "member_id": str(member.id),
                    "message": "Семья закрыта. Вы можете найти другую семью.",
                },
            )
            notification_count += 1

    return len(families), notification_count
