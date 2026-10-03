from __future__ import annotations

from datetime import UTC, date, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, contains_eager

from subsmarket.core.database import kz_today, utcnow
from subsmarket.families.models import (
    Family,
    FamilyMember,
    FamilyPayment,
)
from subsmarket.jobs.common import (
    REGULAR_PAYMENT_MEMBER_STATUSES,
    _job_scan_limit,
)
from subsmarket.notifications.models import NotificationJob
from subsmarket.notifications.service import enqueue_notification


def _payment_notification_exists(
    db: Session,
    *,
    recipient_user_id: UUID,
    event_type: str,
    payment_id: UUID,
    reminder_date: date | None,
) -> bool:
    stmt = (
        select(NotificationJob.id)
        .where(NotificationJob.recipient_user_id == recipient_user_id)
        .where(NotificationJob.event_type == event_type)
        .where(NotificationJob.payload["payment_id"].as_string() == str(payment_id))
    )
    if reminder_date is None:
        return db.scalar(stmt) is not None
    return (
        db.scalar(
            stmt.where(
                NotificationJob.payload["reminder_date"].as_string()
                == reminder_date.isoformat()
            )
        )
        is not None
    )


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

    payload: dict[str, str] = {
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


def send_regular_payment_reminders(db: Session) -> int:
    today = kz_today()
    scheduled_payments = list(
        db.scalars(
            select(FamilyPayment)
            .join(Family, Family.id == FamilyPayment.family_id)
            .join(FamilyMember, FamilyMember.id == FamilyPayment.member_id)
            .options(
                contains_eager(FamilyPayment.family),
                contains_eager(FamilyPayment.member),
            )
            .where(FamilyPayment.kind == "regular")
            .where(FamilyPayment.status == "scheduled")
            .where(Family.status.in_({"active", "full"}))
            .where(FamilyMember.status.in_(REGULAR_PAYMENT_MEMBER_STATUSES))
            .order_by(FamilyPayment.due_at.asc())
            .limit(_job_scan_limit())
            .with_for_update(of=FamilyPayment, skip_locked=True)
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
                    "Через месяц годовая оплата семьи. Подготовьте сумму заранее."
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
                contains_eager(FamilyPayment.family),
                contains_eager(FamilyPayment.member),
            )
            .where(FamilyPayment.kind == "regular")
            .where(FamilyPayment.status.in_({"due", "overdue"}))
            .where(Family.status.in_({"active", "full", "closing"}))
            .where(
                FamilyMember.status.in_({"payment_due", "active"})
            )
            .order_by(FamilyPayment.due_at.asc())
            .limit(_job_scan_limit())
            .with_for_update(of=FamilyPayment, skip_locked=True)
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
            .join(FamilyPayment.family)
            .options(contains_eager(FamilyPayment.family))
            .where(FamilyPayment.status == "payment_reported")
            .where(FamilyPayment.reported_paid_at.is_not(None))
            .order_by(FamilyPayment.reported_paid_at.asc())
            .limit(_job_scan_limit())
            .with_for_update(of=FamilyPayment, skip_locked=True)
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
                reminder_date=kz_today(),
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
