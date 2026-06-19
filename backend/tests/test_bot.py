from __future__ import annotations

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from subsmarket.bot.api import verify_webhook_secret
from subsmarket.bot.service import START_MESSAGE, handle_telegram_update
from subsmarket.bot.set_webhook import build_set_webhook_payload
from subsmarket.core.config import settings
from subsmarket.main import app


class FakeSender:
    def __init__(self) -> None:
        self.messages: list[tuple[int, str]] = []

    def send_message(self, telegram_user_id: int, text: str) -> None:
        self.messages.append((telegram_user_id, text))


def test_bot_start_sends_mini_app_intro() -> None:
    sender = FakeSender()
    result = handle_telegram_update(
        {
            "message": {
                "chat": {"id": 700001, "type": "private"},
                "text": "/start",
            }
        },
        sender=sender,
    )

    assert result["ok"] is True
    assert result["handled"] is True
    assert result["action"] == "START_SENT"
    assert sender.messages == [(700001, START_MESSAGE)]


def test_bot_ignores_group_updates() -> None:
    sender = FakeSender()
    result = handle_telegram_update(
        {
            "message": {
                "chat": {"id": -1001, "type": "group"},
                "text": "/start",
            }
        },
        sender=sender,
    )

    assert result["ok"] is True
    assert result["handled"] is False
    assert result["reason"] == "NON_PRIVATE_CHAT"
    assert sender.messages == []


def test_webhook_secret_is_required_in_production(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "telegram_webhook_secret", None)

    with pytest.raises(HTTPException) as exc:
        verify_webhook_secret(None)

    assert exc.value.status_code == 403
    assert exc.value.detail == "TELEGRAM_WEBHOOK_SECRET_REQUIRED"


def test_webhook_secret_dev_bypass_logs_warning(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    monkeypatch.setattr(settings, "app_env", "development")
    monkeypatch.setattr(settings, "telegram_webhook_secret", None)

    verify_webhook_secret(None)

    assert "accepting unsigned development webhook request" in caplog.text


def test_webhook_secret_must_match(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "telegram_webhook_secret", "secret")

    with pytest.raises(HTTPException) as exc:
        verify_webhook_secret("wrong")

    assert exc.value.status_code == 403
    assert exc.value.detail == "TELEGRAM_WEBHOOK_SECRET_INVALID"


def test_webhook_secret_accepts_valid_header(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "telegram_webhook_secret", "secret")

    verify_webhook_secret("secret")


def test_set_webhook_payload_uses_secret_token(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        settings,
        "telegram_webhook_url",
        "https://api.example.com/api/telegram/webhook",
    )
    monkeypatch.setattr(settings, "telegram_webhook_secret", "secret")
    monkeypatch.setattr(settings, "telegram_webhook_drop_pending_updates", True)

    payload = build_set_webhook_payload()

    assert payload == {
        "url": "https://api.example.com/api/telegram/webhook",
        "allowed_updates": ["message"],
        "drop_pending_updates": True,
        "secret_token": "secret",
    }


def test_webhook_endpoint_requires_valid_secret(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "telegram_webhook_secret", "secret")

    with TestClient(app) as client:
        response = client.post("/api/telegram/webhook", json={"update_id": 1})

    assert response.status_code == 403
    assert response.json()["detail"] == "TELEGRAM_WEBHOOK_SECRET_INVALID"


def test_webhook_endpoint_calls_handler(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    called: list[dict] = []

    def fake_handler(update: dict) -> dict:
        called.append(update)
        return {"ok": True, "handled": True}

    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "telegram_webhook_secret", "secret")
    monkeypatch.setattr("subsmarket.bot.api.handle_telegram_update", fake_handler)

    with TestClient(app) as client:
        response = client.post(
            "/api/telegram/webhook",
            headers={"X-Telegram-Bot-Api-Secret-Token": "secret"},
            json={"update_id": 1},
        )

    assert response.status_code == 200
    assert response.json() == {"ok": True, "handled": True}
    assert called == [{"update_id": 1}]
