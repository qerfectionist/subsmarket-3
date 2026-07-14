"""add marketplace availability confirmation

Revision ID: 20260714_0026
Revises: 20260714_0025
Create Date: 2026-07-14 01:15:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "20260714_0026"
down_revision = "20260714_0025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "marketplace_listings",
        sa.Column("availability_confirmed_at", sa.DateTime(timezone=True)),
    )
    op.execute(
        "UPDATE marketplace_listings "
        "SET availability_confirmed_at = COALESCE(updated_at, created_at, now())"
    )
    op.alter_column(
        "marketplace_listings",
        "availability_confirmed_at",
        nullable=False,
    )
    op.execute(
        "UPDATE marketplace_listings "
        "SET expires_at = LEAST(expires_at, created_at + interval '7 days')"
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


def downgrade() -> None:
    op.drop_index(
        "marketplace_listing_availability_idx",
        table_name="marketplace_listings",
    )
    op.drop_column("marketplace_listings", "availability_confirmed_at")
