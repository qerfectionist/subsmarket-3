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
    AccessConfirmationResult,
    FamilyMemberOut,
    FamilyMemberPageOut,
    FamilyMemberRemovalCreate,
    PaymentRequisiteOut,
)
from subsmarket.families.service import (
    cancel_member_before_access,
    confirm_access_received,
    get_open_payment_requisite,
    leave_family,
    list_family_members,
    list_family_members_page,
    mark_access_provided,
    remind_access_confirmation,
    remove_member,
    to_member_out,
)


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


def post_member_access_confirmation_reminder(
    member_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyMemberOut:
    member = remind_access_confirmation(db, user, member_id)
    return to_member_out(member)


def post_member_cancel_before_access(
    member_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyMemberOut:
    member = cancel_member_before_access(db, user, member_id)
    return to_member_out(member)


def post_member_leave(
    member_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyMemberOut:
    member = leave_family(db, user, member_id)
    return to_member_out(member)


def post_member_remove(
    member_id: UUID,
    payload: FamilyMemberRemovalCreate,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyMemberOut:
    member = remove_member(
        db,
        user,
        member_id,
        reason=payload.reason,
        idempotency_key=idempotency_key,
    )
    return to_member_out(member)


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


def get_member_payment_requisite(
    member_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> PaymentRequisiteOut:
    return get_open_payment_requisite(db, user, member_id)
