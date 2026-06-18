from __future__ import annotations

import hashlib
import hmac
import json
from datetime import UTC, datetime, timedelta
from urllib.parse import parse_qsl

from fastapi import Header, HTTPException

from subsmarket.core.config import settings
from subsmarket.identity.schemas import TelegramUserData

MAX_INIT_DATA_AGE = timedelta(days=1)


def _verify_init_data(init_data: str, bot_token: str) -> dict[str, str]:
    values = dict(parse_qsl(init_data, keep_blank_values=True))
    received_hash = values.pop("hash", None)
    if not received_hash:
        raise HTTPException(status_code=401, detail="TELEGRAM_INIT_DATA_HASH_MISSING")

    data_check_string = "\n".join(f"{key}={values[key]}" for key in sorted(values))
    secret_key = hmac.new(
        b"WebAppData", bot_token.encode("utf-8"), hashlib.sha256
    ).digest()
    calculated_hash = hmac.new(
        secret_key, data_check_string.encode("utf-8"), hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(calculated_hash, received_hash):
        raise HTTPException(status_code=401, detail="TELEGRAM_INIT_DATA_HASH_INVALID")

    auth_date_raw = values.get("auth_date")
    if not auth_date_raw:
        raise HTTPException(
            status_code=401,
            detail="TELEGRAM_INIT_DATA_AUTH_DATE_MISSING",
        )
    try:
        auth_date = datetime.fromtimestamp(int(auth_date_raw), tz=UTC)
    except ValueError as exc:
        raise HTTPException(
            status_code=401,
            detail="TELEGRAM_INIT_DATA_AUTH_DATE_INVALID",
        ) from exc
    if datetime.now(UTC) - auth_date > MAX_INIT_DATA_AGE:
        raise HTTPException(status_code=401, detail="TELEGRAM_INIT_DATA_EXPIRED")

    return values


def parse_telegram_user(
    x_telegram_init_data: str | None = Header(default=None),
    x_dev_telegram_user_id: int | None = Header(default=None),
    x_dev_telegram_username: str | None = Header(default=None),
    x_dev_telegram_first_name: str | None = Header(default=None),
) -> TelegramUserData:
    if x_telegram_init_data:
        if not settings.telegram_bot_token:
            raise HTTPException(
                status_code=500,
                detail="TELEGRAM_BOT_TOKEN_NOT_CONFIGURED",
            )
        values = _verify_init_data(x_telegram_init_data, settings.telegram_bot_token)
        raw_user = values.get("user")
        if not raw_user:
            raise HTTPException(
                status_code=401,
                detail="TELEGRAM_INIT_DATA_USER_MISSING",
            )
        try:
            user = json.loads(raw_user)
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=401,
                detail="TELEGRAM_INIT_DATA_USER_INVALID",
            ) from exc
        return TelegramUserData(
            telegram_user_id=int(user["id"]),
            username=user.get("username"),
            first_name=user.get("first_name") or "User",
            last_name=user.get("last_name"),
            photo_url=user.get("photo_url"),
        )

    if settings.is_development:
        return TelegramUserData(
            telegram_user_id=x_dev_telegram_user_id or settings.demo_telegram_user_id,
            username=x_dev_telegram_username or settings.demo_telegram_username,
            first_name=x_dev_telegram_first_name or settings.demo_telegram_first_name,
        )

    raise HTTPException(status_code=401, detail="TELEGRAM_INIT_DATA_REQUIRED")
