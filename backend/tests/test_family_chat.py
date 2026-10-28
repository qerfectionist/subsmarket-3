from __future__ import annotations

from collections.abc import Iterator
from datetime import date, timedelta
from typing import Any

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from subsmarket.bot.service import (
    GROUP_CONNECTED_MESSAGE,
    GROUP_NEEDS_ADMIN_MESSAGE,
    GROUP_TAKEN_MESSAGE,
    handle_telegram_update,
)
from subsmarket.bot.telegram_api import TelegramApiError
from subsmarket.catalog.models import FamilyService
from subsmarket.core.database import Base
from subsmarket.families.models import FamilyChat, FamilyMember
from subsmarket.families.schemas import FamilyCreate
from subsmarket.families.service import (
    approve_join_request,
    change_family_chat_kind,
    connect_whatsapp_chat,
    create_family,
    create_join_request,
    list_my_families,
)
from subsmarket.identity.models import User
from subsmarket.models import import_models


class FakeTelegramApi:
    def __init__(self, *, fail_invite: bool = False) -> None:
        self.fail_invite = fail_invite
        self.calls: list[tuple[str, dict[str, Any]]] = []

    def call(self, method: str, payload: dict[str, Any]) -> dict[str, Any]:
        self.calls.append((method, payload))
        if method == "createChatInviteLink":
            if self.fail_invite:
                raise TelegramApiError("TELEGRAM_CREATECHATINVITELINK_FAILED")
            return {"invite_link": f"https://t.me/+invite{abs(payload['chat_id'])}"}
        return {}

    def replies(self) -> list[str]:
        return [
            payload["text"] for method, payload in self.calls if method == "sendMessage"
        ]


