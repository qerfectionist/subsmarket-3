from __future__ import annotations

import json
from dataclasses import dataclass

from subsmarket.core.config import settings

DEFAULT_PAYMENT_SECRET = "dev-payment-requisite-secret-change-me"


@dataclass(frozen=True)
class ConfigCheck:
    key: str
    ok: bool
    problem: str | None = None


def check_production_config() -> list[ConfigCheck]:
    checks = [
        _present("APP_ENV", settings.app_env),
        _equals("APP_ENV", settings.app_env, "production"),
        _present("DATABASE_URL", settings.database_url),
        _positive_int("DB_POOL_SIZE", settings.db_pool_size),
        _non_negative_int("DB_MAX_OVERFLOW", settings.db_max_overflow),
        _positive_int(
            "DB_POOL_TIMEOUT_SECONDS",
            settings.db_pool_timeout_seconds,
        ),
        _positive_int(
            "DB_POOL_RECYCLE_SECONDS",
            settings.db_pool_recycle_seconds,
        ),
        _positive_int(
            "DB_CONNECT_TIMEOUT_SECONDS",
            settings.db_connect_timeout_seconds,
        ),
        _database_connection_budget(
            settings.db_pool_size,
            settings.db_max_overflow,
        ),
        _present("TELEGRAM_BOT_TOKEN", settings.telegram_bot_token),
        _https_url("TELEGRAM_MINI_APP_URL", settings.telegram_mini_app_url),
        _https_url("TELEGRAM_WEBHOOK_URL", settings.telegram_webhook_url),
        _present("TELEGRAM_WEBHOOK_SECRET", settings.telegram_webhook_secret),
        _present("PAYMENT_REQUISITE_SECRET", settings.payment_requisite_secret),
        _not_default(
            "PAYMENT_REQUISITE_SECRET",
            settings.payment_requisite_secret,
            DEFAULT_PAYMENT_SECRET,
        ),
        _present("INTERNAL_JOB_TOKEN", settings.internal_job_token),
        _production_origins(settings.cors_origins),
        _positive_int("NOTIFICATION_MAX_ATTEMPTS", settings.notification_max_attempts),
        _positive_int(
            "NOTIFICATION_RETRY_BASE_SECONDS",
            settings.notification_retry_base_seconds,
        ),
        _positive_int(
            "NOTIFICATION_RETRY_MAX_SECONDS",
            settings.notification_retry_max_seconds,
        ),
        _positive_int(
            "ACCESS_REMINDER_COOLDOWN_SECONDS",
            settings.access_reminder_cooldown_seconds,
        ),
        _bounded_int(
            "JOB_BATCH_SIZE",
            settings.job_batch_size,
            minimum=1,
            maximum=1000,
        ),
    ]
    if (
        settings.telegram_webhook_url
        and not settings.telegram_webhook_url.endswith("/api/telegram/webhook")
    ):
        checks.append(
            ConfigCheck(
                key="TELEGRAM_WEBHOOK_URL",
                ok=False,
                problem="must end with /api/telegram/webhook",
            )
        )
    return checks


def _present(key: str, value: object | None) -> ConfigCheck:
    if value is None or value == "":
        return ConfigCheck(key=key, ok=False, problem="missing")
    return ConfigCheck(key=key, ok=True)


def _equals(key: str, value: str, expected: str) -> ConfigCheck:
    if value != expected:
        return ConfigCheck(key=key, ok=False, problem=f"must be {expected}")
    return ConfigCheck(key=key, ok=True)


def _not_default(key: str, value: str, default: str) -> ConfigCheck:
    if value == default:
        return ConfigCheck(key=key, ok=False, problem="must not use dev default")
    return ConfigCheck(key=key, ok=True)


def _positive_int(key: str, value: int) -> ConfigCheck:
    if value <= 0:
        return ConfigCheck(key=key, ok=False, problem="must be positive")
    return ConfigCheck(key=key, ok=True)


def _non_negative_int(key: str, value: int) -> ConfigCheck:
    if value < 0:
        return ConfigCheck(key=key, ok=False, problem="must be zero or positive")
    return ConfigCheck(key=key, ok=True)


def _bounded_int(
    key: str,
    value: int,
    *,
    minimum: int,
    maximum: int,
) -> ConfigCheck:
    if not minimum <= value <= maximum:
        return ConfigCheck(
            key=key,
            ok=False,
            problem=f"must be between {minimum} and {maximum}",
        )
    return ConfigCheck(key=key, ok=True)


def _database_connection_budget(pool_size: int, max_overflow: int) -> ConfigCheck:
    total = pool_size + max_overflow
    if total > 20:
        return ConfigCheck(
            key="DB_CONNECTION_BUDGET",
            ok=False,
            problem="DB_POOL_SIZE + DB_MAX_OVERFLOW must be 20 or less",
        )
    return ConfigCheck(key="DB_CONNECTION_BUDGET", ok=True)


def _https_url(key: str, value: str | None) -> ConfigCheck:
    if not value:
        return ConfigCheck(key=key, ok=False, problem="missing")
    if not value.startswith("https://"):
        return ConfigCheck(key=key, ok=False, problem="must start with https://")
    return ConfigCheck(key=key, ok=True)


def _production_origins(origins: list[str]) -> ConfigCheck:
    if not origins or "*" in origins:
        return ConfigCheck(
            key="CORS_ALLOWED_ORIGINS",
            ok=False,
            problem="must list production HTTPS origins",
        )
    if any(not origin.startswith("https://") for origin in origins):
        return ConfigCheck(
            key="CORS_ALLOWED_ORIGINS",
            ok=False,
            problem="all origins must start with https://",
        )
    return ConfigCheck(key="CORS_ALLOWED_ORIGINS", ok=True)


def main() -> None:
    checks = check_production_config()
    payload = {
        "ok": all(check.ok for check in checks),
        "checks": [
            {
                "key": check.key,
                "ok": check.ok,
                "problem": check.problem,
            }
            for check in checks
        ],
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    if not payload["ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
