from __future__ import annotations

from datetime import UTC, date, datetime, time, timedelta
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from subsmarket.core.config import settings
from subsmarket.core.database import KAZAKHSTAN_TIMEZONE, utcnow
from subsmarket.core.idempotency import claim_idempotency, complete_idempotency
from subsmarket.families._internal import (
    ACTIVE_MEMBER_STATUSES,
    MEMBER_REMOVAL_REASONS,
    _enqueue_family_members_notification,
    _get_member_for_update,
    _get_owned_family_for_update,
    _release_family_slot,
)
from subsmarket.families.audit import record_family_audit_event
from subsmarket.families.invites import _revoke_active_family_invite
from subsmarket.families.models import (
    Family,
    FamilyMember,
)
from subsmarket.families.payments import cancel_scheduled_payments
from subsmarket.families.queries import get_family_by_id
from subsmarket.families.requests import _cancel_pending_requests_for_closing_family
from subsmarket.identity.models import User
from subsmarket.notifications.models import NotificationJob
from subsmarket.notifications.service import enqueue_notification


def cancel_member_before_access(
    db: Session, user: User, member_id: UUID
) -> FamilyMember:
    member = _get_member_for_update(db, member_id)
    family = db.scalar(
        select(Family).where(Family.id == member.family_id).with_for_update()
    )
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")
    if family.status in {"closing", "closed"}:
        raise HTTPException(status_code=409, detail="FAMILY_NOT_MUTABLE")
    if user.id not in {member.user_id, family.owner_user_id}:
        raise HTTPException(status_code=403, detail="MEMBER_CANCEL_FORBIDDEN")
    if member.role == "owner":
        raise HTTPException(status_code=400, detail="OWNER_CANNOT_CANCEL_MEMBERSHIP")
    if member.status != "awaiting_access":
        raise HTTPException(status_code=409, detail="MEMBER_NOT_AWAITING_ACCESS")

    now = utcnow()
    old_status = member.status
    member.status = "cancelled_before_access"
    member.cancelled_at = now
    _release_family_slot(family)
    record_family_audit_event(
        db,
        family_id=family.id,
        action="family_member_cancelled_before_access",
        actor_user_id=user.id,
        target_user_id=member.user_id,
        target_member_id=member.id,
        old_status=old_status,
        new_status=member.status,
        details={"cancelled_by_owner": user.id == family.owner_user_id},
    )
    if user.id == family.owner_user_id:
        enqueue_notification(
            db,
            recipient_user_id=member.user_id,
            event_type="family_member_cancelled_before_access",
            payload={
                "family_id": str(family.id),
                "member_id": str(member.id),
                "message": "Владелец отменил вступление до выдачи доступа.",
            },
        )
    else:
        enqueue_notification(
            db,
            recipient_user_id=family.owner_user_id,
            event_type="family_member_cancelled_by_candidate",
            payload={
                "family_id": str(family.id),
                "member_id": str(member.id),
                "message": f"{user.first_name} отменил вступление до выдачи доступа.",
            },
        )
    db.flush()
    db.refresh(member)
    member.user = db.get(User, member.user_id)
    return member


