"""query indexes for family engine

Revision ID: 20260618_0009
Revises: 20260618_0008
Create Date: 2026-06-18
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "20260618_0009"
down_revision = "20260618_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "families_discovery_idx",
        "families",
        ["family_type", sa.text("created_at DESC")],
        postgresql_where=sa.text("status = 'active'"),
    )
    op.create_index(
        "family_members_family_status_joined_idx",
        "family_members",
        ["family_id", "status", "joined_at"],
    )
    op.create_index(
        "family_payments_family_status_due_idx",
        "family_payments",
        ["family_id", "status", "due_at"],
    )
    op.create_index(
        "family_request_restrictions_user_idx",
        "family_request_restrictions",
        ["user_id", "family_id"],
    )
    op.create_index(
        "notification_jobs_recipient_event_status_idx",
        "notification_jobs",
        ["recipient_user_id", "event_type", "status"],
    )


def downgrade() -> None:
    op.drop_index(
        "notification_jobs_recipient_event_status_idx",
        table_name="notification_jobs",
    )
    op.drop_index(
        "family_request_restrictions_user_idx",
        table_name="family_request_restrictions",
    )
    op.drop_index(
        "family_payments_family_status_due_idx",
        table_name="family_payments",
    )
    op.drop_index(
        "family_members_family_status_joined_idx",
        table_name="family_members",
    )
    op.drop_index("families_discovery_idx", table_name="families")
