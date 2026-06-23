from __future__ import annotations

import re
import secrets
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from subsmarket.core.database import utcnow
from subsmarket.families._internal import _get_owned_family_for_update
from subsmarket.families.audit import record_family_audit_event
from subsmarket.families.models import Family, FamilyInvite
from subsmarket.families.queries import get_family_view
from subsmarket.families.schemas import FamilyViewOut
from subsmarket.identity.models import User


def get_family_invite(
    db: Session,
    user: User,
    family_id: UUID,
) -> FamilyInvite | None:
    family = db.get(Family, family_id)
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")
    if family.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="ONLY_OWNER_CAN_VIEW_INVITE")
    return db.scalar(
        select(FamilyInvite)
        .where(FamilyInvite.family_id == family_id)
        .where(FamilyInvite.status == "active")
    )


def create_family_invite(
    db: Session,
    user: User,
    family_id: UUID,
) -> FamilyInvite:
    family = _get_owned_family_for_update(db, user, family_id)
    _ensure_family_can_manage_invite(family)
    existing = db.scalar(
        select(FamilyInvite)
        .where(FamilyInvite.family_id == family.id)
        .where(FamilyInvite.status == "active")
        .with_for_update()
    )
    if existing is not None:
        return existing

    invite = _insert_family_invite(db, family.id)
    record_family_audit_event(
        db,
        family_id=family.id,
        action="family_invite_created",
        actor_user_id=user.id,
    )
    db.flush()
    db.refresh(invite)
    return invite


def rotate_family_invite(
    db: Session,
    user: User,
    family_id: UUID,
) -> FamilyInvite:
    family = _get_owned_family_for_update(db, user, family_id)
    _ensure_family_can_manage_invite(family)
    _revoke_active_family_invite(db, family.id, reason="rotated")
    invite = _insert_family_invite(db, family.id)
    record_family_audit_event(
        db,
        family_id=family.id,
        action="family_invite_rotated",
        actor_user_id=user.id,
    )
    db.flush()
    db.refresh(invite)
    return invite


def disable_family_invite(
    db: Session,
    user: User,
    family_id: UUID,
) -> None:
    family = _get_owned_family_for_update(db, user, family_id)
    invite = _revoke_active_family_invite(db, family.id, reason="owner_disabled")
    if invite is None:
        raise HTTPException(status_code=409, detail="FAMILY_INVITE_NOT_ACTIVE")
    record_family_audit_event(
        db,
        family_id=family.id,
        action="family_invite_disabled",
        actor_user_id=user.id,
    )
    db.flush()


def resolve_family_invite(
    db: Session,
    user: User,
    raw_code: str,
) -> FamilyViewOut:
    code = normalize_family_invite_code(raw_code)
    invite = db.scalar(
        select(FamilyInvite)
        .options(joinedload(FamilyInvite.family))
        .where(FamilyInvite.code == code)
    )
    if invite is None:
        raise HTTPException(status_code=404, detail="FAMILY_INVITE_NOT_FOUND")
    family = invite.family
    if invite.status != "active" or family.status in {"closing", "closed"}:
        raise HTTPException(status_code=410, detail="FAMILY_INVITE_INACTIVE")
    return get_family_view(db, user, family.id)


def normalize_family_invite_code(value: str) -> str:
    code = re.sub(r"[\s-]", "", value.strip())
    if not re.fullmatch(r"\d{8}", code):
        raise HTTPException(status_code=400, detail="INVALID_FAMILY_INVITE_CODE")
    return code


def _ensure_family_can_manage_invite(family: Family) -> None:
    if family.status not in {"active", "full"}:
        raise HTTPException(status_code=409, detail="FAMILY_INVITE_NOT_EDITABLE")


def _insert_family_invite(db: Session, family_id: UUID) -> FamilyInvite:
    for _ in range(20):
        code = f"{secrets.randbelow(100_000_000):08d}"
        if db.scalar(select(FamilyInvite.id).where(FamilyInvite.code == code)):
            continue
        invite = FamilyInvite(family_id=family_id, code=code, status="active")
        savepoint = db.begin_nested()
        try:
            db.add(invite)
            db.flush()
        except IntegrityError:
            savepoint.rollback()
            continue
        savepoint.commit()
        return invite
    raise RuntimeError("Could not allocate a unique family invite code")


def _revoke_active_family_invite(
    db: Session,
    family_id: UUID,
    *,
    reason: str,
) -> FamilyInvite | None:
    invite = db.scalar(
        select(FamilyInvite)
        .where(FamilyInvite.family_id == family_id)
        .where(FamilyInvite.status == "active")
        .with_for_update()
    )
    if invite is None:
        return None
    invite.status = "revoked"
    invite.revoked_reason = reason
    invite.revoked_at = utcnow()
    db.flush()
    return invite
