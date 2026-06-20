"""add member removal reason

Revision ID: 20260620_0018
Revises: 20260620_0017
Create Date: 2026-06-20 12:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "20260620_0018"
down_revision = "20260620_0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "family_members",
        sa.Column("removal_reason", sa.Text(), nullable=True),
    )
    op.create_check_constraint(
        "family_members_removal_reason_check",
        "family_members",
        "removal_reason is null or removal_reason in ("
        "'no_payment', 'no_response', 'access_issue', "
        "'mutual_agreement', 'other'"
        ")",
    )


def downgrade() -> None:
    op.drop_constraint(
        "family_members_removal_reason_check",
        "family_members",
        type_="check",
    )
    op.drop_column("family_members", "removal_reason")
