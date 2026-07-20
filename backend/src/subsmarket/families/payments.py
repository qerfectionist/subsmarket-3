from __future__ import annotations

from datetime import timedelta
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from subsmarket.core.database import kz_today, utcnow
from subsmarket.core.idempotency import claim_idempotency, complete_idempotency
from subsmarket.families._internal import (
    ACTIVE_MEMBER_STATUSES,
    _get_member_for_update,
    _get_payment_for_update,
    _payment_period_exists,
    _period_count_label,
)
from subsmarket.families.audit import record_family_audit_event
from subsmarket.families.calendar import add_payment_period, payment_due_at
from subsmarket.families.crypto import decrypt_payment_requisite
from subsmarket.families.models import (
    Family,
    FamilyMember,
    FamilyPayment,
    FamilyPaymentRequisite,
)
from subsmarket.families.queries import to_member_out, to_payment_out
from subsmarket.families.schemas import (
    AccessConfirmationResult,
    PaymentConfirmationResult,
    PaymentRequisiteOut,
    PrepaymentPeriodsCreate,
)
from subsmarket.identity.models import User
from subsmarket.notifications.models import NotificationJob
from subsmarket.notifications.service import enqueue_notification


def confirm_access_received(
    db: Session,
    user: User,
    member_id: UUID,
    *,
    idempotency_key: str | None = None,
) -> AccessConfirmationResult:
    claim = claim_idempotency(
        db,
        user_id=user.id,
        operation="family_member.confirm_access",
        idempotency_key=idempotency_key,
        payload={"member_id": str(member_id)},
        resource_type="family_payment",
    )
    if claim.is_replay:
        replayed_payment = db.get(FamilyPayment, claim.resource_id)
        if replayed_payment is None:
            raise RuntimeError("Idempotent family payment was not found")
        return _access_confirmation_result(db, replayed_payment)

    member = db.scalar(
        select(FamilyMember).where(FamilyMember.id == member_id).with_for_update()
    )
    if member is None:
        raise HTTPException(status_code=404, detail="FAMILY_MEMBER_NOT_FOUND")
    if member.user_id != user.id:
        raise HTTPException(status_code=403, detail="ONLY_MEMBER_CAN_CONFIRM_ACCESS")
    if member.status != "awaiting_confirmation":
        raise HTTPException(status_code=409, detail="MEMBER_NOT_AWAITING_CONFIRMATION")

    family = db.scalar(
        select(Family).where(Family.id == member.family_id).with_for_update()
    )
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")
    if family.status not in {"active", "full"}:
        raise HTTPException(status_code=409, detail="FAMILY_NOT_MUTABLE")
    requisite = db.scalar(
        select(FamilyPaymentRequisite).where(
            FamilyPaymentRequisite.family_id == family.id
        )
    )
    if requisite is None:
        raise HTTPException(status_code=500, detail="PAYMENT_REQUISITE_NOT_FOUND")

    now = utcnow()
    today = kz_today()
    period_end = family.next_payment_date
    if period_end <= today:
        period_end = add_payment_period(today, family.period)

    old_member_status = member.status
    member.status = "payment_due"
    member.access_confirmed_at = now
    payment = FamilyPayment(
        family_id=family.id,
        member_id=member.id,
        kind="first",
        status="due",
        amount_kzt=family.member_share_kzt,
        period=family.period,
        period_start=today,
        period_end=period_end,
        due_at=now + timedelta(minutes=30),
        requisites_opened_at=now,
    )
    db.add(payment)
    db.flush()
    record_family_audit_event(
        db,
        family_id=family.id,
        action="family_access_confirmed",
        actor_user_id=user.id,
        target_user_id=member.user_id,
        target_member_id=member.id,
        target_payment_id=payment.id,
        old_status=old_member_status,
        new_status=member.status,
        details={
            "access_confirmed_at": member.access_confirmed_at.isoformat(),
            "payment_kind": payment.kind,
            "payment_status": payment.status,
            "amount_kzt": payment.amount_kzt,
            "period_start": payment.period_start.isoformat(),
            "period_end": payment.period_end.isoformat(),
        },
    )
    enqueue_notification(
        db,
        recipient_user_id=family.owner_user_id,
        event_type="family_access_confirmed_owner",
        payload={
            "family_id": str(family.id),
            "member_id": str(member.id),
            "payment_id": str(payment.id),
            "message": (
                f"{user.first_name} подтвердил доступ. "
                "Теперь ожидается первый платеж."
            ),
        },
    )
    complete_idempotency(
        claim,
        resource_type="family_payment",
        resource_id=payment.id,
    )
    db.flush()
    db.refresh(member)
    db.refresh(payment)

    return _access_confirmation_result(db, payment)


