"""add tariff full-speed GB and payment recipient name

Revision ID: 20261028_0034
Revises: 20260916_0033
Create Date: 2026-10-28
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "20261028_0034"
down_revision = "20260916_0033"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("families", sa.Column("full_speed_gb", sa.Integer(), nullable=True))
    op.add_column(
        "family_payment_requisites",
        sa.Column("encrypted_recipient_name", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("family_payment_requisites", "encrypted_recipient_name")
    op.drop_column("families", "full_speed_gb")
