from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def normalize_sqlalchemy_database_url(url: str) -> str:
    """Accept managed Postgres URLs from Render, Supabase, Neon, Railway, etc."""
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env", "../.env.local"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = Field(default="development", alias="APP_ENV")
    dev_auth_enabled: bool = Field(default=False, alias="DEV_AUTH_ENABLED")
    database_url: str = Field(
        default="postgresql+psycopg://subsmarket:subsmarket@localhost:5432/subsmarket",
        alias="DATABASE_URL",
    )
    db_pool_size: int = Field(default=5, ge=1, alias="DB_POOL_SIZE")
    db_max_overflow: int = Field(default=5, ge=0, alias="DB_MAX_OVERFLOW")
    db_pool_timeout_seconds: int = Field(
        default=30,
        ge=1,
        alias="DB_POOL_TIMEOUT_SECONDS",
    )
    db_pool_recycle_seconds: int = Field(
        default=1800,
        ge=1,
        alias="DB_POOL_RECYCLE_SECONDS",
    )
    db_connect_timeout_seconds: int = Field(
        default=10,
        ge=1,
        alias="DB_CONNECT_TIMEOUT_SECONDS",
    )
    telegram_bot_token: str | None = Field(default=None, alias="TELEGRAM_BOT_TOKEN")
    telegram_mini_app_url: str | None = Field(
        default=None, alias="TELEGRAM_MINI_APP_URL"
    )
    telegram_webhook_url: str | None = Field(default=None, alias="TELEGRAM_WEBHOOK_URL")
    telegram_webhook_secret: str | None = Field(
        default=None, alias="TELEGRAM_WEBHOOK_SECRET"
    )
    telegram_webhook_drop_pending_updates: bool = Field(
        default=False, alias="TELEGRAM_WEBHOOK_DROP_PENDING_UPDATES"
    )
    payment_requisite_secret: str = Field(
        default="dev-payment-requisite-secret-change-me",
        alias="PAYMENT_REQUISITE_SECRET",
    )
    internal_job_token: str | None = Field(default=None, alias="INTERNAL_JOB_TOKEN")
    rate_limit_redis_url: str | None = Field(
        default=None,
        alias="RATE_LIMIT_REDIS_URL",
    )
    sentry_dsn: str | None = Field(default=None, alias="SENTRY_DSN")
    sentry_traces_sample_rate: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        alias="SENTRY_TRACES_SAMPLE_RATE",
    )
    sentry_send_default_pii: bool = Field(
        default=False,
        alias="SENTRY_SEND_DEFAULT_PII",
    )
    sentry_release: str | None = Field(default=None, alias="SENTRY_RELEASE")
    cors_allowed_origins: str = Field(default="*", alias="CORS_ALLOWED_ORIGINS")
    notification_max_attempts: int = Field(default=5, alias="NOTIFICATION_MAX_ATTEMPTS")
    notification_retry_base_seconds: int = Field(
        default=60, alias="NOTIFICATION_RETRY_BASE_SECONDS"
    )
    notification_retry_max_seconds: int = Field(
        default=3600, alias="NOTIFICATION_RETRY_MAX_SECONDS"
    )
    notification_dispatch_batch_size: int = Field(
        default=100,
        ge=1,
        le=500,
        alias="NOTIFICATION_DISPATCH_BATCH_SIZE",
    )
    notification_dispatch_max_batches: int = Field(
        default=5,
        ge=1,
        le=20,
        alias="NOTIFICATION_DISPATCH_MAX_BATCHES",
    )
    access_reminder_cooldown_seconds: int = Field(
        default=600,
        alias="ACCESS_REMINDER_COOLDOWN_SECONDS",
    )
    job_batch_size: int = Field(default=200, ge=1, le=1000, alias="JOB_BATCH_SIZE")
    job_max_batches_per_step: int = Field(
        default=5,
        ge=1,
        le=20,
        alias="JOB_MAX_BATCHES_PER_STEP",
    )
    idempotency_retention_days: int = Field(
        default=30,
        ge=1,
        le=3650,
        alias="IDEMPOTENCY_RETENTION_DAYS",
    )
    marketplace_gb_enabled: bool = Field(
        default=False,
        alias="MARKETPLACE_GB_ENABLED",
    )
    marketplace_accounts_enabled: bool = Field(
        default=False,
        alias="MARKETPLACE_ACCOUNTS_ENABLED",
    )
    marketplace_account_listing_days: int = Field(
        default=30,
        ge=1,
        le=365,
        alias="MARKETPLACE_ACCOUNT_LISTING_DAYS",
    )
    marketplace_listing_days: int = Field(
        default=7,
        ge=1,
        le=365,
        alias="MARKETPLACE_LISTING_DAYS",
    )
    marketplace_listing_expiry_reminder_days: int = Field(
        default=1,
        ge=1,
        le=30,
        alias="MARKETPLACE_LISTING_EXPIRY_REMINDER_DAYS",
    )
    marketplace_request_reminder_delay_seconds: int = Field(
        default=7200,
        ge=60,
        alias="MARKETPLACE_REQUEST_REMINDER_DELAY_SECONDS",
    )
    marketplace_request_reminder_cooldown_seconds: int = Field(
        default=7200,
        ge=60,
        alias="MARKETPLACE_REQUEST_REMINDER_COOLDOWN_SECONDS",
    )

    demo_telegram_user_id: int = Field(default=100001, alias="DEMO_TELEGRAM_USER_ID")
    demo_telegram_username: str = Field(
        default="demo_user", alias="DEMO_TELEGRAM_USERNAME"
    )
    demo_telegram_first_name: str = Field(
        default="Demo", alias="DEMO_TELEGRAM_FIRST_NAME"
    )
    demo_activate_catalog: bool = Field(default=True, alias="DEMO_ACTIVATE_CATALOG")

    @property
    def project_root(self) -> Path:
        return Path(__file__).resolve().parents[4]

    @property
    def sqlalchemy_database_url(self) -> str:
        return normalize_sqlalchemy_database_url(self.database_url)

    @property
    def sqlalchemy_engine_kwargs(self) -> dict[str, Any]:
        kwargs: dict[str, Any] = {"pool_pre_ping": True}
        if self.sqlalchemy_database_url.startswith("sqlite"):
            return kwargs

        kwargs.update(
            {
                "pool_size": self.db_pool_size,
                "max_overflow": self.db_max_overflow,
                "pool_timeout": self.db_pool_timeout_seconds,
                "pool_recycle": self.db_pool_recycle_seconds,
            }
        )
        if self.sqlalchemy_database_url.startswith("postgresql+psycopg://"):
            kwargs["connect_args"] = {
                "connect_timeout": self.db_connect_timeout_seconds,
                "application_name": "subsmarket-api",
            }
        return kwargs

    @property
    def catalog_file(self) -> Path:
        return self.project_root / "data" / "family-services.json"

    @property
    def is_development(self) -> bool:
        return self.app_env == "development"

    @property
    def cors_origins(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.cors_allowed_origins.split(",")
            if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
