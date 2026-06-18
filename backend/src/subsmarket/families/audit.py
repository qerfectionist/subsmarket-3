from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from subsmarket.families.models import FamilyAuditLog


def record_family_audit_event(
    db: Session,
    *,
    family_id: UUID,
    action: str,
    actor_user_id: UUID | None = None,
    target_user_id: UUID | None = None,
    target_member_id: UUID | None = None,
    target_request_id: UUID | None = None,
    target_payment_id: UUID | None = None,
    old_status: str | None = None,
    new_status: str | None = None,
    details: dict[str, Any] | None = None,
) -> FamilyAuditLog:
    log = FamilyAuditLog(
        family_id=family_id,
        actor_user_id=actor_user_id,
        target_user_id=target_user_id,
        target_member_id=target_member_id,
        target_request_id=target_request_id,
        target_payment_id=target_payment_id,
        action=action,
        old_status=old_status,
        new_status=new_status,
        details=details or {},
    )
    db.add(log)
    return log
