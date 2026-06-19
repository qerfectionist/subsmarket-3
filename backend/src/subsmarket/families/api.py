from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response
from sqlalchemy.orm import Session

from subsmarket.core.database import get_db
from subsmarket.families.schemas import (
    AccessConfirmationResult,
    FamilyAuditLogOut,
    FamilyAuditLogPageOut,
    FamilyCreate,
    FamilyCreateResult,
    FamilyDescriptionUpdate,
    FamilyInviteOut,
    FamilyMemberOut,
    FamilyMemberPageOut,
    FamilyMemberPaymentsOut,
    FamilyOut,
    FamilyPageOut,
    FamilyPaymentDayUpdate,
    FamilyPaymentOut,
    FamilyPaymentPageOut,
    FamilyPriceUpdate,
    FamilyRequestOut,
    FamilyRequestPageOut,
    FamilyViewOut,
    FamilyVisibilityUpdate,
    MyFamilyOut,
    MyFamilyPageOut,
    OwnerFamilyRequestOut,
    OwnerFamilyRequestPageOut,
    PaymentConfirmationResult,
    PaymentRequisiteOut,
    PrepaymentPeriodsCreate,
)
from subsmarket.families.service import (
    acknowledge_family_closing,
    acknowledge_member_removal,
    approve_join_request,
    cancel_join_request,
    cancel_member_before_access,
    cancel_payment_report,
    close_family,
    confirm_access_received,
    confirm_payment_received,
    create_family,
    create_family_invite,
    create_join_request,
    create_member_prepayment,
    disable_family_invite,
    get_family_by_id,
    get_family_invite,
    get_family_view,
    get_open_payment_requisite,
    leave_family,
    list_family_audit_logs,
    list_family_audit_logs_page,
    list_family_member_payments,
    list_family_members,
    list_family_members_page,
    list_member_payments,
    list_member_payments_page,
    list_my_families,
    list_my_families_page,
    list_my_join_requests,
    list_my_join_requests_page,
    list_my_payments,
    list_my_payments_page,
    list_owner_family_requests,
    list_owner_family_requests_page,
    list_searchable_families,
    list_searchable_families_page,
    mark_access_provided,
    mark_payment_not_received,
    record_owner_prepaid_periods,
    reject_join_request,
    remind_access_confirmation,
    report_payment_paid,
    request_member_removal_cancellation,
    resolve_family_invite,
    revoke_member_removal,
    rotate_family_invite,
    schedule_member_removal,
    to_audit_log_out,
    to_family_out,
    to_family_request_out,
    to_member_out,
    to_owner_family_request_out,
    to_payment_out,
    update_family_description,
    update_family_payment_day,
    update_family_price,
    update_family_visibility,
)
from subsmarket.identity.service import upsert_user
from subsmarket.identity.telegram import parse_telegram_user

router = APIRouter(prefix="/api/families", tags=["families"])

MAX_PAGE_OFFSET = 100_000
MAX_CURSOR_LENGTH = 512


def get_current_user(
    db: Session = Depends(get_db),
    telegram_user=Depends(parse_telegram_user),
):
    if not telegram_user.username:
        raise HTTPException(status_code=403, detail="USERNAME_REQUIRED")
    return upsert_user(db, telegram_user)


