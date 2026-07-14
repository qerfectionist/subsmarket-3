from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class MarketplaceOperatorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    slug: str
    name: str
    min_lot_gb: Decimal | None = None
    max_lot_gb: Decimal | None = None
    amount_step_gb: Decimal | None = None
    validity_days: int | None = None
    fee_note: str | None = None
    conditions: str | None = None
    source_url: str | None = None
    verified_at: datetime | None = None


class MarketplaceListingCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    operator_slug: str = Field(min_length=2, max_length=40, pattern=r"^[a-z0-9-]+$")
    price_per_gb_kzt: int = Field(ge=1, le=1_000_000)
    description: str | None = Field(default=None, max_length=300)


class MarketplaceListingUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    operator_slug: str | None = Field(
        default=None,
        min_length=2,
        max_length=40,
        pattern=r"^[a-z0-9-]+$",
    )
    price_per_gb_kzt: int | None = Field(default=None, ge=1, le=1_000_000)
    description: str | None = Field(default=None, max_length=300)

    @model_validator(mode="after")
    def require_change(self):
        if not self.model_fields_set:
            raise ValueError("At least one field is required")
        return self


class MarketplaceListingOut(BaseModel):
    id: UUID
    listing_type: Literal["mobile_data"]
    operator: MarketplaceOperatorOut
    price_per_gb_kzt: int
    description: str | None = None
    status: Literal["active", "paused", "expired", "archived"]
    is_owner: bool
    expires_at: datetime
    published_at: datetime
    created_at: datetime
    updated_at: datetime


class MarketplaceListingPageOut(BaseModel):
    items: list[MarketplaceListingOut]
    next_cursor: str | None = None


class MarketplacePriceInsightOut(BaseModel):
    operator_slug: str
    sample_size: int
    median_price_per_gb_kzt: int | None = None
    typical_min_price_per_gb_kzt: int | None = None
    typical_max_price_per_gb_kzt: int | None = None


class MarketplaceRequestAction(BaseModel):
    reason: str | None = Field(default=None, max_length=200)


class MarketplaceRequestCreate(BaseModel):
    amount_gb: Decimal = Field(
        ge=1, le=1000, multiple_of=1, max_digits=8, decimal_places=2
    )


class MarketplaceRequestClose(BaseModel):
    outcome: Literal["sold", "not_sold"]
    reason: str | None = Field(default=None, max_length=200)


class MarketplaceListingRequestOut(BaseModel):
    id: UUID
    listing_id: UUID
    role: Literal["buyer", "seller"]
    status: Literal["pending", "accepted", "rejected", "cancelled", "closed", "expired"]
    operator_slug: str
    operator_name: str
    amount_gb: Decimal
    price_per_gb_kzt: int
    total_price_kzt: int
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


class MarketplaceListingRequestPageOut(BaseModel):
    items: list[MarketplaceListingRequestOut]
    next_cursor: str | None = None
