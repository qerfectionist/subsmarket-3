from __future__ import annotations

import hashlib
import hmac
import json
from datetime import UTC, datetime, timedelta
from urllib.parse import urlencode

import pytest
from fastapi import HTTPException

from subsmarket.core.config import settings
from subsmarket.identity.telegram import _verify_init_data, parse_telegram_user


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

    telegram_user = parse_telegram_user(x_telegram_init_data=make_init_data(bot_token))

    assert telegram_user.telegram_user_id == 777001
    assert telegram_user.username == "telegram_user"
    assert telegram_user.first_name == "Telegram"
    assert telegram_user.photo_url == "https://t.me/i/userpic/320/demo.svg"
