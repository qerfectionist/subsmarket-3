from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from subsmarket.bot.api import router as bot_router
from subsmarket.catalog.api import router as catalog_router
from subsmarket.core.api import router as core_router
from subsmarket.core.config import settings
from subsmarket.core.rate_limit import RateLimitMiddleware
from subsmarket.dev.api import router as dev_router
from subsmarket.families.api import router as families_router
from subsmarket.identity.api import router as identity_router
from subsmarket.jobs.api import router as jobs_router


def validate_runtime_settings() -> None:
    if settings.is_development:
        return
    if "*" in settings.cors_origins:
        raise RuntimeError(
            "CORS_ALLOWED_ORIGINS must not include '*' outside development"
        )
    if not settings.telegram_webhook_secret:
        raise RuntimeError("TELEGRAM_WEBHOOK_SECRET is required outside development")


def create_app() -> FastAPI:
    validate_runtime_settings()
    app = FastAPI(title="SubsMarket API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(RateLimitMiddleware)

    app.include_router(core_router)
    app.include_router(identity_router)
    app.include_router(catalog_router)
    app.include_router(families_router)
    app.include_router(jobs_router)
    app.include_router(bot_router)
    if settings.is_development:
        app.include_router(dev_router)
    return app


app = create_app()