def _access_confirmation_result(
    db: Session,
    payment: FamilyPayment,
) -> AccessConfirmationResult:
    member = db.get(FamilyMember, payment.member_id)
    if member is None:
        raise RuntimeError("Family member for access confirmation was not found")
    requisite = db.scalar(
        select(FamilyPaymentRequisite).where(
            FamilyPaymentRequisite.family_id == payment.family_id
        )
    )
    if requisite is None:
        raise RuntimeError("Payment requisite for access confirmation was not found")
    member.user = db.get(User, member.user_id)
    return AccessConfirmationResult(
        member=to_member_out(member),
        payment=to_payment_out(payment),
        payment_requisite=PaymentRequisiteOut(
            bank=requisite.bank,
            phone=decrypt_payment_requisite(requisite.encrypted_phone),
        ),
    )


def get_open_payment_requisite(
    db: Session, user: User, member_id: UUID
) -> PaymentRequisiteOut:
    member = db.scalar(select(FamilyMember).where(FamilyMember.id == member_id))
    if member is None:
        raise HTTPException(status_code=404, detail="FAMILY_MEMBER_NOT_FOUND")
    family = db.get(Family, member.family_id)
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")

    can_view = family.owner_user_id == user.id or (
        member.user_id == user.id
        and member.status in ACTIVE_MEMBER_STATUSES
        and family.status != "closed"
    )
    if not can_view:
        raise HTTPException(status_code=403, detail="PAYMENT_REQUISITE_FORBIDDEN")
    if member.access_confirmed_at is None:
        raise HTTPException(status_code=409, detail="ACCESS_NOT_CONFIRMED")

    requisite = db.scalar(
        select(FamilyPaymentRequisite).where(
            FamilyPaymentRequisite.family_id == family.id
        )
    )
    if requisite is None:
        raise HTTPException(status_code=500, detail="PAYMENT_REQUISITE_NOT_FOUND")
    return PaymentRequisiteOut(
        bank=requisite.bank,
        phone=decrypt_payment_requisite(requisite.encrypted_phone),
    )


def create_member_prepayment(
    db: Session, user: User, member_id: UUID
) -> FamilyPayment:
    member = _get_member_for_update(db, member_id)
    if member.user_id != user.id:
        raise HTTPException(status_code=403, detail="ONLY_MEMBER_CAN_PREPAY")
    if member.role == "owner" or member.status != "active":
        raise HTTPException(
            status_code=409,
            detail="MEMBER_NOT_ELIGIBLE_FOR_PREPAYMENT",
        )

    family = db.get(Family, member.family_id)
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")
    if family.status not in {"active", "full"}:
        raise HTTPException(
            status_code=409,
            detail="FAMILY_NOT_ELIGIBLE_FOR_PREPAYMENT",
        )

    period_start = family.next_payment_date
    period_end = add_payment_period(period_start, family.period)
    if _payment_period_exists(db, member.id, period_start, period_end):
        raise HTTPException(status_code=409, detail="MEMBER_PREPAYMENT_LIMIT_REACHED")

    now = utcnow()
    payment = FamilyPayment(
        family_id=family.id,
        member_id=member.id,
        kind="prepaid",
        status="due",
        amount_kzt=family.member_share_kzt,
        period=family.period,
        period_start=period_start,
        period_end=period_end,
        due_at=payment_due_at(period_start),
        requisites_opened_at=now,
    )
    db.add(payment)
    db.flush()
    record_family_audit_event(
        db,
        family_id=family.id,
        action="family_prepayment_created",
        actor_user_id=user.id,
        target_user_id=member.user_id,
        target_member_id=member.id,
        target_payment_id=payment.id,
        new_status=payment.status,
        details={
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
            "amount_kzt": payment.amount_kzt,
        },
    )
    db.flush()
    db.refresh(payment)
    return payment