@pytest.fixture()
def db() -> Iterator[Session]:
    import_models()
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with SessionLocal() as session:
        yield session
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture()
def service(db: Session) -> FamilyService:
    item = FamilyService(
        slug="netflix-premium",
        name="Netflix",
        variant="Premium",
        family_type="subscription",
        category="video_streaming",
        subcategory=None,
        max_members=5,
        supported_periods=["monthly"],
        status="active",
        service_metadata={},
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def make_user(db: Session, index: int) -> User:
    user = User(
        telegram_user_id=920000 + index,
        username=f"chat_user_{index}",
        first_name=f"User {index}",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def make_family(db: Session, owner: User, service: FamilyService, kind: str | None):
    return create_family(
        db,
        owner,
        FamilyCreate(
            service_id=service.id,
            max_members=4,
            total_price_kzt=3800,
            payment_day=15,
            next_payment_date=date.today() + timedelta(days=20),
            payment_bank="kaspi",
            payment_phone="+77001234567",
            chat_kind=kind,
        ),
    )


def chat_of(db: Session, family_id) -> FamilyChat:
    chat = db.scalar(select(FamilyChat).where(FamilyChat.family_id == family_id))
    assert chat is not None
    return chat


def group_start(chat_id: int, token: str) -> dict[str, Any]:
    return {
        "message": {
            "chat": {"id": chat_id, "type": "group"},
            "text": f"/start@subscription_market_bot {token}",
        }
    }


def test_new_family_waits_for_its_telegram_chat(
    db: Session, service: FamilyService
) -> None:
    owner = make_user(db, 1)
    candidate = make_user(db, 2)
    family = make_family(db, owner, service, "telegram")

    [mine] = list_my_families(db, owner)
    assert mine.chat is not None
    assert mine.chat.kind == "telegram"
    assert mine.chat.status == "pending"
    assert mine.chat.invite_url is None
    token = chat_of(db, family.id).connect_token
    assert mine.chat.connect_url == (
        f"https://t.me/subscription_market_bot?startgroup={token}&admin=invite_users"
    )

    request = create_join_request(db, candidate, family.id)
    with pytest.raises(HTTPException) as exc:
        approve_join_request(db, owner, request.id)
    assert exc.value.status_code == 409
    assert exc.value.detail == "FAMILY_CHAT_NOT_CONNECTED"


def test_bot_connects_group_and_members_get_the_link(
    db: Session, service: FamilyService
) -> None:
    owner = make_user(db, 3)
    candidate = make_user(db, 4)
    outsider = make_user(db, 5)
    family = make_family(db, owner, service, "telegram")
    token = chat_of(db, family.id).connect_token
    api = FakeTelegramApi()

    result = handle_telegram_update(group_start(-100500, token), db=db, api=api)

    assert result["action"] == "FAMILY_CHAT_CONNECTED"
    assert api.replies() == [GROUP_CONNECTED_MESSAGE]
    chat = chat_of(db, family.id)
    assert chat.status == "connected"
    assert chat.telegram_chat_id == -100500
    assert "invite100500" not in (chat.encrypted_invite_url or "")

    [owner_view] = list_my_families(db, owner)
    assert owner_view.chat is not None
    assert owner_view.chat.invite_url == "https://t.me/+invite100500"
    assert owner_view.chat.connect_url is None

    request = create_join_request(db, candidate, family.id)
    create_join_request(db, outsider, family.id)
    approve_join_request(db, owner, request.id)
    [member_view] = list_my_families(db, candidate)
    assert member_view.chat is not None
    assert member_view.chat.invite_url == "https://t.me/+invite100500"
    assert list_my_families(db, outsider) == []


def test_bot_asks_for_admin_rights_when_it_cannot_invite(
    db: Session, service: FamilyService
) -> None:
    owner = make_user(db, 6)
    family = make_family(db, owner, service, "telegram")
    token = chat_of(db, family.id).connect_token
    api = FakeTelegramApi(fail_invite=True)

    result = handle_telegram_update(group_start(-100600, token), db=db, api=api)

    assert result["action"] == "FAMILY_CHAT_NEEDS_ADMIN"
    assert api.replies() == [GROUP_NEEDS_ADMIN_MESSAGE]
    assert chat_of(db, family.id).status == "pending"

    retry = handle_telegram_update(
        group_start(-100600, token), db=db, api=FakeTelegramApi()
    )
    assert retry["action"] == "FAMILY_CHAT_CONNECTED"


def test_one_group_serves_one_family(db: Session, service: FamilyService) -> None:
    owner = make_user(db, 7)
    first = make_family(db, owner, service, "telegram")
    second = make_family(db, owner, service, "telegram")
    api = FakeTelegramApi()
    handle_telegram_update(
        group_start(-100700, chat_of(db, first.id).connect_token), db=db, api=api
    )

    result = handle_telegram_update(
        group_start(-100700, chat_of(db, second.id).connect_token), db=db, api=api
    )

    assert result["action"] == "FAMILY_CHAT_CHAT_TAKEN"
    assert api.replies()[-1] == GROUP_TAKEN_MESSAGE
    assert chat_of(db, second.id).status == "pending"


def test_supergroup_migration_keeps_the_chat(
    db: Session, service: FamilyService
) -> None:
    owner = make_user(db, 8)
    family = make_family(db, owner, service, "telegram")
    api = FakeTelegramApi()
    handle_telegram_update(
        group_start(-800, chat_of(db, family.id).connect_token), db=db, api=api
    )

    result = handle_telegram_update(
        {
            "message": {
                "chat": {"id": -800, "type": "group"},
                "migrate_to_chat_id": -100800,
            }
        },
        db=db,
        api=api,
    )

    assert result["action"] == "FAMILY_CHAT_MIGRATED"
    [view] = list_my_families(db, owner)
    assert view.chat is not None
    assert view.chat.invite_url == "https://t.me/+invite100800"


@pytest.mark.parametrize(
    "link",
    [
        "https://chat.whatsapp.com/AbCdEfGhIj12345",
        "chat.whatsapp.com/AbCdEfGhIj12345",
        " https://chat.whatsapp.com/invite/AbCdEfGhIj12345?mode=r ",
    ],
)
def test_whatsapp_link_connects_the_chat(
    db: Session, service: FamilyService, link: str
) -> None:
    owner = make_user(db, 9)
    family = make_family(db, owner, service, "whatsapp")

    connect_whatsapp_chat(db, owner, family.id, link)

    [view] = list_my_families(db, owner)
    assert view.chat is not None
    assert view.chat.status == "connected"
    assert view.chat.invite_url == "https://chat.whatsapp.com/AbCdEfGhIj12345"


@pytest.mark.parametrize(
    "link",
    ["Netflix семья", "https://wa.me/77001234567", "https://chat.whatsapp.com/abc"],
)
def test_whatsapp_rejects_other_links(
    db: Session, service: FamilyService, link: str
) -> None:
    owner = make_user(db, 10)
    family = make_family(db, owner, service, "whatsapp")

    with pytest.raises(HTTPException) as exc:
        connect_whatsapp_chat(db, owner, family.id, link)

    assert exc.value.detail == "WHATSAPP_CHAT_LINK_INVALID"


def test_only_owner_connects_and_kind_switch_rotates_token(
    db: Session, service: FamilyService
) -> None:
    owner = make_user(db, 11)
    stranger = make_user(db, 12)
    family = make_family(db, owner, service, "telegram")
    old_token = chat_of(db, family.id).connect_token

    with pytest.raises(HTTPException) as exc:
        connect_whatsapp_chat(
            db, stranger, family.id, "chat.whatsapp.com/AbCdEfGhIj12345"
        )
    assert exc.value.status_code == 403

    change_family_chat_kind(db, owner, family.id, "whatsapp")
    change_family_chat_kind(db, owner, family.id, "telegram")
    assert chat_of(db, family.id).connect_token != old_token


def test_families_without_chat_keep_working(
    db: Session, service: FamilyService
) -> None:
    owner = make_user(db, 13)
    candidate = make_user(db, 14)
    family = make_family(db, owner, service, None)

    request = create_join_request(db, candidate, family.id)
    approve_join_request(db, owner, request.id)

    [view] = list_my_families(db, owner)
    assert view.chat is None
    assert (
        db.scalar(select(FamilyMember).where(FamilyMember.user_id == candidate.id))
        is not None
    )