@router.post("", response_model=FamilyCreateResult, status_code=201)
def post_family(
    payload: FamilyCreate,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyCreateResult:
    family = create_family(
        db,
        user,
        payload,
        idempotency_key=idempotency_key,
    )
    return FamilyCreateResult(family=to_family_out(family))


@router.get("", response_model=list[FamilyOut])
def get_families(
    family_type: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0, le=MAX_PAGE_OFFSET),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> list[FamilyOut]:
    return [
        to_family_out(family)
        for family in list_searchable_families(
            db, user, family_type=family_type, limit=limit, offset=offset
        )
    ]


@router.get("/page", response_model=FamilyPageOut)
def get_families_page(
    family_type: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    cursor: str | None = Query(
        default=None,
        min_length=1,
        max_length=MAX_CURSOR_LENGTH,
    ),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyPageOut:
    items, next_cursor = list_searchable_families_page(
        db,
        user,
        family_type=family_type,
        limit=limit,
        cursor=cursor,
    )
    return FamilyPageOut(
        items=[to_family_out(family) for family in items],
        next_cursor=next_cursor,
    )


@router.get("/me", response_model=list[MyFamilyOut])
def get_my_families(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0, le=MAX_PAGE_OFFSET),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> list[MyFamilyOut]:
    return list_my_families(db, user, limit=limit, offset=offset)


@router.get("/me/page", response_model=MyFamilyPageOut)
def get_my_families_page(
    limit: int = Query(default=50, ge=1, le=100),
    cursor: str | None = Query(
        default=None,
        min_length=1,
        max_length=MAX_CURSOR_LENGTH,
    ),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> MyFamilyPageOut:
    items, next_cursor = list_my_families_page(
        db,
        user,
        limit=limit,
        cursor=cursor,
    )
    return MyFamilyPageOut(items=items, next_cursor=next_cursor)


@router.get("/payments/me", response_model=list[FamilyPaymentOut])
def get_my_payments(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0, le=MAX_PAGE_OFFSET),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> list[FamilyPaymentOut]:
    return [
        to_payment_out(item)
        for item in list_my_payments(db, user, limit=limit, offset=offset)
    ]


@router.get("/payments/me/page", response_model=FamilyPaymentPageOut)
def get_my_payments_page(
    limit: int = Query(default=50, ge=1, le=100),
    cursor: str | None = Query(
        default=None,
        min_length=1,
        max_length=MAX_CURSOR_LENGTH,
    ),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyPaymentPageOut:
    items, next_cursor = list_my_payments_page(
        db,
        user,
        limit=limit,
        cursor=cursor,
    )
    return FamilyPaymentPageOut(
        items=[to_payment_out(item) for item in items],
        next_cursor=next_cursor,
    )


@router.get("/invites/{code}", response_model=FamilyViewOut)
def get_family_by_invite_code(
    code: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyViewOut:
    return resolve_family_invite(db, user, code)


@router.post("/{family_id}/requests", response_model=FamilyRequestOut, status_code=201)
def post_family_request(
    family_id: UUID,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyRequestOut:
    request = create_join_request(
        db,
        user,
        family_id,
        idempotency_key=idempotency_key,
    )
    return to_family_request_out(request)


@router.get("/requests/me", response_model=list[FamilyRequestOut])
def get_my_family_requests(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0, le=MAX_PAGE_OFFSET),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> list[FamilyRequestOut]:
    return [
        to_family_request_out(item)
        for item in list_my_join_requests(db, user, limit=limit, offset=offset)
    ]


@router.get("/requests/me/page", response_model=FamilyRequestPageOut)
def get_my_family_requests_page(
    limit: int = Query(default=50, ge=1, le=100),
    cursor: str | None = Query(
        default=None,
        min_length=1,
        max_length=MAX_CURSOR_LENGTH,
    ),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyRequestPageOut:
    items, next_cursor = list_my_join_requests_page(
        db,
        user,
        limit=limit,
        cursor=cursor,
    )
    return FamilyRequestPageOut(
        items=[to_family_request_out(item) for item in items],
        next_cursor=next_cursor,
    )


@router.post("/requests/{request_id}/cancel", response_model=FamilyRequestOut)
def cancel_my_family_request(
    request_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyRequestOut:
    request = cancel_join_request(db, user, request_id)
    return to_family_request_out(request)


@router.get("/{family_id}/requests", response_model=list[OwnerFamilyRequestOut])
def get_owner_family_requests(
    family_id: UUID,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0, le=MAX_PAGE_OFFSET),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> list[OwnerFamilyRequestOut]:
    return [
        to_owner_family_request_out(item)
        for item in list_owner_family_requests(
            db, user, family_id, limit=limit, offset=offset
        )
    ]


@router.get("/{family_id}/requests/page", response_model=OwnerFamilyRequestPageOut)
def get_owner_family_requests_page(
    family_id: UUID,
    limit: int = Query(default=50, ge=1, le=100),
    cursor: str | None = Query(
        default=None,
        min_length=1,
        max_length=MAX_CURSOR_LENGTH,
    ),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> OwnerFamilyRequestPageOut:
    items, next_cursor = list_owner_family_requests_page(
        db,
        user,
        family_id,
        limit=limit,
        cursor=cursor,
    )
    return OwnerFamilyRequestPageOut(
        items=[to_owner_family_request_out(item) for item in items],
        next_cursor=next_cursor,
    )


@router.post("/requests/{request_id}/approve", response_model=FamilyRequestOut)
def approve_family_request(
    request_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyRequestOut:
    request = approve_join_request(db, user, request_id)
    return to_family_request_out(request)


@router.post("/requests/{request_id}/reject", response_model=FamilyRequestOut)
def reject_family_request(
    request_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyRequestOut:
    request = reject_join_request(db, user, request_id)
    return to_family_request_out(request)


@router.patch("/{family_id}/description", response_model=FamilyOut)
def patch_family_description(
    family_id: UUID,
    payload: FamilyDescriptionUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyOut:
    return to_family_out(update_family_description(db, user, family_id, payload))


@router.patch("/{family_id}/price", response_model=FamilyOut)
def patch_family_price(
    family_id: UUID,
    payload: FamilyPriceUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyOut:
    return to_family_out(update_family_price(db, user, family_id, payload))


@router.patch("/{family_id}/payment-day", response_model=FamilyOut)
def patch_family_payment_day(
    family_id: UUID,
    payload: FamilyPaymentDayUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyOut:
    return to_family_out(update_family_payment_day(db, user, family_id, payload))


@router.patch("/{family_id}/visibility", response_model=FamilyOut)
def patch_family_visibility(
    family_id: UUID,
    payload: FamilyVisibilityUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyOut:
    return to_family_out(update_family_visibility(db, user, family_id, payload))


@router.get("/{family_id}/invite", response_model=FamilyInviteOut | None)
def get_owner_family_invite(
    family_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyInviteOut | None:
    invite = get_family_invite(db, user, family_id)
    return FamilyInviteOut.model_validate(invite) if invite else None


@router.post(
    "/{family_id}/invite",
    response_model=FamilyInviteOut,
    status_code=201,
)
def post_owner_family_invite(
    family_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyInviteOut:
    return FamilyInviteOut.model_validate(create_family_invite(db, user, family_id))


@router.post("/{family_id}/invite/rotate", response_model=FamilyInviteOut)
def post_owner_family_invite_rotation(
    family_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyInviteOut:
    return FamilyInviteOut.model_validate(rotate_family_invite(db, user, family_id))


@router.post("/{family_id}/invite/disable", status_code=204)
def post_owner_family_invite_disabled(
    family_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> Response:
    disable_family_invite(db, user, family_id)
    return Response(status_code=204)


@router.post("/{family_id}/close", response_model=FamilyOut)
def post_family_close(
    family_id: UUID,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyOut:
    return to_family_out(
        close_family(
            db,
            user,
            family_id,
            idempotency_key=idempotency_key,
        )
    )


@router.post("/{family_id}/acknowledge-closing", response_model=FamilyMemberOut)
def post_family_closing_acknowledged(
    family_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyMemberOut:
    member = acknowledge_family_closing(db, user, family_id)
    return to_member_out(member)


@router.get("/{family_id}/members", response_model=list[FamilyMemberOut])
def get_family_members(
    family_id: UUID,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0, le=MAX_PAGE_OFFSET),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> list[FamilyMemberOut]:
    return [
        to_member_out(item)
        for item in list_family_members(db, user, family_id, limit=limit, offset=offset)
    ]


@router.get("/{family_id}/members/page", response_model=FamilyMemberPageOut)
def get_family_members_page(
    family_id: UUID,
    limit: int = Query(default=50, ge=1, le=100),
    cursor: str | None = Query(
        default=None,
        min_length=1,
        max_length=MAX_CURSOR_LENGTH,
    ),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyMemberPageOut:
    items, next_cursor = list_family_members_page(
        db,
        user,
        family_id,
        limit=limit,
        cursor=cursor,
    )
    return FamilyMemberPageOut(
        items=[to_member_out(item) for item in items],
        next_cursor=next_cursor,
    )


@router.post("/members/{member_id}/access-provided", response_model=FamilyMemberOut)
def post_member_access_provided(
    member_id: UUID,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyMemberOut:
    member = mark_access_provided(
        db,
        user,
        member_id,
        idempotency_key=idempotency_key,
    )
    return to_member_out(member)


@router.post(
    "/members/{member_id}/remind-access-confirmation",
    response_model=FamilyMemberOut,
)
def post_member_access_confirmation_reminder(
    member_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyMemberOut:
    member = remind_access_confirmation(db, user, member_id)
    return to_member_out(member)


@router.post(
    "/members/{member_id}/cancel-before-access",
    response_model=FamilyMemberOut,
)
def post_member_cancel_before_access(
    member_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyMemberOut:
    member = cancel_member_before_access(db, user, member_id)
    return to_member_out(member)


@router.post("/members/{member_id}/leave", response_model=FamilyMemberOut)
def post_member_leave(
    member_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyMemberOut:
    member = leave_family(db, user, member_id)
    return to_member_out(member)


@router.post("/members/{member_id}/remove", response_model=FamilyMemberOut)
def post_member_remove(
    member_id: UUID,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyMemberOut:
    member = schedule_member_removal(
        db,
        user,
        member_id,
        idempotency_key=idempotency_key,
    )
    return to_member_out(member)


@router.post("/members/{member_id}/acknowledge-removal", response_model=FamilyMemberOut)
def post_member_acknowledge_removal(
    member_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyMemberOut:
    member = acknowledge_member_removal(db, user, member_id)
    return to_member_out(member)


@router.post(
    "/members/{member_id}/request-removal-cancellation",
    response_model=FamilyMemberOut,
)
def post_member_request_removal_cancellation(
    member_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyMemberOut:
    member = request_member_removal_cancellation(db, user, member_id)
    return to_member_out(member)


@router.post("/members/{member_id}/revoke-removal", response_model=FamilyMemberOut)
def post_member_revoke_removal(
    member_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyMemberOut:
    member = revoke_member_removal(db, user, member_id)
    return to_member_out(member)


@router.post(
    "/members/{member_id}/access-confirmed",
    response_model=AccessConfirmationResult,
)
def post_member_access_confirmed(
    member_id: UUID,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> AccessConfirmationResult:
    return confirm_access_received(
        db,
        user,
        member_id,
        idempotency_key=idempotency_key,
    )


@router.get(
    "/members/{member_id}/payment-requisite",
    response_model=PaymentRequisiteOut,
)
def get_member_payment_requisite(
    member_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> PaymentRequisiteOut:
    return get_open_payment_requisite(db, user, member_id)


@router.get("/members/{member_id}/payments", response_model=list[FamilyPaymentOut])
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


@router.get("/members/{member_id}/payments/page", response_model=FamilyPaymentPageOut)
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


@router.get(
    "/{family_id}/payments",
    response_model=list[FamilyMemberPaymentsOut],
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


@router.post(
    "/members/{member_id}/prepayments",
    response_model=FamilyPaymentOut,
    status_code=201,
)
def post_member_prepayment(
    member_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyPaymentOut:
    return to_payment_out(create_member_prepayment(db, user, member_id))


@router.post(
    "/members/{member_id}/prepayments/record-paid",
    response_model=list[FamilyPaymentOut],
    status_code=201,
)
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


@router.post("/payments/{payment_id}/report-paid", response_model=FamilyPaymentOut)
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


@router.post("/payments/{payment_id}/cancel-report", response_model=FamilyPaymentOut)
def post_payment_cancel_report(
    payment_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyPaymentOut:
    payment = cancel_payment_report(db, user, payment_id)
    return to_payment_out(payment)


@router.post(
    "/payments/{payment_id}/confirm",
    response_model=PaymentConfirmationResult,
)
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


@router.post("/payments/{payment_id}/not-received", response_model=FamilyPaymentOut)
def post_payment_not_received(
    payment_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyPaymentOut:
    payment = mark_payment_not_received(db, user, payment_id)
    return to_payment_out(payment)


@router.get("/{family_id}/view", response_model=FamilyViewOut)
def get_family_detail_view(
    family_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyViewOut:
    return get_family_view(db, user, family_id)


@router.get("/{family_id}/audit-log", response_model=list[FamilyAuditLogOut])
def get_family_audit_log(
    family_id: UUID,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0, le=MAX_PAGE_OFFSET),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> list[FamilyAuditLogOut]:
    return [
        to_audit_log_out(item)
        for item in list_family_audit_logs(
            db, user, family_id, limit=limit, offset=offset
        )
    ]


@router.get("/{family_id}/audit-log/page", response_model=FamilyAuditLogPageOut)
def get_family_audit_log_page(
    family_id: UUID,
    limit: int = Query(default=50, ge=1, le=100),
    cursor: str | None = Query(
        default=None,
        min_length=1,
        max_length=MAX_CURSOR_LENGTH,
    ),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyAuditLogPageOut:
    items, next_cursor = list_family_audit_logs_page(
        db,
        user,
        family_id,
        limit=limit,
        cursor=cursor,
    )
    return FamilyAuditLogPageOut(
        items=[to_audit_log_out(item) for item in items],
        next_cursor=next_cursor,
    )


@router.get("/{family_id}", response_model=FamilyOut)
def get_family(
    family_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyOut:
    family = get_family_by_id(db, family_id)
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")
    return to_family_out(family)
