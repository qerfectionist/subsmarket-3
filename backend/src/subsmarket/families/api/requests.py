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
    FamilyRequestOut,
    OwnerFamilyRequestOut,
    OwnerFamilyRequestPageOut,
)
from subsmarket.families.service import (
    approve_join_request,
    cancel_join_request,
    create_join_request,
    list_owner_family_requests,
    list_owner_family_requests_page,
    reject_join_request,
    to_family_request_out,
    to_owner_family_request_out,
)


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


def cancel_my_family_request(
    request_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyRequestOut:
    request = cancel_join_request(db, user, request_id)
    return to_family_request_out(request)


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


def approve_family_request(
    request_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyRequestOut:
    request = approve_join_request(db, user, request_id)
    return to_family_request_out(request)


def reject_family_request(
    request_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyRequestOut:
    request = reject_join_request(db, user, request_id)
    return to_family_request_out(request)
