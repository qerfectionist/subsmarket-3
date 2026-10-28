"""Family group chat: a Telegram group with the bot or a WhatsApp invite link.

The owner picks the messenger when creating the family. A Telegram chat is
connected when the owner adds the bot to a group through the start link: the
bot receives ``/start <connect_token>`` there and creates an invite link. A
WhatsApp chat is connected when the owner pastes a ``chat.whatsapp.com`` link.
Until the chat is connected the family stays visible, but new members cannot
be approved.
"""

from __future__ import annotations

import logging
import re
import secrets
from typing import Literal
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from subsmarket.bot.telegram_api import TelegramApi, TelegramApiError
from subsmarket.core.config import settings
from subsmarket.core.database import utcnow
from subsmarket.families._internal import _get_owned_family_for_update
from subsmarket.families.audit import record_family_audit_event
from subsmarket.families.crypto import (
    decrypt_payment_requisite,
    encrypt_payment_requisite,
)
from subsmarket.families.models import Family, FamilyChat
from subsmarket.families.schemas import FamilyChatOut
from subsmarket.identity.models import User

logger = logging.getLogger(__name__)

ChatKind = Literal["telegram", "whatsapp"]
WHATSAPP_LINK_RE = re.compile(
    r"^(?:https?://)?chat\.whatsapp\.com/(?:invite/)?([A-Za-z0-9]{10,40})/?(?:\?.*)?$"
)
TELEGRAM_START_RE = re.compile(r"^/start(?:@\w+)?\s+([A-Za-z0-9_-]{8,64})\s*$")
EDITABLE_FAMILY_STATUSES = {"active", "full", "closing"}


def _new_connect_token() -> str:
    # Telegram start parameters allow up to 64 chars of A-Z, a-z, 0-9, _ and -.
    return secrets.token_urlsafe(18)


def create_family_chat(db: Session, family: Family, kind: ChatKind) -> FamilyChat:
    chat = FamilyChat(
        family_id=family.id,
        kind=kind,
        status="pending",
        connect_token=_new_connect_token(),
    )
    db.add(chat)
    db.flush()
    return chat


def telegram_connect_url(chat: FamilyChat) -> str:
    return (
        f"https://t.me/{settings.telegram_bot_username}"
        f"?startgroup={chat.connect_token}&admin=invite_users"
    )


def family_chat_out(
    chat: FamilyChat | None, *, is_owner: bool, is_member: bool
) -> FamilyChatOut | None:
    """What a viewer may see: the link only for the owner and added members."""
    if chat is None:
        return None
    invite_url = None
    if (
        chat.status == "connected"
        and chat.encrypted_invite_url
        and (is_owner or is_member)
    ):
        invite_url = decrypt_payment_requisite(chat.encrypted_invite_url)
    connect_url = None
    if is_owner and chat.kind == "telegram" and chat.status == "pending":
        connect_url = telegram_connect_url(chat)
    return FamilyChatOut(
        kind=chat.kind,
        status=chat.status,
        invite_url=invite_url,
        connect_url=connect_url,
    )


def ensure_family_chat_connected(db: Session, family: Family) -> None:
    chat = db.scalar(select(FamilyChat).where(FamilyChat.family_id == family.id))
    if chat is not None and chat.status != "connected":
        raise HTTPException(status_code=409, detail="FAMILY_CHAT_NOT_CONNECTED")


def _owned_editable_family(db: Session, user: User, family_id: UUID) -> Family:
    family = _get_owned_family_for_update(db, user, family_id)
    if family.status not in EDITABLE_FAMILY_STATUSES:
        raise HTTPException(status_code=409, detail="FAMILY_NOT_EDITABLE")
    return family


def _chat_for_update(db: Session, family_id: UUID) -> FamilyChat | None:
    return db.scalar(
        select(FamilyChat).where(FamilyChat.family_id == family_id).with_for_update()
    )


def change_family_chat_kind(
    db: Session, user: User, family_id: UUID, kind: ChatKind
) -> FamilyChat:
    """Switch the messenger while the chat is not connected yet."""
    family = _owned_editable_family(db, user, family_id)
    chat = _chat_for_update(db, family.id)
    if chat is None:
        return create_family_chat(db, family, kind)
    if chat.status == "connected":
        raise HTTPException(status_code=409, detail="FAMILY_CHAT_ALREADY_CONNECTED")
    if chat.kind != kind:
        chat.kind = kind
        chat.telegram_chat_id = None
        chat.connect_token = _new_connect_token()
        db.flush()
    return chat


