from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class AccountServiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    slug: str
    name: str


class AccountListingCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    service_slug: str = Field(min_length=2, max_length=40, pattern=r"^[a-z0-9-]+$")
    title: str = Field(min_length=2, max_length=100)
    price_kzt: int = Field(ge=1, le=10_000_000)
    description: str | None = Field(default=None, max_length=500)


class AccountListingUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=2, max_length=100)
    price_kzt: int | None = Field(default=None, ge=1, le=10_000_000)
    description: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def require_change(self):
        if not self.model_fields_set:
            raise ValueError("At least one field is required")
        return self


class AccountListingOut(BaseModel):
    id: UUID
    service: AccountServiceOut
    title: str
    price_kzt: int
    description: str | None = None
    status: Literal["active", "paused", "expired", "archived"]
    is_owner: bool
    can_renew: bool
    renew_available_at: datetime | None = None
    expires_at: datetime
    published_at: datetime
    created_at: datetime
    updated_at: datetime


class AccountListingPageOut(BaseModel):
    items: list[AccountListingOut]
    next_cursor: str | None = None


class AccountRequestAction(BaseModel):
    reason: str | None = Field(default=None, max_length=200)


class AccountRequestClose(BaseModel):
    outcome: Literal["sold", "not_sold"]
    reason: str | None = Field(default=None, max_length=200)


class AccountRequestOut(BaseModel):
    id: UUID
    listing_id: UUID
    role: Literal["buyer", "seller"]
    status: Literal["pending", "accepted", "rejected", "cancelled", "closed", "expired"]
    service_slug: str
    service_name: str
    title: str
    price_kzt: int
    outcome: Literal["sold", "not_sold"] | None = None
    reason: str | None = None
    counterparty_username: str | None = None
    telegram_url: str | None = None
    telegram_draft: str | None = None
    can_remind: bool = False
    reminder_available_at: datetime | None = None
    created_at: datetime
    decided_at: datetime | None = None
    cancelled_at: datetime | None = None
    closed_at: datetime | None = None


class AccountRequestPageOut(BaseModel):
    items: list[AccountRequestOut]
    next_cursor: str | None = None
