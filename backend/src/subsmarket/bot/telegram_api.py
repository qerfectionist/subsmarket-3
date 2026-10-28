from __future__ import annotations

from typing import Any, Protocol

import httpx

from subsmarket.core.config import settings

TELEGRAM_API_TIMEOUT_SECONDS = 10.0


class TelegramApiError(RuntimeError):
    pass


class TelegramApi(Protocol):
    def call(self, method: str, payload: dict[str, Any]) -> dict[str, Any]: ...


class HttpTelegramApi:
    """Plain Bot API calls for group chats (no Mini App buttons)."""

    def __init__(self, bot_token: str | None = None) -> None:
        self.bot_token = bot_token or settings.telegram_bot_token

    def call(self, method: str, payload: dict[str, Any]) -> dict[str, Any]:
        if not self.bot_token:
            raise TelegramApiError("TELEGRAM_BOT_TOKEN_NOT_CONFIGURED")
        try:
            response = httpx.post(
                f"https://api.telegram.org/bot{self.bot_token}/{method}",
                json=payload,
                timeout=TELEGRAM_API_TIMEOUT_SECONDS,
            )
        except httpx.HTTPError as exc:
            raise TelegramApiError(
                f"TELEGRAM_HTTP_ERROR: {type(exc).__name__}"
            ) from None
        try:
            body = response.json()
        except ValueError:
            body = {}
        if response.status_code >= 400 or not body.get("ok"):
            raise TelegramApiError(
                f"TELEGRAM_{method.upper()}_FAILED: {body.get('description', '')}"
            )
        result = body.get("result")
        return result if isinstance(result, dict) else {}
