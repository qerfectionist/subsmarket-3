from __future__ import annotations

from functools import lru_cache
from pathlib import Path

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
    database_url: str = Field(
        default="postgresql+psycopg://subsmarket:subsmarket@localhost:5432/subsmarket",
        alias="DATABASE_URL",
    )
    telegram_bot_token: str | None = Field(default=None, alias="TELEGRAM_BOT_TOKEN")
    telegram_mini_app_url: str | None = Field(
        default=None, alias="TELEGRAM_MINI_APP_URL"
    )
    telegram_webhook_url: str | None = Field(
        default=None, alias="TELEGRAM_WEBHOOK_URL"
    )
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
    cors_allowed_origins: str = Field(default="*", alias="CORS_ALLOWED_ORIGINS")
    notification_max_attempts: int = Field(default=5, alias="NOTIFICATION_MAX_ATTEMPTS")
    notification_retry_base_seconds: int = Field(
        default=60, alias="NOTIFICATION_RETRY_BASE_SECONDS"
    )
    notification_retry_max_seconds: int = Field(
        default=3600, alias="NOTIFICATION_RETRY_MAX_SECONDS"
    )
    access_reminder_cooldown_seconds: int = Field(
        default=600,
        alias="ACCESS_REMINDER_COOLDOWN_SECONDS",
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
