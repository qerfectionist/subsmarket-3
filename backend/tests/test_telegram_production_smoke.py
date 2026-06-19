from __future__ import annotations

from subsmarket.ops.telegram_production_smoke import validate_telegram_state


def test_telegram_production_smoke_accepts_matching_state() -> None:
    problems = validate_telegram_state(
        expected_webhook_url="https://api.example.com/api/telegram/webhook",
        expected_mini_app_url="https://mini.example.com",
        bot={"username": "subsmarket_bot"},
        webhook={
            "url": "https://api.example.com/api/telegram/webhook",
            "allowed_updates": ["message"],
            "last_error_message": None,
        },
        menu_button={
            "type": "web_app",
            "web_app": {"url": "https://mini.example.com/"},
        },
        mini_app_status=200,
    )

    assert problems == []


def test_telegram_production_smoke_reports_mismatches() -> None:
    problems = validate_telegram_state(
        expected_webhook_url="https://api.example.com/api/telegram/webhook",
        expected_mini_app_url="https://mini.example.com",
        bot={},
        webhook={
            "url": "https://old.example.com/webhook",
            "allowed_updates": [],
            "last_error_message": "delivery failed",
        },
        menu_button={
            "type": "web_app",
            "web_app": {"url": "https://old.example.com"},
        },
        mini_app_status=503,
    )

    assert problems == [
        "bot username is missing",
        "Telegram webhook URL does not match production config",
        "Telegram webhook error: delivery failed",
        "Telegram webhook does not accept message updates",
        "Telegram menu button URL does not match Mini App URL",
        "Mini App returned HTTP 503",
    ]
