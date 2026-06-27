from __future__ import annotations

from uuid import UUID

from fastapi import Depends, Header, Query
from sqlalchemy.orm import Session

from subsmarket.core.database import get_db
from subsmarket.families.api.deps import (
    MAX_CURSOR_LENGTH,
    MAX_PAGE_OFFSET,
    get_current_user,
)
from subsmarket.families.schemas import (
    FamilyMemberPaymentsOut,
    FamilyPaymentOut,
    FamilyPaymentPageOut,
    PaymentConfirmationResult,
    PrepaymentPeriodsCreate,
)
from subsmarket.families.service import (
    cancel_payment_report,
    confirm_payment_received,
    create_member_prepayment,
    list_family_member_payments,
    list_member_payments,
    list_member_payments_page,
    mark_payment_not_received,
    record_owner_prepaid_periods,
    report_payment_paid,
    to_payment_out,
)


def get_member_payments(
    member_id: UUID,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0, le=MAX_PAGE_OFFSET),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> list[FamilyPaymentOut]:
    return [
        to_payment_out(item)
        for item in list_member_payments(
            db, user, member_id, limit=limit, offset=offset
        )
    ]


def get_member_payments_page(
    member_id: UUID,
    limit: int = Query(default=50, ge=1, le=100),
    cursor: str | None = Query(
        default=None,
        min_length=1,
        max_length=MAX_CURSOR_LENGTH,
    ),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyPaymentPageOut:
    items, next_cursor = list_member_payments_page(
        db,
        user,
        member_id,
        limit=limit,
        cursor=cursor,
    )
    return FamilyPaymentPageOut(
        items=[to_payment_out(item) for item in items],
        next_cursor=next_cursor,
    )


def get_family_member_payments(
    family_id: UUID,
    limit_per_member: int = Query(default=20, ge=1, le=50),
    member_limit: int = Query(default=50, ge=1, le=100),
    member_offset: int = Query(default=0, ge=0, le=MAX_PAGE_OFFSET),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> list[FamilyMemberPaymentsOut]:
    return [
        FamilyMemberPaymentsOut(
            member_id=member_id,
            payments=[to_payment_out(payment) for payment in payments],
        )
        for member_id, payments in list_family_member_payments(
            db,
            user,
            family_id,
            limit_per_member=limit_per_member,
            member_limit=member_limit,
            member_offset=member_offset,
        )
    ]


def post_member_prepayment(
    member_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyPaymentOut:
    return to_payment_out(create_member_prepayment(db, user, member_id))


def post_owner_prepaid_periods(
    member_id: UUID,
    payload: PrepaymentPeriodsCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> list[FamilyPaymentOut]:
    return [
        to_payment_out(payment)
        for payment in record_owner_prepaid_periods(db, user, member_id, payload)
    ]


def post_payment_report_paid(
    payment_id: UUID,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyPaymentOut:
    payment = report_payment_paid(
        db,
        user,
        payment_id,
        idempotency_key=idempotency_key,
    )
    return to_payment_out(payment)


def post_payment_cancel_report(
    payment_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyPaymentOut:
    payment = cancel_payment_report(db, user, payment_id)
    return to_payment_out(payment)


def post_payment_confirm(
    payment_id: UUID,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> PaymentConfirmationResult:
    return confirm_payment_received(
        db,
        user,
        payment_id,
        idempotency_key=idempotency_key,
    )


def post_payment_not_received(
    payment_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyPaymentOut:
    payment = mark_payment_not_received(db, user, payment_id)
    return to_payment_out(payment)
