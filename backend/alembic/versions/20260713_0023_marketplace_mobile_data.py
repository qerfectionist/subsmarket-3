"""add mobile data marketplace

Revision ID: 20260713_0023
Revises: 20260713_0022
Create Date: 2026-07-13 15:00:00.000000
"""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy import text

from alembic import op

revision = "20260713_0023"
down_revision = "20260713_0022"
branch_labels = None
depends_on = None

MARKETPLACE_TABLES = (
    "marketplace_operators",
    "marketplace_listings",
    "marketplace_listing_requests",
)


def upgrade() -> None:
    op.create_table(
        "marketplace_operators",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("slug", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("min_lot_gb", sa.Numeric(8, 2), nullable=True),
        sa.Column("max_lot_gb", sa.Numeric(8, 2), nullable=True),
        sa.Column("amount_step_gb", sa.Numeric(8, 2), nullable=True),
        sa.Column("validity_days", sa.Integer(), nullable=True),
        sa.Column("fee_note", sa.Text(), nullable=True),
        sa.Column("conditions", sa.Text(), nullable=True),
        sa.Column("source_url", sa.Text(), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "min_lot_gb is null or min_lot_gb > 0",
            name="marketplace_operator_min_lot_ck",
        ),
        sa.CheckConstraint(
            "max_lot_gb is null or max_lot_gb > 0",
            name="marketplace_operator_max_lot_ck",
        ),
        sa.CheckConstraint(
            "amount_step_gb is null or amount_step_gb > 0",
            name="marketplace_operator_step_ck",
        ),
        sa.CheckConstraint(
            "min_lot_gb is null or max_lot_gb is null or max_lot_gb >= min_lot_gb",
            name="marketplace_operator_lot_range_ck",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index(
        "ix_marketplace_operators_is_active",
        "marketplace_operators",
        ["is_active"],
    )

    op.create_table(
        "marketplace_listings",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("seller_user_id", sa.Uuid(), nullable=False),
        sa.Column("listing_type", sa.Text(), nullable=False),
        sa.Column("operator_id", sa.Uuid(), nullable=False),
        sa.Column("amount_gb", sa.Numeric(8, 2), nullable=False),
        sa.Column("total_price_kzt", sa.Integer(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "listing_type = 'mobile_data'",
            name="marketplace_listing_type_ck",
        ),
        sa.CheckConstraint(
            "status in ('active', 'paused', 'expired', 'archived')",
            name="marketplace_listing_status_ck",
        ),
        sa.CheckConstraint("amount_gb > 0", name="marketplace_listing_amount_ck"),
        sa.CheckConstraint(
            "total_price_kzt > 0",
            name="marketplace_listing_price_ck",
        ),
        sa.CheckConstraint(
            "description is null or length(description) <= 300",
            name="marketplace_listing_description_length_ck",
        ),
        sa.ForeignKeyConstraint(
            ["operator_id"],
            ["marketplace_operators.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["seller_user_id"],
            ["users.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "marketplace_listing_catalog_idx",
        "marketplace_listings",
        ["listing_type", "status", "operator_id", "updated_at"],
    )
    op.create_index(
        "marketplace_listing_seller_status_idx",
        "marketplace_listings",
        ["seller_user_id", "status", "updated_at"],
    )
    op.create_index(
        "marketplace_listing_expiry_idx",
        "marketplace_listings",
        ["status", "expires_at"],
    )

    op.create_table(
        "marketplace_listing_requests",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("listing_id", sa.Uuid(), nullable=False),
        sa.Column("buyer_user_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("operator_slug_snapshot", sa.Text(), nullable=False),
        sa.Column("operator_name_snapshot", sa.Text(), nullable=False),
        sa.Column("amount_gb_snapshot", sa.Numeric(8, 2), nullable=False),
        sa.Column("total_price_kzt_snapshot", sa.Integer(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_reminded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reminder_count", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "status in ('pending', 'accepted', 'rejected', 'cancelled', "
            "'closed', 'expired')",
            name="marketplace_request_status_ck",
        ),
        sa.CheckConstraint(
            "amount_gb_snapshot > 0",
            name="marketplace_request_amount_ck",
        ),
        sa.CheckConstraint(
            "total_price_kzt_snapshot > 0",
            name="marketplace_request_price_ck",
        ),
        sa.CheckConstraint(
            "reason is null or length(reason) <= 200",
            name="marketplace_request_reason_length_ck",
        ),
        sa.CheckConstraint(
            "reminder_count >= 0",
            name="marketplace_request_reminder_count_ck",
        ),
        sa.ForeignKeyConstraint(
            ["buyer_user_id"],
            ["users.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["listing_id"],
            ["marketplace_listings.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "marketplace_request_active_buyer_listing_uq",
        "marketplace_listing_requests",
        ["listing_id", "buyer_user_id"],
        unique=True,
        postgresql_where=text("status in ('pending', 'accepted')"),
        sqlite_where=text("status in ('pending', 'accepted')"),
    )
    op.create_index(
        "marketplace_request_buyer_status_idx",
        "marketplace_listing_requests",
        ["buyer_user_id", "status", "created_at"],
    )
    op.create_index(
        "marketplace_request_listing_status_idx",
        "marketplace_listing_requests",
        ["listing_id", "status", "created_at"],
    )

    _seed_operators()
    _harden_public_tables()


def downgrade() -> None:
    op.drop_index(
        "marketplace_request_listing_status_idx",
        table_name="marketplace_listing_requests",
    )
    op.drop_index(
        "marketplace_request_buyer_status_idx",
        table_name="marketplace_listing_requests",
    )
    op.drop_index(
        "marketplace_request_active_buyer_listing_uq",
        table_name="marketplace_listing_requests",
    )
    op.drop_table("marketplace_listing_requests")
    op.drop_index(
        "marketplace_listing_expiry_idx",
        table_name="marketplace_listings",
    )
    op.drop_index(
        "marketplace_listing_seller_status_idx",
        table_name="marketplace_listings",
    )
    op.drop_index(
        "marketplace_listing_catalog_idx",
        table_name="marketplace_listings",
    )
    op.drop_table("marketplace_listings")
    op.drop_index(
        "ix_marketplace_operators_is_active",
        table_name="marketplace_operators",
    )
    op.drop_table("marketplace_operators")


def _seed_operators() -> None:
    now = datetime(2026, 7, 13, tzinfo=UTC)
    operators = sa.table(
        "marketplace_operators",
        sa.column("id", sa.Uuid()),
        sa.column("slug", sa.Text()),
        sa.column("name", sa.Text()),
        sa.column("is_active", sa.Boolean()),
        sa.column("min_lot_gb", sa.Numeric(8, 2)),
        sa.column("max_lot_gb", sa.Numeric(8, 2)),
        sa.column("amount_step_gb", sa.Numeric(8, 2)),
        sa.column("validity_days", sa.Integer()),
        sa.column("fee_note", sa.Text()),
        sa.column("conditions", sa.Text()),
        sa.column("source_url", sa.Text()),
        sa.column("verified_at", sa.DateTime(timezone=True)),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )
    op.bulk_insert(
        operators,
        [
            {
                "id": UUID("10000000-0000-4000-8000-000000000001"),
                "slug": "tele2",
                "name": "Tele2",
                "is_active": True,
                "min_lot_gb": Decimal("0.50"),
                "max_lot_gb": Decimal("50.00"),
                "amount_step_gb": Decimal("0.50"),
                "validity_days": 7,
                "fee_note": (
                    "Бесплатно на актуальных тарифах; на части архивных "
                    "тарифов комиссия 100 ₸."
                ),
                "conditions": (
                    "Только Tele2 → Tele2. У отправителя должны остаться "
                    "минимум 1 ГБ и 10 минут. Полученные ресурсы нельзя "
                    "передать повторно."
                ),
                "source_url": "https://new.tele2.kz/new/transfer-resources",
                "verified_at": now,
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": UUID("10000000-0000-4000-8000-000000000002"),
                "slug": "beeline",
                "name": "Beeline",
                "is_active": False,
                "min_lot_gb": None,
                "max_lot_gb": None,
                "amount_step_gb": None,
                "validity_days": None,
                "fee_note": None,
                "conditions": (
                    "Последний опубликованный срок услуги «Дари Гиги» "
                    "закончился 28.02.2026; нужна новая официальная проверка."
                ),
                "source_url": "https://beeline.kz/ru/events/actions/dari-gigi",
                "verified_at": now,
                "created_at": now,
                "updated_at": now,
            },
            *_inactive_operator_rows(now),
        ],
    )


def _inactive_operator_rows(now: datetime) -> list[dict[str, object]]:
    return [
        {
            "id": UUID(f"10000000-0000-4000-8000-{index:012d}"),
            "slug": slug,
            "name": name,
            "is_active": False,
            "min_lot_gb": None,
            "max_lot_gb": None,
            "amount_step_gb": None,
            "validity_days": None,
            "fee_note": None,
            "conditions": "Прямой разовый перевод ГБ официально не подтверждён.",
            "source_url": None,
            "verified_at": now,
            "created_at": now,
            "updated_at": now,
        }
        for index, slug, name in (
            (3, "activ", "activ"),
            (4, "kcell", "Kcell"),
            (5, "altel", "Altel"),
            (6, "izi", "Izi"),
        )
    ]


def _harden_public_tables() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    has_supabase_roles = _has_role("anon") and _has_role("authenticated")
    for table_name in MARKETPLACE_TABLES:
        qualified = f'public."{table_name}"'
        op.execute(text(f"ALTER TABLE {qualified} ENABLE ROW LEVEL SECURITY"))
        if has_supabase_roles:
            op.execute(
                text(f"REVOKE ALL ON TABLE {qualified} FROM anon, authenticated")
            )


def _has_role(role: str) -> bool:
    bind = op.get_bind()
    return bool(
        bind.execute(
            text("select 1 from pg_roles where rolname = :role"),
            {"role": role},
        ).scalar()
    )
