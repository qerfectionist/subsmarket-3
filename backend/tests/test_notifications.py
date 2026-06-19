from __future__ import annotations

import logging
from collections.abc import Iterator
from datetime import timedelta

import httpx
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from subsmarket.core.config import settings
from subsmarket.core.database import Base, utcnow
from subsmarket.identity.models import User
from subsmarket.models import import_models
from subsmarket.notifications.dispatcher import (
    NotificationSendError,
    TelegramBotSender,
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


def make_notification(
    db: Session,
    user: User,
    *,
    attempts: int = 0,
    payload: dict[str, str] | None = None,
) -> NotificationJob:
    job = enqueue_notification(
        db,
        recipient_user_id=user.id,
        event_type="family_request_created_owner",
        payload=payload or {"message": "New request"},
    )
    job.attempts = attempts
    db.commit()
    db.refresh(job)
    return job


def test_dispatch_marks_notification_sent(
    db: Session, caplog: pytest.LogCaptureFixture
) -> None:
    user = make_user(db)
    job = make_notification(db, user)
    sender = FakeSender()
    caplog.set_level(logging.INFO, logger="subsmarket.notifications.dispatcher")

    result = dispatch_pending_notifications(db, sender=sender)

    db.refresh(job)
    assert result.selected == 1
    assert result.sent == 1
    assert result.retried == 0
    assert result.failed == 0
    assert job.status == "sent"
    assert job.attempts == 1
    assert sender.messages == [(user.telegram_user_id, "New request")]
    assert "Notification dispatch completed" in caplog.text
    assert "New request" not in caplog.text


def test_dispatch_trims_notification_message(db: Session) -> None:
    user = make_user(db)
    job = make_notification(db, user, payload={"message": "  New request  "})
    sender = FakeSender()

    result = dispatch_pending_notifications(db, sender=sender)

    db.refresh(job)
    assert result.sent == 1
    assert job.status == "sent"
    assert job.payload["message"] == "New request"
    assert sender.messages == [(user.telegram_user_id, "New request")]


def test_dispatch_processes_multiple_batches(db: Session) -> None:
    user = make_user(db)
    jobs = [
        make_notification(db, user, payload={"message": f"Message {index}"})
        for index in range(3)
    ]
    sender = FakeSender()

    result = dispatch_pending_notifications(
        db,
        limit=1,
        max_batches=3,
        sender=sender,
    )

    for job in jobs:
        db.refresh(job)
    assert result.selected == 3
    assert result.sent == 3
    assert result.retried == 0
    assert result.failed == 0
    assert [job.status for job in jobs] == ["sent", "sent", "sent"]
    assert len(sender.messages) == 3


def test_enqueue_notification_rejects_missing_user_message(db: Session) -> None:
    user = make_user(db)

    with pytest.raises(ValueError, match="NOTIFICATION_MESSAGE_MISSING"):
        enqueue_notification(
            db,
            recipient_user_id=user.id,
            event_type="family_request_created_owner",
            payload={"message": "   "},
        )


def test_dispatch_fails_existing_notification_without_user_message(
    db: Session,
) -> None:
    user = make_user(db)
    job = NotificationJob(
        recipient_user_id=user.id,
        event_type="family_request_created_owner",
        payload={"message": "   "},
        available_at=utcnow(),
        status="pending",
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    sender = FakeSender()

    result = dispatch_pending_notifications(db, sender=sender)

    db.refresh(job)
    assert result.selected == 1
    assert result.sent == 0
    assert result.retried == 0
    assert result.failed == 1
    assert job.status == "failed"
    assert job.attempts == 1
    assert "NOTIFICATION_MESSAGE_MISSING" in (job.error or "")
    assert sender.messages == []


def test_dispatch_retries_transient_notification_error(
    db: Session, caplog: pytest.LogCaptureFixture
) -> None:
    user = make_user(db)
    job = make_notification(db, user)
    error = NotificationSendError("rate limited", retry_after_seconds=120)
    caplog.set_level(logging.WARNING, logger="subsmarket.notifications.dispatcher")

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
    assert "Notification job scheduled for retry" in caplog.text
    assert "New request" not in caplog.text


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


def test_telegram_sender_includes_mini_app_button(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, object] = {}

    def fake_post(
        url: str,
        *,
        json: dict[str, object],
        timeout: float,
    ) -> httpx.Response:
        captured["url"] = url
        captured["json"] = json
        captured["timeout"] = timeout
        return httpx.Response(200, json={"ok": True})

    monkeypatch.setattr(
        "subsmarket.notifications.dispatcher.httpx.post",
        fake_post,
    )
    monkeypatch.setattr(settings, "telegram_mini_app_url", "https://mini.example.com")

    TelegramBotSender(bot_token="123456:test").send_message(700001, "Open app")

    assert captured["url"] == "https://api.telegram.org/bot123456:test/sendMessage"
    assert captured["timeout"] == 10.0
    assert captured["json"] == {
        "chat_id": 700001,
        "text": "Open app",
        "disable_web_page_preview": True,
        "reply_markup": {
            "inline_keyboard": [
                [
                    {
                        "text": "Открыть SubsMarket",
                        "web_app": {"url": "https://mini.example.com"},
                    }
                ]
            ]
        },
    }
