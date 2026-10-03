from __future__ import annotations

from datetime import timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, contains_eager

from subsmarket.core.config import settings
from subsmarket.core.database import kz_today, utcnow
from subsmarket.families.audit import record_family_audit_event
from subsmarket.families.models import (
    Family,
    FamilyMember,
    FamilyRequest,
)
from subsmarket.families.service import (
    cancel_scheduled_payments,
    record_owner_request_expired,
)
from subsmarket.jobs.common import (
    CLOSING_ACK_MEMBER_STATUSES,
    _job_scan_limit,
)
from subsmarket.notifications.models import NotificationJob
from subsmarket.notifications.service import enqueue_notification


def _enqueue_member_notification_once(
    db: Session,
    *,
    member: FamilyMember,
    recipient_user_id: UUID,
    event_type: str,
    message: str,
) -> int:
    existing = db.scalar(
        select(NotificationJob.id)
        .where(NotificationJob.recipient_user_id == recipient_user_id)
        .where(NotificationJob.event_type == event_type)
        .where(NotificationJob.payload["member_id"].as_string() == str(member.id))
    )
    if existing is not None:
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


def expire_family_requests(db: Session) -> tuple[int, int]:
    now = utcnow()
    requests = list(
        db.scalars(
            select(FamilyRequest)
            .join(FamilyRequest.family)
            .options(contains_eager(FamilyRequest.family))
            .where(FamilyRequest.status == "pending")
            .where(FamilyRequest.expires_at <= now)
            .order_by(FamilyRequest.expires_at.asc())
            .limit(settings.job_batch_size)
            .with_for_update(of=FamilyRequest, skip_locked=True)
        ).all()
    )

    notification_count = 0
    for request in requests:
        old_status = request.status
        request.status = "expired"
        request.expired_at = now
        family = request.family
        record_owner_request_expired(
            db,
            owner_user_id=family.owner_user_id,
            expired_at=request.expired_at,
        )
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
                "message": (
                    "Заявка участника истекла, так как вы не ответили за 24 часа."
                ),
            },
        )
        notification_count += 1

    return len(requests), notification_count


def send_access_confirmation_reminders(db: Session) -> int:
    now = utcnow()
    members = list(
        db.scalars(
            select(FamilyMember)
            .join(FamilyMember.family)
            .options(contains_eager(FamilyMember.family))
            .where(FamilyMember.status == "awaiting_confirmation")
            .where(FamilyMember.access_provided_at <= now - timedelta(hours=24))
            .order_by(FamilyMember.access_provided_at.asc())
            .limit(_job_scan_limit())
            .with_for_update(of=FamilyMember, skip_locked=True)
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


def send_closing_acknowledgement_reminders(db: Session) -> int:
    now = utcnow()
    today = kz_today()
    members = list(
        db.scalars(
            select(FamilyMember)
            .join(Family, Family.id == FamilyMember.family_id)
            .options(contains_eager(FamilyMember.family))
            .where(Family.status == "closing")
            .where(Family.closes_at > now)
            .where(Family.closing_started_at <= now - timedelta(days=1))
            .where(FamilyMember.role == "member")
            .where(FamilyMember.status.in_(CLOSING_ACK_MEMBER_STATUSES))
            .where(FamilyMember.closing_acknowledged_at.is_(None))
            .order_by(Family.closes_at.asc(), FamilyMember.created_at.asc())
            .limit(_job_scan_limit())
            .with_for_update(of=FamilyMember, skip_locked=True)
        ).all()
    )

    notification_count = 0
    for member in members:
        closes_on = member.family.closes_at.date().isoformat()
        existing_job_id = db.scalar(
            select(NotificationJob.id)
            .where(NotificationJob.recipient_user_id == member.user_id)
            .where(NotificationJob.event_type == "family_closing_ack_reminder_member")
            .where(
                NotificationJob.payload["family_id"].as_string()
                == str(member.family_id)
            )
            .where(
                NotificationJob.payload["reminder_date"].as_string()
                == today.isoformat()
            )
        )
        if existing_job_id is not None:
            continue
        enqueue_notification(
            db,
            recipient_user_id=member.user_id,
            event_type="family_closing_ack_reminder_member",
            payload={
                "family_id": str(member.family_id),
                "member_id": str(member.id),
                "reminder_date": today.isoformat(),
                "closes_on": closes_on,
                "message": (
                    f"Напоминание: семья закрывается {closes_on}. "
                    "Подтвердите, что увидели предупреждение."
                ),
            },
        )
        notification_count += 1

    if notification_count:
        db.flush()
    return notification_count


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