def record_owner_prepaid_periods(
    db: Session,
    user: User,
    member_id: UUID,
    data: PrepaymentPeriodsCreate,
) -> list[FamilyPayment]:
    member = _get_member_for_update(db, member_id)
    family = db.get(Family, member.family_id)
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")
    if family.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="ONLY_OWNER_CAN_RECORD_PREPAYMENT")
    if member.role == "owner" or member.status != "active":
        raise HTTPException(
            status_code=409,
            detail="MEMBER_NOT_ELIGIBLE_FOR_PREPAYMENT",
        )
    if family.status not in {"active", "full"}:
        raise HTTPException(
            status_code=409,
            detail="FAMILY_NOT_ELIGIBLE_FOR_PREPAYMENT",
        )
    if family.period == "yearly" and data.periods > 3:
        raise HTTPException(status_code=409, detail="YEARLY_PREPAYMENT_LIMIT_REACHED")
    if family.period == "monthly" and data.periods > 12:
        raise HTTPException(status_code=409, detail="MONTHLY_PREPAYMENT_LIMIT_REACHED")

    now = utcnow()
    created: list[FamilyPayment] = []
    period_start = family.next_payment_date
    while len(created) < data.periods:
        period_end = add_payment_period(period_start, family.period)
        if not _payment_period_exists(db, member.id, period_start, period_end):
            payment = FamilyPayment(
                family_id=family.id,
                member_id=member.id,
                kind="prepaid",
                status="paid",
                amount_kzt=family.member_share_kzt,
                period=family.period,
                period_start=period_start,
                period_end=period_end,
                due_at=payment_due_at(period_start),
                requisites_opened_at=now,
                reported_paid_at=now,
                confirmed_paid_at=now,
            )
            db.add(payment)
            db.flush()
            record_family_audit_event(
                db,
                family_id=family.id,
                action="family_prepayment_recorded_by_owner",
                actor_user_id=user.id,
                target_user_id=member.user_id,
                target_member_id=member.id,
                target_payment_id=payment.id,
                new_status=payment.status,
                details={
                    "period_start": period_start.isoformat(),
                    "period_end": period_end.isoformat(),
                    "amount_kzt": payment.amount_kzt,
                },
            )
            created.append(payment)
        period_start = period_end

    enqueue_notification(
        db,
        recipient_user_id=member.user_id,
        event_type="family_prepayment_recorded_member",
        payload={
            "family_id": str(family.id),
            "member_id": str(member.id),
            "payment_ids": [str(payment.id) for payment in created],
            "message": (
                f"Владелец отметил предоплату: {len(created)} "
                f"{_period_count_label(len(created), family.period)}."
            ),
        },
    )
    db.flush()
    for payment in created:
        db.refresh(payment)
    return created


def report_payment_paid(
    db: Session,
    user: User,
    payment_id: UUID,
    *,
    idempotency_key: str | None = None,
) -> FamilyPayment:
    claim = claim_idempotency(
        db,
        user_id=user.id,
        operation="family_payment.report_paid",
        idempotency_key=idempotency_key,
        payload={"payment_id": str(payment_id)},
        resource_type="family_payment",
    )
    if claim.is_replay:
        replayed_payment = db.get(FamilyPayment, claim.resource_id)
        if replayed_payment is None:
            raise RuntimeError("Idempotent family payment was not found")
        return replayed_payment

    payment = _get_payment_for_update(db, payment_id)
    member = db.get(FamilyMember, payment.member_id)
    if member is None:
        raise HTTPException(status_code=404, detail="FAMILY_MEMBER_NOT_FOUND")
    if member.user_id != user.id:
        raise HTTPException(status_code=403, detail="ONLY_MEMBER_CAN_REPORT_PAYMENT")
    if payment.status not in {"due", "overdue"}:
        raise HTTPException(status_code=409, detail="PAYMENT_NOT_REPORTABLE")

    family = db.get(Family, payment.family_id)
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")

    old_status = payment.status
    cancel_pending_payment_notifications(db, payment)
    payment.status = "payment_reported"
    payment.reported_paid_at = utcnow()
    record_family_audit_event(
        db,
        family_id=family.id,
        action="family_payment_reported",
        actor_user_id=user.id,
        target_user_id=member.user_id,
        target_member_id=member.id,
        target_payment_id=payment.id,
        old_status=old_status,
        new_status=payment.status,
        details={
            "payment_kind": payment.kind,
            "amount_kzt": payment.amount_kzt,
            "reported_paid_at": payment.reported_paid_at.isoformat(),
        },
    )
    enqueue_notification(
        db,
        recipient_user_id=family.owner_user_id,
        event_type="family_payment_reported_owner",
        payload={
            "family_id": str(payment.family_id),
            "member_id": str(member.id),
            "payment_id": str(payment.id),
            "message": (
                f"{user.first_name} отметил оплату. "
                "Проверьте перевод и подтвердите."
            ),
        },
    )
    complete_idempotency(
        claim,
        resource_type="family_payment",
        resource_id=payment.id,
    )
    db.flush()
    db.refresh(payment)
    return payment


