from __future__ import annotations

import json
from typing import Any

import httpx

from subsmarket.core.config import settings


def _normalized_url(value: str | None) -> str:
    return (value or "").rstrip("/")


def validate_telegram_state(
    *,
    expected_webhook_url: str,
    expected_mini_app_url: str,
    bot: dict[str, Any],
    webhook: dict[str, Any],
    menu_button: dict[str, Any],
    mini_app_status: int,
) -> list[str]:
    problems: list[str] = []
    if not bot.get("username"):
        problems.append("bot username is missing")
    if _normalized_url(webhook.get("url")) != _normalized_url(
        expected_webhook_url
    ):
        problems.append("Telegram webhook URL does not match production config")
    if webhook.get("last_error_message"):
        problems.append(f"Telegram webhook error: {webhook['last_error_message']}")
    if "message" not in webhook.get("allowed_updates", []):
        problems.append("Telegram webhook does not accept message updates")

    menu_url = (menu_button.get("web_app") or {}).get("url")
    if menu_button.get("type") != "web_app":
        problems.append("Telegram menu button is not a web_app button")
    elif _normalized_url(menu_url) != _normalized_url(expected_mini_app_url):
        problems.append("Telegram menu button URL does not match Mini App URL")

    if mini_app_status != 200:
        problems.append(f"Mini App returned HTTP {mini_app_status}")
    return problems


def _telegram_result(client: httpx.Client, method: str) -> dict[str, Any]:
    try:
        response = client.get(method)
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise RuntimeError(
            f"Telegram {method} failed with HTTP {exc.response.status_code}"
        ) from None
    except httpx.HTTPError as exc:
        raise RuntimeError(f"Telegram {method} failed: {type(exc).__name__}") from None
    payload = response.json()
    if not payload.get("ok"):
        raise RuntimeError(f"Telegram {method} failed")
    return payload.get("result", {})


def main() -> None:
    if not settings.telegram_bot_token:
        raise SystemExit("TELEGRAM_BOT_TOKEN is required")
    if not settings.telegram_webhook_url:
        raise SystemExit("TELEGRAM_WEBHOOK_URL is required")
    if not settings.telegram_mini_app_url:
        raise SystemExit("TELEGRAM_MINI_APP_URL is required")

    base_url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/"
    with httpx.Client(base_url=base_url, timeout=20, follow_redirects=True) as client:
        bot = _telegram_result(client, "getMe")
        webhook = _telegram_result(client, "getWebhookInfo")
        menu_button = _telegram_result(client, "getChatMenuButton")
    mini_app_response = httpx.get(
        settings.telegram_mini_app_url,
        timeout=20,
        follow_redirects=True,
    )
    problems = validate_telegram_state(
        expected_webhook_url=settings.telegram_webhook_url,
        expected_mini_app_url=settings.telegram_mini_app_url,
        bot=bot,
        webhook=webhook,
        menu_button=menu_button,
        mini_app_status=mini_app_response.status_code,
    )
    payload = {
        "ok": not problems,
        "bot_username": bot.get("username"),
        "webhook_url": webhook.get("url"),
        "pending_update_count": webhook.get("pending_update_count", 0),
        "menu_button_url": (menu_button.get("web_app") or {}).get("url"),
        "mini_app_status": mini_app_response.status_code,
        "problems": problems,
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    if problems:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