def normalize_whatsapp_link(url: str) -> str:
    match = WHATSAPP_LINK_RE.match(url.strip())
    if match is None:
        raise HTTPException(status_code=400, detail="WHATSAPP_CHAT_LINK_INVALID")
    return f"https://chat.whatsapp.com/{match.group(1)}"


def connect_whatsapp_chat(
    db: Session, user: User, family_id: UUID, url: str
) -> FamilyChat:
    link = normalize_whatsapp_link(url)
    family = _owned_editable_family(db, user, family_id)
    chat = _chat_for_update(db, family.id)
    if chat is None:
        chat = create_family_chat(db, family, "whatsapp")
    if chat.kind != "whatsapp":
        if chat.status == "connected":
            raise HTTPException(status_code=409, detail="FAMILY_CHAT_ALREADY_CONNECTED")
        chat.kind = "whatsapp"
        chat.telegram_chat_id = None
    chat.encrypted_invite_url = encrypt_payment_requisite(link)
    chat.status = "connected"
    chat.connected_at = chat.connected_at or utcnow()
    record_family_audit_event(
        db,
        family_id=family.id,
        action="family_chat_connected",
        actor_user_id=user.id,
        details={"kind": "whatsapp"},
    )
    db.flush()
    return chat


TelegramConnectResult = Literal[
    "connected", "already_connected", "unknown_token", "chat_taken", "needs_admin"
]


def connect_telegram_chat(
    db: Session, *, token: str, telegram_chat_id: int, api: TelegramApi
) -> tuple[TelegramConnectResult, FamilyChat | None]:
    """Called by the bot when it gets ``/start <token>`` in a group."""
    chat = db.scalar(
        select(FamilyChat)
        .where(FamilyChat.connect_token == token)
        .where(FamilyChat.kind == "telegram")
        .with_for_update()
    )
    if chat is None:
        return "unknown_token", None
    if chat.status == "connected":
        return (
            ("already_connected", chat)
            if chat.telegram_chat_id == telegram_chat_id
            else ("chat_taken", chat)
        )
    other = db.scalar(
        select(FamilyChat.id).where(FamilyChat.telegram_chat_id == telegram_chat_id)
    )
    if other is not None and other != chat.id:
        return "chat_taken", chat

    chat.telegram_chat_id = telegram_chat_id
    try:
        result = api.call(
            "createChatInviteLink",
            {"chat_id": telegram_chat_id, "name": "SubsMarket"},
        )
    except TelegramApiError as exc:
        logger.warning("Family chat invite link failed: %s", exc)
        db.flush()
        return "needs_admin", chat
    invite_link = result.get("invite_link")
    if not isinstance(invite_link, str) or not invite_link:
        db.flush()
        return "needs_admin", chat

    chat.encrypted_invite_url = encrypt_payment_requisite(invite_link)
    chat.status = "connected"
    chat.connected_at = utcnow()
    record_family_audit_event(
        db,
        family_id=chat.family_id,
        action="family_chat_connected",
        actor_user_id=None,
        details={"kind": "telegram"},
    )
    db.flush()
    return "connected", chat


def migrate_telegram_chat(
    db: Session, *, old_chat_id: int, new_chat_id: int, api: TelegramApi
) -> bool:
    """A basic group became a supergroup: new id, and old links may stop working."""
    chat = db.scalar(
        select(FamilyChat)
        .where(FamilyChat.telegram_chat_id == old_chat_id)
        .with_for_update()
    )
    if chat is None:
        return False
    chat.telegram_chat_id = new_chat_id
    try:
        result = api.call(
            "createChatInviteLink", {"chat_id": new_chat_id, "name": "SubsMarket"}
        )
    except TelegramApiError as exc:
        logger.warning("Family chat invite link refresh failed: %s", exc)
    else:
        invite_link = result.get("invite_link")
        if isinstance(invite_link, str) and invite_link:
            chat.encrypted_invite_url = encrypt_payment_requisite(invite_link)
    db.flush()
    return True
