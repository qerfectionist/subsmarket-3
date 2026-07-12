from __future__ import annotations

import hashlib
import hmac
import json
from datetime import UTC, datetime, timedelta
from urllib.parse import urlencode

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from starlette.requests import Request

from subsmarket.core.config import settings
from subsmarket.core.database import Base
from subsmarket.identity.models import User
from subsmarket.identity.schemas import TelegramUserData
from subsmarket.identity.service import upsert_user
from subsmarket.identity.telegram import _verify_init_data, parse_telegram_user


def make_request(host: str = "testclient") -> Request:
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/api/me",
            "headers": [],
            "client": (host, 12345),
            "server": ("testserver", 80),
            "scheme": "http",
        }
    )


def make_init_data(bot_token: str, *, auth_date: datetime | None = None) -> str:
    user = {
        "id": 777001,
        "first_name": "Telegram",
        "last_name": "User",
        "username": "telegram_user",
        "photo_url": "https://t.me/i/userpic/320/demo.svg",
    }
    values = {
        "auth_date": str(int((auth_date or datetime.now(UTC)).timestamp())),
        "query_id": "demo-query",
        "user": json.dumps(user, separators=(",", ":")),
    }
    data_check_string = "\n".join(
        f"{key}={values[key]}" for key in sorted(values)
    )
    secret_key = hmac.new(
        b"WebAppData", bot_token.encode("utf-8"), hashlib.sha256
    ).digest()
    values["hash"] = hmac.new(
        secret_key, data_check_string.encode("utf-8"), hashlib.sha256
    ).hexdigest()
    return urlencode(values)


def test_verify_init_data_accepts_valid_telegram_payload() -> None:
    bot_token = "123456:secret"
    init_data = make_init_data(bot_token)

    values = _verify_init_data(init_data, bot_token)

    user = json.loads(values["user"])
    assert user["id"] == 777001
    assert user["username"] == "telegram_user"


def test_verify_init_data_rejects_expired_payload() -> None:
    bot_token = "123456:secret"
    init_data = make_init_data(
        bot_token, auth_date=datetime.now(UTC) - timedelta(days=2)
    )

    with pytest.raises(HTTPException) as exc:
        _verify_init_data(init_data, bot_token)

    assert exc.value.status_code == 401
    assert exc.value.detail == "TELEGRAM_INIT_DATA_EXPIRED"


def test_parse_telegram_user_uses_verified_init_data(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    bot_token = "123456:secret"
    monkeypatch.setattr(settings, "telegram_bot_token", bot_token)

    telegram_user = parse_telegram_user(
        make_request(),
        x_telegram_init_data=make_init_data(bot_token),
    )

    assert telegram_user.telegram_user_id == 777001
    assert telegram_user.username == "telegram_user"
    assert telegram_user.first_name == "Telegram"
    assert telegram_user.photo_url == "https://t.me/i/userpic/320/demo.svg"


def test_parse_telegram_user_allows_local_development_fallback(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "app_env", "development")

    telegram_user = parse_telegram_user(
        make_request("127.0.0.1"),
        x_telegram_init_data=None,
        x_dev_telegram_user_id=123,
        x_dev_telegram_username="local_dev",
        x_dev_telegram_first_name="Local",
    )

    assert telegram_user.telegram_user_id == 123
    assert telegram_user.username == "local_dev"
    assert telegram_user.first_name == "Local"


def test_parse_telegram_user_rejects_remote_development_fallback(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "app_env", "development")

    with pytest.raises(HTTPException) as exc:
        parse_telegram_user(
            make_request("203.0.113.10"),
            x_telegram_init_data=None,
            x_dev_telegram_user_id=123,
            x_dev_telegram_username="remote_dev",
        )

    assert exc.value.status_code == 401
    assert exc.value.detail == "TELEGRAM_INIT_DATA_REQUIRED"


def test_upsert_user_updates_existing_profile_without_duplicate() -> None:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine, tables=[User.__table__])
    SessionLocal = sessionmaker(
        bind=engine,
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
    )

    with SessionLocal() as db:
        user = upsert_user(
            db,
            TelegramUserData(
                telegram_user_id=777001,
                username="old_username",
                first_name="Old",
            ),
        )
        user_id = user.id

        updated = upsert_user(
            db,
            TelegramUserData(
                telegram_user_id=777001,
                username="new_username",
                first_name="New",
                last_name="User",
                photo_url="https://example.com/avatar.png",
            ),
        )

        assert updated.id == user_id
        assert updated.username == "new_username"
        assert updated.first_name == "New"
        assert updated.last_name == "User"
        assert updated.photo_url == "https://example.com/avatar.png"
        assert db.query(User).count() == 1
