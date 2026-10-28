"""«Не работает»: the member checked the access and it does not work.

Nobody from SubsMarket steps in. The member goes back to «ждёт доступ», the
owner gets a notification and can fix the invite and press «Доступ выдан»
again. Payment details stay hidden until the member presses «Всё работает».
"""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from subsmarket.core.database import utcnow
from subsmarket.families.audit import record_family_audit_event
from subsmarket.families.models import Family, FamilyMember
from subsmarket.identity.models import User
from subsmarket.notifications.service import enqueue_notification


def report_access_issue(db: Session, user: User, member_id: UUID) -> FamilyMember:
    member = db.scalar(
        select(FamilyMember).where(FamilyMember.id == member_id).with_for_update()
    )
    if member is None:
        raise HTTPException(status_code=404, detail="FAMILY_MEMBER_NOT_FOUND")
    if member.user_id != user.id:
        raise HTTPException(status_code=403, detail="ONLY_MEMBER_CAN_REPORT_ACCESS")
    family = db.scalar(
        select(Family).where(Family.id == member.family_id).with_for_update()
    )
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")
    if family.status not in {"active", "full"}:
        raise HTTPException(status_code=409, detail="FAMILY_NOT_MUTABLE")
    if member.role == "owner" or member.status != "awaiting_confirmation":
        raise HTTPException(status_code=409, detail="MEMBER_NOT_AWAITING_CONFIRMATION")

    old_status = member.status
    member.status = "awaiting_access"
    member.access_provided_at = None
    member.access_issue_reported_at = utcnow()
    record_family_audit_event(
        db,
        family_id=family.id,
        action="family_access_issue_reported",
        actor_user_id=user.id,
        target_user_id=member.user_id,
        target_member_id=member.id,
        old_status=old_status,
        new_status=member.status,
    )
    who = f"@{user.username}" if user.username else "Участник"
    enqueue_notification(
        db,
        recipient_user_id=family.owner_user_id,
        event_type="family_access_issue_owner",
        payload={
            "family_id": str(family.id),
            "member_id": str(member.id),
            "message": (
                f"{who} пишет, что доступ к {family.service.name} не работает. "
                "Проверьте приглашение и снова нажмите «Доступ выдан»."
            ),
        },
    )
    db.flush()
    db.refresh(member)
    return member
