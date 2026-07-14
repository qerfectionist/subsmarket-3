"""track marketplace expiry reminder state

Revision ID: 20260714_0029
Revises: 20260714_0028
Create Date: 2026-07-14 16:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "20260714_0029"
down_revision = "20260714_0028"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "marketplace_listings",
        sa.Column("expiry_reminder_sent_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("marketplace_listings", "expiry_reminder_sent_at")