def cancel_payment_report(db: Session, user: User, payment_id: UUID) -> FamilyPayment:
    payment = _get_payment_for_update(db, payment_id)
    member = db.get(FamilyMember, payment.member_id)
    if member is None:
        raise HTTPException(status_code=404, detail="FAMILY_MEMBER_NOT_FOUND")
    if member.user_id != user.id:
        raise HTTPException(status_code=403, detail="ONLY_MEMBER_CAN_CANCEL_REPORT")
    if payment.status != "payment_reported":
        raise HTTPException(status_code=409, detail="PAYMENT_REPORT_NOT_ACTIVE")

    family = db.get(Family, payment.family_id)
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")

    old_status = payment.status
    cancel_pending_payment_notifications(db, payment)
    payment.status = "overdue" if payment.overdue_at is not None else "due"
    payment.reported_paid_at = None
    record_family_audit_event(
        db,
        family_id=family.id,
        action="family_payment_report_cancelled",
        actor_user_id=user.id,
        target_user_id=member.user_id,
        target_member_id=member.id,
        target_payment_id=payment.id,
        old_status=old_status,
        new_status=payment.status,
        details={"payment_kind": payment.kind},
    )
    enqueue_notification(
        db,
        recipient_user_id=family.owner_user_id,
        event_type="family_payment_report_cancelled_owner",
        payload={
            "family_id": str(payment.family_id),
            "member_id": str(member.id),
            "payment_id": str(payment.id),
            "message": f"{user.first_name} отменил отметку оплаты.",
        },
    )
    db.flush()
    db.refresh(payment)
    return payment


def confirm_payment_received(
    db: Session,
    user: User,
    payment_id: UUID,
    *,
    idempotency_key: str | None = None,
) -> PaymentConfirmationResult:
    claim = claim_idempotency(
        db,
        user_id=user.id,
        operation="family_payment.confirm_received",
        idempotency_key=idempotency_key,
        payload={"payment_id": str(payment_id)},
        resource_type="family_payment",
    )
    if claim.is_replay:
        replayed_payment = db.get(FamilyPayment, claim.resource_id)
        if replayed_payment is None:
            raise RuntimeError("Idempotent family payment was not found")
        return _payment_confirmation_result(db, replayed_payment)

    payment = _get_payment_for_update(db, payment_id)
    member = db.scalar(
        select(FamilyMember)
        .where(FamilyMember.id == payment.member_id)
        .with_for_update()
    )
    if member is None:
        raise HTTPException(status_code=404, detail="FAMILY_MEMBER_NOT_FOUND")
    family = db.get(Family, payment.family_id)
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")
    if family.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="ONLY_OWNER_CAN_CONFIRM_PAYMENT")
    if payment.status != "payment_reported":
        raise HTTPException(status_code=409, detail="PAYMENT_NOT_REPORTED")

    old_payment_status = payment.status
    old_member_status = member.status
    cancel_pending_payment_notifications(db, payment)
    payment.status = "paid"
    payment.confirmed_paid_at = utcnow()
    if member.status == "payment_due" and not _has_other_open_payment(
        db, member.id, exclude_payment_id=payment.id
    ):
        member.status = "active"
    record_family_audit_event(
        db,
        family_id=family.id,
        action="family_payment_confirmed",
        actor_user_id=user.id,
        target_user_id=member.user_id,
        target_member_id=member.id,
        target_payment_id=payment.id,
        old_status=old_payment_status,
        new_status=payment.status,
        details={
            "payment_kind": payment.kind,
            "amount_kzt": payment.amount_kzt,
            "confirmed_paid_at": payment.confirmed_paid_at.isoformat(),
            "old_member_status": old_member_status,
            "new_member_status": member.status,
        },
    )
    enqueue_notification(
        db,
        recipient_user_id=member.user_id,
        event_type="family_payment_confirmed_member",
        payload={
            "family_id": str(payment.family_id),
            "member_id": str(member.id),
            "payment_id": str(payment.id),
            "message": "Владелец подтвердил оплату.",
        },
    )
    complete_idempotency(
        claim,
        resource_type="family_payment",
        resource_id=payment.id,
    )
    db.flush()
    db.refresh(payment)
    db.refresh(member)
    return _payment_confirmation_result(db, payment)


