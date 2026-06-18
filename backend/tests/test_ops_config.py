from __future__ import annotations

import pytest

from subsmarket.core.config import settings
from subsmarket.ops.check_deploy_config import check_production_config


def test_production_config_checker_accepts_required_env(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "database_url", "postgresql://db.example/subsmarket")
    monkeypatch.setattr(settings, "telegram_bot_token", "123456:secret")
    monkeypatch.setattr(
        settings,
        "telegram_mini_app_url",
        "https://mini.example.com",
    )
    monkeypatch.setattr(
        settings,
        "telegram_webhook_url",
        "https://api.example.com/api/telegram/webhook",
    )
    monkeypatch.setattr(settings, "telegram_webhook_secret", "secret")
    monkeypatch.setattr(settings, "payment_requisite_secret", "prod-secret")
    monkeypatch.setattr(settings, "internal_job_token", "job-secret")
    monkeypatch.setattr(
        settings,
        "cors_allowed_origins",
        "https://mini.example.com",
    )
    monkeypatch.setattr(settings, "notification_max_attempts", 5)
    monkeypatch.setattr(settings, "notification_retry_base_seconds", 60)
    monkeypatch.setattr(settings, "notification_retry_max_seconds", 3600)
    monkeypatch.setattr(settings, "access_reminder_cooldown_seconds", 600)

    checks = check_production_config()

    assert all(check.ok for check in checks)


def test_production_config_checker_rejects_dev_defaults(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "app_env", "development")
    monkeypatch.setattr(settings, "telegram_bot_token", None)
    monkeypatch.setattr(settings, "telegram_mini_app_url", "http://localhost:5173")
    monkeypatch.setattr(settings, "telegram_webhook_url", None)
    monkeypatch.setattr(settings, "telegram_webhook_secret", None)
    monkeypatch.setattr(
        settings,
        "payment_requisite_secret",
        "dev-payment-requisite-secret-change-me",
    )
    monkeypatch.setattr(settings, "internal_job_token", None)
    monkeypatch.setattr(settings, "cors_allowed_origins", "*")

    checks = check_production_config()
    failed = {check.key for check in checks if not check.ok}

    assert "APP_ENV" in failed
    assert "TELEGRAM_BOT_TOKEN" in failed
    assert "TELEGRAM_MINI_APP_URL" in failed
    assert "TELEGRAM_WEBHOOK_URL" in failed
    assert "TELEGRAM_WEBHOOK_SECRET" in failed
    assert "PAYMENT_REQUISITE_SECRET" in failed
    assert "INTERNAL_JOB_TOKEN" in failed
    assert "CORS_ALLOWED_ORIGINS" in failed
