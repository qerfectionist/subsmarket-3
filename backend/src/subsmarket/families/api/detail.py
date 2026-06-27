from __future__ import annotations

from uuid import UUID

from fastapi import Depends, HTTPException, Query
from sqlalchemy.orm import Session

from subsmarket.core.database import get_db
from subsmarket.families.api.deps import (
    MAX_CURSOR_LENGTH,
    MAX_PAGE_OFFSET,
    get_current_user,
)
from subsmarket.families.schemas import (
    FamilyAuditLogOut,
    FamilyAuditLogPageOut,
    FamilyOut,
    FamilyViewOut,
)
from subsmarket.families.service import (
    get_family_by_id,
    get_family_view,
    list_family_audit_logs,
    list_family_audit_logs_page,
    to_audit_log_out,
    to_family_out,
)


def get_family_detail_view(
    family_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyViewOut:
    return get_family_view(db, user, family_id)


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


def get_family(
    family_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyOut:
    family = get_family_by_id(db, family_id)
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")
    return to_family_out(family)