def _payment_confirmation_result(
    db: Session,
    payment: FamilyPayment,
) -> PaymentConfirmationResult:
    member = db.get(FamilyMember, payment.member_id)
    if member is None:
        raise RuntimeError("Family member for payment confirmation was not found")
    member.user = db.get(User, member.user_id)
    return PaymentConfirmationResult(
        member=to_member_out(member), payment=to_payment_out(payment)
    )


def mark_payment_not_received(
    db: Session, user: User, payment_id: UUID
) -> FamilyPayment:
    payment = _get_payment_for_update(db, payment_id)
    family = db.get(Family, payment.family_id)
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")
    if family.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="ONLY_OWNER_CAN_MARK_NOT_RECEIVED")
    if payment.status != "payment_reported":
        raise HTTPException(status_code=409, detail="PAYMENT_NOT_REPORTED")
    member = db.get(FamilyMember, payment.member_id)
    if member is None:
        raise HTTPException(status_code=404, detail="FAMILY_MEMBER_NOT_FOUND")

    old_status = payment.status
    cancel_pending_payment_notifications(db, payment)
    payment.status = "overdue" if payment.overdue_at is not None else "due"
    payment.reported_paid_at = None
    record_family_audit_event(
        db,
        family_id=family.id,
        action="family_payment_not_received",
        actor_user_id=user.id,
        target_user_id=member.user_id,
        target_member_id=member.id,
        target_payment_id=payment.id,
        old_status=old_status,
        new_status=payment.status,
        details={"payment_kind": payment.kind},
    )
    enqueue_notification(
        db,
        recipient_user_id=member.user_id,
        event_type="family_payment_not_received_member",
        payload={
            "family_id": str(payment.family_id),
            "member_id": str(member.id),
            "payment_id": str(payment.id),
            "message": (
                "Владелец отметил, что оплату не получил. "
                "Проверьте перевод и свяжитесь с владельцем."
            ),
        },
    )
    db.flush()
    db.refresh(payment)
    return payment


def _has_other_open_payment(
    db: Session, member_id: UUID, *, exclude_payment_id: UUID
) -> bool:
    payment = db.scalar(
        select(FamilyPayment.id)
        .where(FamilyPayment.member_id == member_id)
        .where(FamilyPayment.id != exclude_payment_id)
        .where(FamilyPayment.status.in_({"due", "overdue", "payment_reported"}))
    )
    return payment is not None


def cancel_pending_payment_notifications(
    db: Session, payment: FamilyPayment
) -> int:
    family = db.get(Family, payment.family_id)
    member = db.get(FamilyMember, payment.member_id)
    if family is None or member is None:
        return 0

    payment_id_str = str(payment.id)
    jobs = list(
        db.scalars(
            select(NotificationJob)
            .where(NotificationJob.status == "pending")
            .where(
                NotificationJob.recipient_user_id.in_(
                    {family.owner_user_id, member.user_id}
                )
            )
            .where(NotificationJob.payload["payment_id"].as_string() == payment_id_str)
        ).all()
    )
    for job in jobs:
        job.status = "cancelled"
    return len(jobs)


def cancel_scheduled_payments(
    db: Session,
    *,
    family_id: UUID,
    reason: str,
    actor_user_id: UUID | None = None,
    member_id: UUID | None = None,
) -> int:
    stmt = (
        select(FamilyPayment)
        .where(FamilyPayment.family_id == family_id)
        .where(FamilyPayment.status == "scheduled")
    )
    if member_id is not None:
        stmt = stmt.where(FamilyPayment.member_id == member_id)

    payments = list(db.scalars(stmt).all())
    now = utcnow()
    for payment in payments:
        old_status = payment.status
        payment.status = "cancelled"
        payment.cancelled_at = now
        payment.cancel_reason = reason
        cancel_pending_payment_notifications(db, payment)
        member = db.get(FamilyMember, payment.member_id)
        record_family_audit_event(
            db,
            family_id=family_id,
            action="family_payment_cancelled",
            actor_user_id=actor_user_id,
            target_user_id=member.user_id if member else None,
            target_member_id=payment.member_id,
            target_payment_id=payment.id,
            old_status=old_status,
            new_status=payment.status,
            details={
                "reason": reason,
                "cancelled_at": payment.cancelled_at.isoformat(),
            },
        )
    return len(payments)
