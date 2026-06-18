from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict


class TelegramUserData(BaseModel):
    telegram_user_id: int
    username: str | None = None
    first_name: str
    last_name: str | None = None
    photo_url: str | None = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    telegram_user_id: int
    username: str
    first_name: str
    last_name: str | None
    photo_url: str | None
    status: str


class MeResponse(BaseModel):
    ok: bool
    user: UserOut | None = None
    error: str | None = None
    message: str | None = None
