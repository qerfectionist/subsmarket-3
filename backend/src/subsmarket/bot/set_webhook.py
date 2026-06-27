from __future__ import annotations

import httpx

from subsmarket.core.config import settings


def build_set_webhook_payload() -> dict[str, object]:
    if not settings.telegram_webhook_url:
        raise RuntimeError("TELEGRAM_WEBHOOK_URL_NOT_CONFIGURED")

    payload: dict[str, object] = {
        "url": settings.telegram_webhook_url,
        "allowed_updates": ["message"],
        "drop_pending_updates": settings.telegram_webhook_drop_pending_updates,
    }
    if settings.telegram_webhook_secret:
        payload["secret_token"] = settings.telegram_webhook_secret
    return payload


def set_webhook() -> dict[str, object]:
    if not settings.telegram_bot_token:
        raise RuntimeError("TELEGRAM_BOT_TOKEN_NOT_CONFIGURED")

    try:
        response = httpx.post(
            f"https://api.telegram.org/bot{settings.telegram_bot_token}/setWebhook",
            json=build_set_webhook_payload(),
            timeout=10.0,
        )
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise RuntimeError(
            f"TELEGRAM_SET_WEBHOOK_HTTP_ERROR: {type(exc).__name__}"
        ) from None
    payload = response.json()
    if not payload.get("ok"):
        raise RuntimeError(f"TELEGRAM_SET_WEBHOOK_FAILED: {payload}")
    return payload


def main() -> None:
    result = set_webhook()
    print(result)


if __name__ == "__main__":
    main()
