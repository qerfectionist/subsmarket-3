from __future__ import annotations

from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session, contains_eager

from subsmarket.core.config import settings
from subsmarket.core.database import kz_today, utcnow
from subsmarket.families.audit import record_family_audit_event
from subsmarket.families.calendar import add_payment_period, payment_due_at
from subsmarket.families.models import (
    Family,
    FamilyMember,
    FamilyPayment,
)
from subsmarket.jobs.common import (
    REGULAR_PAYMENT_MEMBER_STATUSES,
)
from subsmarket.notifications.service import enqueue_notification


def _regular_payment_exists(
    db: Session,
    *,
    member_id: UUID,
    period_start: date,
    period_end: date,
) -> bool:
    return (
        db.scalar(
            select(FamilyPayment.id)
            .where(FamilyPayment.member_id == member_id)
            .where(FamilyPayment.period_start == period_start)
            .where(FamilyPayment.period_end == period_end)
        )
        is not None
    )


def mark_overdue_first_payments(db: Session) -> tuple[int, int]:
    now = utcnow()
    payments = list(
        db.scalars(
            select(FamilyPayment)
            .join(FamilyPayment.family)
            .join(FamilyPayment.member)
            .options(
                contains_eager(FamilyPayment.family),
                contains_eager(FamilyPayment.member),
            )
            .where(FamilyPayment.kind == "first")
            .where(FamilyPayment.status == "due")
            .where(FamilyPayment.due_at <= now)
            .order_by(FamilyPayment.due_at.asc())
            .limit(settings.job_batch_size)
            .with_for_update(of=FamilyPayment, skip_locked=True)
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
                    'нажмите "Оплатил". Если нет - оплатите или напишите владельцу.'
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
    today = kz_today()
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
            .join(FamilyPayment.member)
            .options(contains_eager(FamilyPayment.member))
            .where(FamilyPayment.kind == "regular")
            .where(FamilyPayment.status == "scheduled")
            .where(FamilyPayment.due_at <= now)
            .where(FamilyPayment.due_at > now - timedelta(hours=24))
            .order_by(FamilyPayment.due_at.asc())
            .limit(settings.job_batch_size)
            .with_for_update(of=(FamilyPayment, FamilyMember), skip_locked=True)
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
                    "Сегодня день оплаты семьи. Оплатите владельцу и нажмите «Оплатил»."
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
            .join(FamilyPayment.family)
            .join(FamilyPayment.member)
            .options(
                contains_eager(FamilyPayment.family),
                contains_eager(FamilyPayment.member),
            )
            .where(FamilyPayment.kind == "regular")
            .where(FamilyPayment.status.in_({"scheduled", "due"}))
            .where(FamilyPayment.due_at <= now - timedelta(hours=24))
            .order_by(FamilyPayment.due_at.asc())
            .limit(settings.job_batch_size)
            .with_for_update(of=(FamilyPayment, FamilyMember), skip_locked=True)
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
