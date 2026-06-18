"""payment cancellation history

Revision ID: 20260618_0008
Revises: 20260618_0007
Create Date: 2026-06-18
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "20260618_0008"
down_revision = "20260618_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "family_payments",
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "family_payments",
        sa.Column("cancel_reason", sa.Text(), nullable=True),
    )
    op.drop_constraint(
        "family_payments_status_check",
        "family_payments",
        type_="check",
    )
    op.create_check_constraint(
        "family_payments_status_check",
        "family_payments",
        "status in ('scheduled', 'due', 'payment_reported', 'paid', "
        "'overdue', 'cancelled')",
    )


def downgrade() -> None:
    op.drop_constraint(
        "family_payments_status_check",
        "family_payments",
        type_="check",
    )
    op.create_check_constraint(
        "family_payments_status_check",
        "family_payments",
        "status in ('scheduled', 'due', 'payment_reported', 'paid', 'overdue')",
    )
    op.drop_column("family_payments", "cancel_reason")
    op.drop_column("family_payments", "cancelled_at")
