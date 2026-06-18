"""family lifecycle fields

Revision ID: 20260617_0004
Revises: 20260616_0003
Create Date: 2026-06-17
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "20260617_0004"
down_revision = "20260616_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "families",
        sa.Column("price_updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "family_members",
        sa.Column("closing_acknowledged_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("family_members", "closing_acknowledged_at")
    op.drop_column("families", "price_updated_at")
