from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from subsmarket.core.database import utcnow
from subsmarket.notifications.models import NotificationJob


def notification_payload_message(payload: dict[str, Any]) -> str:
    message = payload.get("message")
    if not isinstance(message, str) or not message.strip():
        raise ValueError("NOTIFICATION_MESSAGE_MISSING")
    return message.strip()


def enqueue_notification(
    db: Session,
    *,
    recipient_user_id: UUID,
    event_type: str,
    payload: dict[str, Any],
    available_at: datetime | None = None,
) -> NotificationJob:
    normalized_payload = {**payload, "message": notification_payload_message(payload)}
    job = NotificationJob(
        recipient_user_id=recipient_user_id,
        event_type=event_type,
        payload=normalized_payload,
        available_at=available_at or utcnow(),
        status="pending",
    )
    db.add(job)
    return job