def leave_family(db: Session, user: User, member_id: UUID) -> FamilyMember:
    member = _get_member_for_update(db, member_id)
    if member.user_id != user.id:
        raise HTTPException(status_code=403, detail="ONLY_MEMBER_CAN_LEAVE")
    if member.role == "owner":
        raise HTTPException(status_code=400, detail="OWNER_MUST_CLOSE_FAMILY")
    if member.status not in ACTIVE_MEMBER_STATUSES:
        raise HTTPException(status_code=409, detail="MEMBER_NOT_ACTIVE")

    family = db.scalar(
        select(Family).where(Family.id == member.family_id).with_for_update()
    )
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")
    old_status = member.status
    member.status = "left"
    member.left_at = utcnow()
    _release_family_slot(family)
    cancel_scheduled_payments(
        db,
        family_id=family.id,
        member_id=member.id,
        reason="member_left",
        actor_user_id=user.id,
    )
    record_family_audit_event(
        db,
        family_id=family.id,
        action="family_member_left",
        actor_user_id=user.id,
        target_user_id=member.user_id,
        target_member_id=member.id,
        old_status=old_status,
        new_status=member.status,
    )
    enqueue_notification(
        db,
        recipient_user_id=family.owner_user_id,
        event_type="family_member_left",
        payload={
            "family_id": str(family.id),
            "member_id": str(member.id),
            "message": f"{user.first_name} вышел из семьи.",
        },
    )
    db.flush()
    db.refresh(member)
    member.user = db.get(User, member.user_id)
    return member


def remove_member(
    db: Session,
    user: User,
    member_id: UUID,
    *,
    reason: str,
    idempotency_key: str | None = None,
) -> FamilyMember:
    if reason not in MEMBER_REMOVAL_REASONS:
        raise HTTPException(status_code=422, detail="INVALID_MEMBER_REMOVAL_REASON")

    claim = claim_idempotency(
        db,
        user_id=user.id,
        operation="family_member.remove",
        idempotency_key=idempotency_key,
        payload={"member_id": str(member_id), "reason": reason},
        resource_type="family_member",
    )
    if claim.is_replay:
        replayed_member = db.get(FamilyMember, claim.resource_id)
        if replayed_member is None:
            raise RuntimeError("Idempotent family member was not found")
        return replayed_member

    member = _get_member_for_update(db, member_id)
    family = db.scalar(
        select(Family).where(Family.id == member.family_id).with_for_update()
    )
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")
    if family.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="ONLY_OWNER_CAN_REMOVE_MEMBER")
    if member.role == "owner":
        raise HTTPException(status_code=400, detail="OWNER_CANNOT_REMOVE_SELF")
    if family.status not in {"active", "full"}:
        raise HTTPException(status_code=409, detail="FAMILY_NOT_MUTABLE")
    if member.status not in {"payment_due", "active", "awaiting_confirmation"}:
        raise HTTPException(status_code=409, detail="MEMBER_NOT_REMOVABLE")

    now = utcnow()
    old_status = member.status
    member.status = "removed"
    member.removal_reason = reason
    member.removed_at = now
    member.removal_scheduled_at = None
    member.removal_acknowledged_at = None
    member.removal_cancel_requested_at = None
    _release_family_slot(family)
    cancel_scheduled_payments(
        db,
        family_id=family.id,
        member_id=member.id,
        reason="member_removed",
        actor_user_id=user.id,
    )
    record_family_audit_event(
        db,
        family_id=family.id,
        action="family_member_removed_by_owner",
        actor_user_id=user.id,
        target_user_id=member.user_id,
        target_member_id=member.id,
        old_status=old_status,
        new_status=member.status,
        details={
            "reason": reason,
            "removed_at": member.removed_at.isoformat(),
        },
    )
    enqueue_notification(
        db,
        recipient_user_id=member.user_id,
        event_type="family_member_removed",
        payload={
            "family_id": str(family.id),
            "member_id": str(member.id),
            "reason": reason,
            "message": "Владелец удалил вас из семьи.",
        },
    )
    complete_idempotency(
        claim,
        resource_type="family_member",
        resource_id=member.id,
    )
    db.flush()
    db.refresh(member)
    member.user = db.get(User, member.user_id)
    return member


