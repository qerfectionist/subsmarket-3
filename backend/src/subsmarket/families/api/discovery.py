from __future__ import annotations

from fastapi import Depends, Query
from sqlalchemy.orm import Session

from subsmarket.core.database import get_db
from subsmarket.families.api.deps import (
    MAX_CURSOR_LENGTH,
    MAX_PAGE_OFFSET,
    get_current_user,
)
from subsmarket.families.schemas import (
    FamilyOut,
    FamilyPageOut,
    FamilyPaymentOut,
    FamilyPaymentPageOut,
    FamilyRequestOut,
    FamilyRequestPageOut,
    FamilyViewOut,
    MyFamilyOut,
    MyFamilyPageOut,
)
from subsmarket.families.service import (
    list_my_families,
    list_my_families_page,
    list_my_join_requests,
    list_my_join_requests_page,
    list_my_payments,
    list_my_payments_page,
    list_searchable_families,
    list_searchable_families_page,
    resolve_family_invite,
    to_family_out,
    to_family_request_out,
    to_payment_out,
)


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


def get_my_families(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0, le=MAX_PAGE_OFFSET),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> list[MyFamilyOut]:
    return list_my_families(db, user, limit=limit, offset=offset)


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


def get_family_by_invite_code(
    code: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyViewOut:
    return resolve_family_invite(db, user, code)


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