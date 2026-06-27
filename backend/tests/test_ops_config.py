from __future__ import annotations

import pytest

from subsmarket.core.config import settings
from subsmarket.ops.check_deploy_config import check_production_config


def test_production_config_checker_accepts_required_env(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "database_url", "postgresql://db.example/subsmarket")
    monkeypatch.setattr(settings, "db_pool_size", 5)
    monkeypatch.setattr(settings, "db_max_overflow", 5)
    monkeypatch.setattr(settings, "db_pool_timeout_seconds", 30)
    monkeypatch.setattr(settings, "db_pool_recycle_seconds", 1800)
    monkeypatch.setattr(settings, "db_connect_timeout_seconds", 10)
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
    monkeypatch.setattr(settings, "rate_limit_redis_url", "rediss://redis.example")
    monkeypatch.setattr(settings, "sentry_dsn", "https://sentry.example/1")
    monkeypatch.setattr(settings, "sentry_traces_sample_rate", 0.0)
    monkeypatch.setattr(settings, "sentry_send_default_pii", False)
    monkeypatch.setattr(
        settings,
        "cors_allowed_origins",
        "https://mini.example.com",
    )
    monkeypatch.setattr(settings, "notification_max_attempts", 5)
    monkeypatch.setattr(settings, "notification_retry_base_seconds", 60)
    monkeypatch.setattr(settings, "notification_retry_max_seconds", 3600)
    monkeypatch.setattr(settings, "access_reminder_cooldown_seconds", 600)
    monkeypatch.setattr(settings, "job_batch_size", 200)

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


def test_production_config_checker_rejects_excessive_db_connection_budget(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "database_url", "postgresql://db.example/subsmarket")
    monkeypatch.setattr(settings, "db_pool_size", 15)
    monkeypatch.setattr(settings, "db_max_overflow", 10)
    monkeypatch.setattr(settings, "db_pool_timeout_seconds", 30)
    monkeypatch.setattr(settings, "db_pool_recycle_seconds", 1800)
    monkeypatch.setattr(settings, "db_connect_timeout_seconds", 10)
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
    monkeypatch.setattr(settings, "rate_limit_redis_url", "rediss://redis.example")
    monkeypatch.setattr(settings, "sentry_dsn", "https://sentry.example/1")
    monkeypatch.setattr(settings, "sentry_send_default_pii", False)
    monkeypatch.setattr(
        settings,
        "cors_allowed_origins",
        "https://mini.example.com",
    )
    monkeypatch.setattr(settings, "notification_max_attempts", 5)
    monkeypatch.setattr(settings, "notification_retry_base_seconds", 60)
    monkeypatch.setattr(settings, "notification_retry_max_seconds", 3600)
    monkeypatch.setattr(settings, "access_reminder_cooldown_seconds", 600)
    monkeypatch.setattr(settings, "job_batch_size", 200)

    checks = check_production_config()
    failed = {check.key: check.problem for check in checks if not check.ok}

    assert failed["DB_CONNECTION_BUDGET"] == (
        "DB_POOL_SIZE + DB_MAX_OVERFLOW must be 20 or less"
    )


def test_runtime_settings_reject_wildcard_cors_in_production(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from subsmarket.main import create_app

    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "cors_allowed_origins", "*")
    monkeypatch.setattr(settings, "telegram_webhook_secret", "secret")

    with pytest.raises(RuntimeError, match="CORS_ALLOWED_ORIGINS"):
        create_app()


def test_runtime_settings_reject_missing_webhook_secret_in_production(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from subsmarket.main import create_app

    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "cors_allowed_origins", "https://mini.example.com")
    monkeypatch.setattr(settings, "telegram_webhook_secret", None)

    with pytest.raises(RuntimeError, match="TELEGRAM_WEBHOOK_SECRET"):
        create_app()


def test_production_config_checker_rejects_invalid_optional_redis_url(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "rate_limit_redis_url", "https://not-redis")

    checks = check_production_config()
    failed = {check.key: check.problem for check in checks if not check.ok}

    assert failed["RATE_LIMIT_REDIS_URL"] == (
        "must start with redis:// or rediss://"
    )


def test_production_config_checker_requires_redis_in_production(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "rate_limit_redis_url", None)

    checks = check_production_config()
    failed = {check.key: check.problem for check in checks if not check.ok}

    assert failed["RATE_LIMIT_REDIS_URL"] == "missing"


def test_production_config_checker_rejects_invalid_optional_sentry_dsn(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "sentry_dsn", "not-a-url")

    checks = check_production_config()
    failed = {check.key: check.problem for check in checks if not check.ok}

    assert failed["SENTRY_DSN"] == "must start with http:// or https://"


def test_production_config_checker_requires_sentry_in_production(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "sentry_dsn", None)

    checks = check_production_config()
    failed = {check.key: check.problem for check in checks if not check.ok}

    assert failed["SENTRY_DSN"] == "missing"


def test_production_config_checker_rejects_sentry_pii_in_production(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "sentry_send_default_pii", True)

    checks = check_production_config()
    failed = {check.key: check.problem for check in checks if not check.ok}

    assert failed["SENTRY_SEND_DEFAULT_PII"] == "must be false in production"


def test_production_config_checker_rejects_invalid_sentry_sample_rate(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "sentry_traces_sample_rate", 1.5)

    checks = check_production_config()
    failed = {check.key: check.problem for check in checks if not check.ok}

    assert failed["SENTRY_TRACES_SAMPLE_RATE"] == "must be between 0 and 1"
