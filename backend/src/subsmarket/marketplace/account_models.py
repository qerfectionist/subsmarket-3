from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Text,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from subsmarket.core.database import Base, utcnow
from subsmarket.identity.models import User


class MarketplaceAccountService(Base):
    __tablename__ = "marketplace_account_services"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(Text, unique=True)
    name: Mapped[str] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class MarketplaceAccountListing(Base):
    __tablename__ = "marketplace_account_listings"
    __table_args__ = (
        CheckConstraint(
            "status in ('active', 'paused', 'expired', 'archived')",
            name="marketplace_account_listing_status_ck",
        ),
        CheckConstraint(
            "price_kzt > 0", name="marketplace_account_listing_price_ck"
        ),
        CheckConstraint(
            "length(title) between 2 and 100",
            name="marketplace_account_listing_title_length_ck",
        ),
        CheckConstraint(
            "description is null or length(description) <= 500",
            name="marketplace_account_listing_description_length_ck",
        ),
        Index(
            "marketplace_account_listing_catalog_idx",
            "status",
            "service_id",
            "published_at",
            "id",
        ),
        Index(
            "marketplace_account_listing_seller_idx",
            "seller_user_id",
            "status",
            "updated_at",
        ),
        Index("marketplace_account_listing_expiry_idx", "status", "expires_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    seller_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT")
    )
    service_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("marketplace_account_services.id", ondelete="RESTRICT")
    )
    title: Mapped[str] = mapped_column(Text)
    price_kzt: Mapped[int] = mapped_column(Integer)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(Text, default="active")
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    published_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    expiry_reminder_sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    seller: Mapped[User] = relationship()
    service: Mapped[MarketplaceAccountService] = relationship()


class MarketplaceAccountRequest(Base):
    __tablename__ = "marketplace_account_requests"
    __table_args__ = (
        CheckConstraint(
            "status in ('pending', 'accepted', 'rejected', 'cancelled', "
            "'closed', 'expired')",
            name="marketplace_account_request_status_ck",
        ),
        CheckConstraint(
            "price_kzt_snapshot > 0",
            name="marketplace_account_request_price_ck",
        ),
        CheckConstraint(
            "outcome is null or outcome in ('sold', 'not_sold')",
            name="marketplace_account_request_outcome_ck",
        ),
        CheckConstraint(
            "reason is null or length(reason) <= 200",
            name="marketplace_account_request_reason_length_ck",
        ),
        CheckConstraint(
            "reminder_count >= 0",
            name="marketplace_account_request_reminder_count_ck",
        ),
        Index(
            "marketplace_account_request_active_uq",
            "listing_id",
            "buyer_user_id",
            unique=True,
            postgresql_where=text("status in ('pending', 'accepted')"),
            sqlite_where=text("status in ('pending', 'accepted')"),
        ),
        Index(
            "marketplace_account_request_buyer_idx",
            "buyer_user_id",
            "status",
            "created_at",
        ),
        Index(
            "marketplace_account_request_listing_idx",
            "listing_id",
            "status",
            "created_at",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    listing_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("marketplace_account_listings.id", ondelete="RESTRICT")
    )
    buyer_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT")
    )
    status: Mapped[str] = mapped_column(Text, default="pending")
    service_slug_snapshot: Mapped[str] = mapped_column(Text)
    service_name_snapshot: Mapped[str] = mapped_column(Text)
    title_snapshot: Mapped[str] = mapped_column(Text)
    price_kzt_snapshot: Mapped[int] = mapped_column(Integer)
    outcome: Mapped[str | None] = mapped_column(Text, nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    cancelled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    closed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_reminded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    reminder_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    listing: Mapped[MarketplaceAccountListing] = relationship()
    buyer: Mapped[User] = relationship()
