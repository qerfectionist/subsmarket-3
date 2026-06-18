from __future__ import annotations

from typing import Any

from subsmarket.notifications.dispatcher import TelegramBotSender

START_MESSAGE = (
    "SubsMarket помогает находить людей для семейной подписки или тарифа.\n\n"
    "Откройте Mini App, чтобы найти семью, создать свою семью и контролировать "
    "доступы и оплаты."
)


class BotUpdateResult(dict[str, Any]):
    pass


def handle_telegram_update(
    update: dict[str, Any],
    *,
    sender: TelegramBotSender | None = None,
) -> BotUpdateResult:
    message = update.get("message")
    if not isinstance(message, dict):
        return BotUpdateResult(ok=True, handled=False, reason="UNSUPPORTED_UPDATE")

    chat = message.get("chat")
    if not isinstance(chat, dict):
        return BotUpdateResult(ok=True, handled=False, reason="CHAT_MISSING")
    if chat.get("type") != "private":
        return BotUpdateResult(ok=True, handled=False, reason="NON_PRIVATE_CHAT")

    chat_id = chat.get("id")
    if not isinstance(chat_id, int):
        return BotUpdateResult(ok=True, handled=False, reason="CHAT_ID_INVALID")

    text = message.get("text")
    if isinstance(text, str) and text.strip().startswith("/start"):
        active_sender = sender or TelegramBotSender()
        active_sender.send_message(chat_id, START_MESSAGE)
        return BotUpdateResult(ok=True, handled=True, action="START_SENT")

    active_sender = sender or TelegramBotSender()
    active_sender.send_message(chat_id, START_MESSAGE)
    return BotUpdateResult(ok=True, handled=True, action="HELP_SENT")
