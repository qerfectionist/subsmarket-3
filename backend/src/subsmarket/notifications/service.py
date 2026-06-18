from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from subsmarket.core.database import utcnow
from subsmarket.notifications.models import NotificationJob


def enqueue_notification(
    db: Session,
    *,
    recipient_user_id: UUID,
    event_type: str,
    payload: dict[str, Any],
    available_at: datetime | None = None,
) -> NotificationJob:
    job = NotificationJob(
        recipient_user_id=recipient_user_id,
        event_type=event_type,
        payload=payload,
        available_at=available_at or utcnow(),
        status="pending",
    )
    db.add(job)
    return job
