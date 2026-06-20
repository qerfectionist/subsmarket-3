"""add family availability confirmation

Revision ID: 20260620_0019
Revises: 20260620_0018
Create Date: 2026-06-20 18:00:00.000000
"""

from __future__ import annotations

from datetime import timedelta

import sqlalchemy as sa

from alembic import op

revision = "20260620_0019"
down_revision = "20260620_0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "families",
        sa.Column(
            "availability_confirmed_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.add_column(
        "families",
        sa.Column("availability_expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    families = sa.table(
        "families",
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("availability_confirmed_at", sa.DateTime(timezone=True)),
        sa.column("availability_expires_at", sa.DateTime(timezone=True)),
    )
    op.execute(
        families.update().values(
            availability_confirmed_at=families.c.created_at,
            availability_expires_at=families.c.created_at + timedelta(days=3),
        )
    )
    op.create_index(
        "families_search_availability_idx",
        "families",
        ["status", "is_search_visible", "family_type", "availability_confirmed_at"],
    )


def downgrade() -> None:
    op.drop_index("families_search_availability_idx", table_name="families")
    op.drop_column("families", "availability_expires_at")
    op.drop_column("families", "availability_confirmed_at")