def close_family(
    db: Session,
    user: User,
    family_id: UUID,
    *,
    closes_on: date,
    idempotency_key: str | None = None,
) -> Family:
    if closes_on < utcnow().astimezone(KAZAKHSTAN_TIMEZONE).date():
        raise HTTPException(status_code=422, detail="FAMILY_CLOSE_DATE_IN_PAST")

    claim = claim_idempotency(
        db,
        user_id=user.id,
        operation="family.close",
        idempotency_key=idempotency_key,
        payload={"family_id": str(family_id), "closes_on": closes_on.isoformat()},
        resource_type="family",
    )
    if claim.is_replay:
        replayed_family = get_family_by_id(db, claim.resource_id)
        if replayed_family is None:
            raise RuntimeError("Idempotent family was not found")
        return replayed_family

    family = _get_owned_family_for_update(db, user, family_id)
    if family.status == "closed":
        raise HTTPException(status_code=409, detail="FAMILY_ALREADY_CLOSED")
    if family.status != "closing":
        now = utcnow()
        old_status = family.status
        family.status = "closing"
        family.is_search_visible = False
        family.closing_started_at = now
        family.closes_at = datetime.combine(
            closes_on,
            time.max,
            tzinfo=KAZAKHSTAN_TIMEZONE,
        ).astimezone(UTC)
        _revoke_active_family_invite(
            db,
            family.id,
            reason="family_closing",
        )
        cancel_scheduled_payments(
            db,
            family_id=family.id,
            reason="family_closing",
            actor_user_id=user.id,
        )
        _cancel_pending_requests_for_closing_family(db, family.id)
        record_family_audit_event(
            db,
            family_id=family.id,
            action="family_closing_started",
            actor_user_id=user.id,
            old_status=old_status,
            new_status=family.status,
            details={
                "closes_on": closes_on.isoformat(),
                "closes_at": family.closes_at.isoformat(),
            },
        )
        _enqueue_family_members_notification(
            db,
            family,
            event_type="family_closing_started",
            message=(
                f"Семья закрывается {closes_on.isoformat()}. "
                "Подтвердите, что увидели уведомление."
            ),
        )
    complete_idempotency(
        claim,
        resource_type="family",
        resource_id=family.id,
    )
    db.flush()
    loaded = get_family_by_id(db, family.id)
    if loaded is None:
        raise RuntimeError("Closed family was not found")
    return loaded


def acknowledge_family_closing(
    db: Session, user: User, family_id: UUID
) -> FamilyMember:
    member = db.scalar(
        select(FamilyMember)
        .where(FamilyMember.family_id == family_id)
        .where(FamilyMember.user_id == user.id)
        .where(FamilyMember.status.in_(ACTIVE_MEMBER_STATUSES))
        .with_for_update()
    )
    if member is None:
        raise HTTPException(status_code=404, detail="FAMILY_MEMBER_NOT_FOUND")
    family = db.get(Family, family_id)
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")
    if family.status != "closing":
        raise HTTPException(status_code=409, detail="FAMILY_NOT_CLOSING")

    if member.closing_acknowledged_at is not None:
        member.user = db.get(User, member.user_id)
        return member

    member.closing_acknowledged_at = utcnow()
    record_family_audit_event(
        db,
        family_id=family.id,
        action="family_closing_acknowledged",
        actor_user_id=user.id,
        target_user_id=member.user_id,
        target_member_id=member.id,
        details={
            "closing_acknowledged_at": member.closing_acknowledged_at.isoformat(),
        },
    )
    db.flush()
    db.refresh(member)
    member.user = db.get(User, member.user_id)
    return member


