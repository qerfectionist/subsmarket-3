from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    Text,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from subsmarket.core.database import Base, utcnow
from subsmarket.identity.models import User


class MarketplaceOperator(Base):
    __tablename__ = "marketplace_operators"
    __table_args__ = (
        CheckConstraint(
            "min_lot_gb is null or "
            "(min_lot_gb >= 1 and min_lot_gb = cast(min_lot_gb as integer))",
            name="marketplace_operator_min_lot_ck",
        ),
        CheckConstraint(
            "max_lot_gb is null or max_lot_gb > 0",
            name="marketplace_operator_max_lot_ck",
        ),
        CheckConstraint(
            "amount_step_gb is null or "
            "(amount_step_gb >= 1 and "
            "amount_step_gb = cast(amount_step_gb as integer))",
            name="marketplace_operator_step_ck",
        ),
        CheckConstraint(
            "min_lot_gb is null or max_lot_gb is null or max_lot_gb >= min_lot_gb",
            name="marketplace_operator_lot_range_ck",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(Text, unique=True)
    name: Mapped[str] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    min_lot_gb: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    max_lot_gb: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    amount_step_gb: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    validity_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    fee_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    conditions: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class MarketplaceListing(Base):
    __tablename__ = "marketplace_listings"
    __table_args__ = (
        CheckConstraint(
            "listing_type = 'mobile_data'", name="marketplace_listing_type_ck"
        ),
        CheckConstraint(
            "status in ('active', 'paused', 'expired', 'archived')",
            name="marketplace_listing_status_ck",
        ),
        CheckConstraint(
            "price_per_gb_kzt > 0", name="marketplace_listing_unit_price_ck"
        ),
        CheckConstraint(
            "description is null or length(description) <= 300",
            name="marketplace_listing_description_length_ck",
        ),
        Index(
            "marketplace_listing_catalog_idx",
            "listing_type",
            "status",
            "operator_id",
            "published_at",
        ),
        Index(
            "marketplace_listing_seller_status_idx",
            "seller_user_id",
            "status",
            "updated_at",
        ),
        Index(
            "marketplace_listing_active_seller_operator_uq",
            "seller_user_id",
            "operator_id",
            unique=True,
            postgresql_where=text("status in ('active', 'paused', 'expired')"),
            sqlite_where=text("status in ('active', 'paused', 'expired')"),
        ),
        Index("marketplace_listing_expiry_idx", "status", "expires_at"),
        Index(
            "marketplace_listing_published_idx",
            "listing_type",
            "status",
            "operator_id",
            "published_at",
            "id",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    seller_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT")
    )
    listing_type: Mapped[str] = mapped_column(Text, default="mobile_data")
    operator_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("marketplace_operators.id", ondelete="RESTRICT")
    )
    price_per_gb_kzt: Mapped[int] = mapped_column(Integer)
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
    operator: Mapped[MarketplaceOperator] = relationship()


class MarketplaceListingRequest(Base):
    __tablename__ = "marketplace_listing_requests"
    __table_args__ = (
        CheckConstraint(
            "status in ('pending', 'accepted', 'rejected', 'cancelled', "
            "'closed', 'expired')",
            name="marketplace_request_status_ck",
        ),
        CheckConstraint("amount_gb_snapshot > 0", name="marketplace_request_amount_ck"),
        CheckConstraint(
            "total_price_kzt_snapshot > 0", name="marketplace_request_price_ck"
        ),
        CheckConstraint(
            "price_per_gb_kzt_snapshot > 0",
            name="marketplace_request_unit_price_ck",
        ),
        CheckConstraint(
            "outcome is null or outcome in ('sold', 'not_sold')",
            name="marketplace_request_outcome_ck",
        ),
        CheckConstraint(
            "reason is null or length(reason) <= 200",
            name="marketplace_request_reason_length_ck",
        ),
        CheckConstraint(
            "reminder_count >= 0",
            name="marketplace_request_reminder_count_ck",
        ),
        Index(
            "marketplace_request_active_buyer_listing_uq",
            "listing_id",
            "buyer_user_id",
            unique=True,
            postgresql_where=text("status in ('pending', 'accepted')"),
            sqlite_where=text("status in ('pending', 'accepted')"),
        ),
        Index(
            "marketplace_request_buyer_status_idx",
            "buyer_user_id",
            "status",
            "created_at",
        ),
        Index(
            "marketplace_request_listing_status_idx",
            "listing_id",
            "status",
            "created_at",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    listing_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("marketplace_listings.id", ondelete="RESTRICT")
    )
    buyer_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT")
    )
    status: Mapped[str] = mapped_column(Text, default="pending")
    operator_slug_snapshot: Mapped[str] = mapped_column(Text)
    operator_name_snapshot: Mapped[str] = mapped_column(Text)
    amount_gb_snapshot: Mapped[Decimal] = mapped_column(Numeric(8, 2))
    price_per_gb_kzt_snapshot: Mapped[int] = mapped_column(Integer)
    total_price_kzt_snapshot: Mapped[int] = mapped_column(Integer)
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

    listing: Mapped[MarketplaceListing] = relationship()
    buyer: Mapped[User] = relationship()
