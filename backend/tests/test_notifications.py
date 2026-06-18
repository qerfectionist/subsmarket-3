from __future__ import annotations

from collections.abc import Iterator
from datetime import timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from subsmarket.core.database import Base
from subsmarket.identity.models import User
from subsmarket.models import import_models
from subsmarket.notifications.dispatcher import (
    NotificationSendError,
    build_send_message_payload,
    dispatch_pending_notifications,
)
from subsmarket.notifications.models import NotificationJob
from subsmarket.notifications.service import enqueue_notification


@pytest.fixture()
def db() -> Iterator[Session]:
    import_models()
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with SessionLocal() as session:
        yield session
    Base.metadata.drop_all(engine)
    engine.dispose()


class FakeSender:
    def __init__(self, error: Exception | None = None) -> None:
        self.error = error
        self.messages: list[tuple[int, str]] = []

    def send_message(self, telegram_user_id: int, text: str) -> None:
        if self.error:
            raise self.error
        self.messages.append((telegram_user_id, text))


def make_user(db: Session) -> User:
    user = User(
        telegram_user_id=700001,
        username="notify_user",
        first_name="Notify",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def make_notification(db: Session, user: User, *, attempts: int = 0) -> NotificationJob:
    job = enqueue_notification(
        db,
        recipient_user_id=user.id,
        event_type="family_request_created_owner",
        payload={"message": "New request"},
    )
    job.attempts = attempts
    db.commit()
    db.refresh(job)
    return job


def test_dispatch_marks_notification_sent(db: Session) -> None:
    user = make_user(db)
    job = make_notification(db, user)
    sender = FakeSender()

    result = dispatch_pending_notifications(db, sender=sender)

    db.refresh(job)
    assert result.selected == 1
    assert result.sent == 1
    assert result.retried == 0
    assert result.failed == 0
    assert job.status == "sent"
    assert job.attempts == 1
    assert sender.messages == [(user.telegram_user_id, "New request")]


def test_dispatch_retries_transient_notification_error(db: Session) -> None:
    user = make_user(db)
    job = make_notification(db, user)
    error = NotificationSendError("rate limited", retry_after_seconds=120)

    result = dispatch_pending_notifications(db, sender=FakeSender(error))

    db.refresh(job)
    assert result.selected == 1
    assert result.sent == 0
    assert result.retried == 1
    assert result.failed == 0
    assert job.status == "pending"
    assert job.attempts == 1
    assert job.failed_at is not None
    assert job.available_at - job.failed_at >= timedelta(seconds=100)
    assert "rate limited" in (job.error or "")


def test_dispatch_fails_permanent_notification_error(db: Session) -> None:
    user = make_user(db)
    job = make_notification(db, user)
    error = NotificationSendError("chat not found", permanent=True)

    result = dispatch_pending_notifications(db, sender=FakeSender(error))

    db.refresh(job)
    assert result.selected == 1
    assert result.sent == 0
    assert result.retried == 0
    assert result.failed == 1
    assert job.status == "failed"
    assert job.attempts == 1
    assert "chat not found" in (job.error or "")


def test_dispatch_fails_after_max_attempts(db: Session) -> None:
    user = make_user(db)
    job = make_notification(db, user, attempts=4)
    error = NotificationSendError("network timeout")

    result = dispatch_pending_notifications(db, sender=FakeSender(error))

    db.refresh(job)
    assert result.selected == 1
    assert result.sent == 0
    assert result.retried == 0
    assert result.failed == 1
    assert job.status == "failed"
    assert job.attempts == 5


def test_send_message_payload_can_include_mini_app_button() -> None:
    payload = build_send_message_payload(
        700001,
        "Open app",
        mini_app_url="https://mini.example.com",
    )

    assert payload["chat_id"] == 700001
    assert payload["text"] == "Open app"
    assert payload["reply_markup"] == {
        "inline_keyboard": [
            [
                {
                    "text": "Открыть SubsMarket",
                    "web_app": {"url": "https://mini.example.com"},
                }
            ]
        ]
    }
