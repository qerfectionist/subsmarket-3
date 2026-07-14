"""add family tariff plan name

Revision ID: 20260713_0022
Revises: 20260622_0021
Create Date: 2026-07-13 12:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "20260713_0022"
down_revision = "20260622_0021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("families", sa.Column("plan_name", sa.Text(), nullable=True))
    op.create_check_constraint(
        "families_plan_name_length_ck",
        "families",
        "plan_name is null or (length(trim(plan_name)) between 1 and 120)",
    )


def downgrade() -> None:
    op.drop_constraint(
        "families_plan_name_length_ck",
        "families",
        type_="check",
    )
    op.drop_column("families", "plan_name")
