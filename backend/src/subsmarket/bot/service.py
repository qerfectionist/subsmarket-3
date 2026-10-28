from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.orm import Session

from subsmarket.bot.telegram_api import HttpTelegramApi, TelegramApi, TelegramApiError
from subsmarket.families.chat import (
    TELEGRAM_START_RE,
    connect_telegram_chat,
    migrate_telegram_chat,
)
from subsmarket.notifications.dispatcher import TelegramBotSender

logger = logging.getLogger(__name__)

START_MESSAGE = (
    "SubsMarket помогает находить людей для семейной подписки или тарифа.\n\n"
    "Откройте Mini App, чтобы найти семью, создать свою семью и контролировать "
    "доступы и оплаты."
)
GROUP_CONNECTED_MESSAGE = (
    "Чат подключён к семье в SubsMarket. Участники получат ссылку на него, "
    "когда вы добавите их в семью."
)
GROUP_NEEDS_ADMIN_MESSAGE = (
    "Почти готово. Сделайте бота администратором с правом приглашать "
    "участников, затем снова нажмите «Создать чат» в SubsMarket."
)
GROUP_TAKEN_MESSAGE = (
    "Эта группа уже подключена к другой семье. Создайте для семьи отдельную группу."
)
GROUP_UNKNOWN_MESSAGE = (
    "Ссылка устарела. Откройте семью в SubsMarket и нажмите «Создать чат» ещё раз."
)
GROUP_CHAT_TYPES = {"group", "supergroup"}


class BotUpdateResult(dict[str, Any]):
    pass


def _reply(api: TelegramApi, chat_id: int, text: str) -> None:
    try:
        api.call("sendMessage", {"chat_id": chat_id, "text": text})
    except TelegramApiError as exc:
        logger.warning("Bot group reply failed: %s", exc)


def handle_group_message(
    message: dict[str, Any], chat_id: int, *, db: Session | None, api: TelegramApi
) -> BotUpdateResult:
    if db is None:
        return BotUpdateResult(ok=True, handled=False, reason="DB_UNAVAILABLE")

    new_chat_id = message.get("migrate_to_chat_id")
    if isinstance(new_chat_id, int):
        moved = migrate_telegram_chat(
            db, old_chat_id=chat_id, new_chat_id=new_chat_id, api=api
        )
        return BotUpdateResult(
            ok=True, handled=moved, action="FAMILY_CHAT_MIGRATED" if moved else None
        )

    text = message.get("text")
    match = TELEGRAM_START_RE.match(text.strip()) if isinstance(text, str) else None
    if match is None:
        return BotUpdateResult(ok=True, handled=False, reason="GROUP_MESSAGE_IGNORED")

    outcome, _chat = connect_telegram_chat(
        db, token=match.group(1), telegram_chat_id=chat_id, api=api
    )
    replies = {
        "connected": GROUP_CONNECTED_MESSAGE,
        "already_connected": GROUP_CONNECTED_MESSAGE,
        "needs_admin": GROUP_NEEDS_ADMIN_MESSAGE,
        "chat_taken": GROUP_TAKEN_MESSAGE,
        "unknown_token": GROUP_UNKNOWN_MESSAGE,
    }
    _reply(api, chat_id, replies[outcome])
    return BotUpdateResult(
        ok=True, handled=True, action=f"FAMILY_CHAT_{outcome.upper()}"
    )


def handle_telegram_update(
    update: dict[str, Any],
    *,
    db: Session | None = None,
    sender: TelegramBotSender | None = None,
    api: TelegramApi | None = None,
) -> BotUpdateResult:
    message = update.get("message")
    if not isinstance(message, dict):
        return BotUpdateResult(ok=True, handled=False, reason="UNSUPPORTED_UPDATE")

    chat = message.get("chat")
    if not isinstance(chat, dict):
        return BotUpdateResult(ok=True, handled=False, reason="CHAT_MISSING")

    chat_id = chat.get("id")
    if not isinstance(chat_id, int):
        return BotUpdateResult(ok=True, handled=False, reason="CHAT_ID_INVALID")

    if chat.get("type") in GROUP_CHAT_TYPES:
        return handle_group_message(
            message, chat_id, db=db, api=api or HttpTelegramApi()
        )
    if chat.get("type") != "private":
        return BotUpdateResult(ok=True, handled=False, reason="NON_PRIVATE_CHAT")

    text = message.get("text")
    if isinstance(text, str) and text.strip().startswith("/start"):
        active_sender = sender or TelegramBotSender()
        active_sender.send_message(chat_id, START_MESSAGE)
        return BotUpdateResult(ok=True, handled=True, action="START_SENT")

    active_sender = sender or TelegramBotSender()
    active_sender.send_message(chat_id, START_MESSAGE)
    return BotUpdateResult(ok=True, handled=True, action="HELP_SENT")