def mark_access_provided(
    db: Session,
    user: User,
    member_id: UUID,
    *,
    idempotency_key: str | None = None,
) -> FamilyMember:
    claim = claim_idempotency(
        db,
        user_id=user.id,
        operation="family_member.provide_access",
        idempotency_key=idempotency_key,
        payload={"member_id": str(member_id)},
        resource_type="family_member",
    )
    if claim.is_replay:
        replayed_member = db.get(FamilyMember, claim.resource_id)
        if replayed_member is None:
            raise RuntimeError("Idempotent family member was not found")
        return replayed_member

    member = db.scalar(
        select(FamilyMember).where(FamilyMember.id == member_id).with_for_update()
    )
    if member is None:
        raise HTTPException(status_code=404, detail="FAMILY_MEMBER_NOT_FOUND")
    family = db.scalar(
        select(Family).where(Family.id == member.family_id).with_for_update()
    )
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")
    if family.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="ONLY_OWNER_CAN_PROVIDE_ACCESS")
    if member.role == "owner":
        raise HTTPException(status_code=400, detail="OWNER_ACCESS_ALREADY_ACTIVE")
    if family.status not in {"active", "full"}:
        raise HTTPException(status_code=409, detail="FAMILY_NOT_MUTABLE")
    if member.status != "awaiting_access":
        raise HTTPException(status_code=409, detail="MEMBER_NOT_AWAITING_ACCESS")

    now = utcnow()
    old_status = member.status
    member.status = "awaiting_confirmation"
    member.access_provided_at = now
    record_family_audit_event(
        db,
        family_id=family.id,
        action="family_access_provided",
        actor_user_id=user.id,
        target_user_id=member.user_id,
        target_member_id=member.id,
        old_status=old_status,
        new_status=member.status,
        details={"access_provided_at": member.access_provided_at.isoformat()},
    )
    enqueue_notification(
        db,
        recipient_user_id=member.user_id,
        event_type="family_access_provided_member",
        payload={
            "family_id": str(member.family_id),
            "member_id": str(member.id),
            "message": (
                "Владелец отметил, что доступ выдан. "
                "Проверьте доступ и подтвердите получение."
            ),
        },
    )
    complete_idempotency(
        claim,
        resource_type="family_member",
        resource_id=member.id,
    )
    db.flush()
    db.refresh(member)
    return member


def remind_access_confirmation(
    db: Session, user: User, member_id: UUID
) -> FamilyMember:
    member = db.scalar(
        select(FamilyMember).where(FamilyMember.id == member_id).with_for_update()
    )
    if member is None:
        raise HTTPException(status_code=404, detail="FAMILY_MEMBER_NOT_FOUND")
    family = db.scalar(
        select(Family).where(Family.id == member.family_id).with_for_update()
    )
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")
    if family.owner_user_id != user.id:
        raise HTTPException(
            status_code=403,
            detail="ONLY_OWNER_CAN_REMIND_ACCESS_CONFIRMATION",
        )
    if family.status not in {"active", "full"}:
        raise HTTPException(status_code=409, detail="FAMILY_NOT_MUTABLE")
    if member.role == "owner" or member.status != "awaiting_confirmation":
        raise HTTPException(
            status_code=409,
            detail="MEMBER_NOT_AWAITING_CONFIRMATION",
        )

    now = utcnow()
    recent_job_id = db.scalar(
        select(NotificationJob.id)
        .where(NotificationJob.recipient_user_id == member.user_id)
        .where(
            NotificationJob.event_type == "family_access_confirmation_reminder_member"
        )
        .where(NotificationJob.payload["member_id"].as_string() == str(member.id))
        .where(
            NotificationJob.created_at
            >= now - timedelta(seconds=settings.access_reminder_cooldown_seconds)
        )
    )
    if recent_job_id is not None:
        raise HTTPException(status_code=429, detail="ACCESS_REMINDER_COOLDOWN")

    record_family_audit_event(
        db,
        family_id=family.id,
        action="family_access_confirmation_reminded",
        actor_user_id=user.id,
        target_user_id=member.user_id,
        target_member_id=member.id,
        details={"reminded_at": now.isoformat()},
    )
    enqueue_notification(
        db,
        recipient_user_id=member.user_id,
        event_type="family_access_confirmation_reminder_member",
        payload={
            "family_id": str(member.family_id),
            "member_id": str(member.id),
            "message": (
                "Владелец напоминает: проверьте доступ и подтвердите его получение "
                "в SubsMarket."
            ),
        },
    )
    db.flush()
    db.refresh(member)
    return member
