"""simplify mobile data listings to bulletin board offers

Revision ID: 20260714_0027
Revises: 20260714_0026
Create Date: 2026-07-14 12:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "20260714_0027"
down_revision = "20260714_0026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_index(
        "marketplace_listing_availability_idx",
        table_name="marketplace_listings",
    )
    op.drop_index(
        "marketplace_listing_catalog_idx",
        table_name="marketplace_listings",
    )
    op.alter_column(
        "marketplace_listings",
        "availability_confirmed_at",
        new_column_name="published_at",
        existing_type=sa.DateTime(timezone=True),
        existing_nullable=False,
    )
    op.drop_constraint(
        "marketplace_listing_minimum_order_ck",
        "marketplace_listings",
        type_="check",
    )
    op.drop_constraint(
        "marketplace_listing_reserved_ck",
        "marketplace_listings",
        type_="check",
    )
    op.drop_constraint(
        "marketplace_listing_stock_ck",
        "marketplace_listings",
        type_="check",
    )
    op.drop_column("marketplace_listings", "minimum_order_gb")
    op.drop_column("marketplace_listings", "reserved_gb")
    op.drop_column("marketplace_listings", "stock_gb")
    op.create_index(
        "marketplace_listing_catalog_idx",
        "marketplace_listings",
        ["listing_type", "status", "operator_id", "published_at"],
    )
    op.create_index(
        "marketplace_listing_published_idx",
        "marketplace_listings",
        ["listing_type", "status", "operator_id", "published_at", "id"],
    )


def downgrade() -> None:
    op.drop_index(
        "marketplace_listing_published_idx",
        table_name="marketplace_listings",
    )
    op.drop_index(
        "marketplace_listing_catalog_idx",
        table_name="marketplace_listings",
    )
    op.add_column(
        "marketplace_listings",
        sa.Column(
            "stock_gb",
            sa.Numeric(8, 2),
            nullable=False,
            server_default="1",
        ),
    )
    op.add_column(
        "marketplace_listings",
        sa.Column(
            "reserved_gb",
            sa.Numeric(8, 2),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "marketplace_listings",
        sa.Column(
            "minimum_order_gb",
            sa.Numeric(8, 2),
            nullable=False,
            server_default="1",
        ),
    )
    op.create_check_constraint(
        "marketplace_listing_stock_ck",
        "marketplace_listings",
        "stock_gb >= 0",
    )
    op.create_check_constraint(
        "marketplace_listing_reserved_ck",
        "marketplace_listings",
        "reserved_gb >= 0 AND reserved_gb <= stock_gb",
    )
    op.create_check_constraint(
        "marketplace_listing_minimum_order_ck",
        "marketplace_listings",
        "minimum_order_gb >= 1 AND "
        "minimum_order_gb = cast(minimum_order_gb as integer)",
    )
    op.alter_column(
        "marketplace_listings",
        "published_at",
        new_column_name="availability_confirmed_at",
        existing_type=sa.DateTime(timezone=True),
        existing_nullable=False,
    )
    op.create_index(
        "marketplace_listing_catalog_idx",
        "marketplace_listings",
        ["listing_type", "status", "operator_id", "updated_at"],
    )
    op.create_index(
        "marketplace_listing_availability_idx",
        "marketplace_listings",
        [
            "listing_type",
            "status",
            "operator_id",
            "availability_confirmed_at",
            "id",
        ],
    )
