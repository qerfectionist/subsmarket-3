"""store the candidate's contact for the invite and «Не работает» reports

Revision ID: 20261028_0036
Revises: 20261028_0035
Create Date: 2026-10-28
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "20261028_0036"
down_revision = "20261028_0035"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for table in ("family_requests", "family_members"):
        op.add_column(table, sa.Column("join_contact_kind", sa.Text(), nullable=True))
        op.add_column(
            table, sa.Column("encrypted_join_contact", sa.Text(), nullable=True)
        )
    op.add_column(
        "family_members",
        sa.Column(
            "access_issue_reported_at", sa.DateTime(timezone=True), nullable=True
        ),
    )


def downgrade() -> None:
    op.drop_column("family_members", "access_issue_reported_at")
    for table in ("family_members", "family_requests"):
        op.drop_column(table, "encrypted_join_contact")
        op.drop_column(table, "join_contact_kind")
