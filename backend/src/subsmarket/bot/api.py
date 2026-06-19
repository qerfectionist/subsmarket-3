from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Header, HTTPException

from subsmarket.bot.service import handle_telegram_update
from subsmarket.core.config import settings

router = APIRouter(prefix="/api/telegram", tags=["telegram-bot"])
logger = logging.getLogger(__name__)


def verify_webhook_secret(secret_header: str | None) -> None:
    expected_secret = settings.telegram_webhook_secret
    if not expected_secret:
        if settings.is_development:
            logger.warning(
                "Telegram webhook secret is not set; accepting unsigned "
                "development webhook request"
            )
            return
        raise HTTPException(status_code=403, detail="TELEGRAM_WEBHOOK_SECRET_REQUIRED")
    if secret_header != expected_secret:
        raise HTTPException(status_code=403, detail="TELEGRAM_WEBHOOK_SECRET_INVALID")


@router.post("/webhook")
def post_telegram_webhook(
    update: dict[str, Any],
    x_telegram_bot_api_secret_token: str | None = Header(default=None),
) -> dict[str, Any]:
    verify_webhook_secret(x_telegram_bot_api_secret_token)
    return handle_telegram_update(update)
