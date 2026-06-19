"""deadline job indexes

Revision ID: 20260619_0013
Revises: 20260619_0012
Create Date: 2026-06-19 07:20:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "20260619_0013"
down_revision = "20260619_0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "family_requests_pending_expires_idx",
        "family_requests",
        ["expires_at"],
        postgresql_where=sa.text("status = 'pending'"),
    )
    op.create_index(
        "family_members_access_confirmation_due_idx",
        "family_members",
        ["access_provided_at"],
        postgresql_where=sa.text(
            "status = 'awaiting_confirmation' and access_provided_at is not null"
        ),
    )
    op.create_index(
        "family_members_removal_due_idx",
        "family_members",
        ["removal_scheduled_at"],
        postgresql_where=sa.text(
            "status = 'removal_pending' and removal_scheduled_at is not null"
        ),
    )
    op.create_index(
        "family_payments_first_due_idx",
        "family_payments",
        ["due_at"],
        postgresql_where=sa.text("kind = 'first' and status = 'due'"),
    )
    op.create_index(
        "families_closing_due_idx",
        "families",
        ["closes_at"],
        postgresql_where=sa.text("status = 'closing' and closes_at is not null"),
    )


def downgrade() -> None:
    op.drop_index("families_closing_due_idx", table_name="families")
    op.drop_index("family_payments_first_due_idx", table_name="family_payments")
    op.drop_index("family_members_removal_due_idx", table_name="family_members")
    op.drop_index(
        "family_members_access_confirmation_due_idx",
        table_name="family_members",
    )
    op.drop_index("family_requests_pending_expires_idx", table_name="family_requests")
