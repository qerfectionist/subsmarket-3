"""notification dedup index

Revision ID: 20260622_0021
Revises: 20260620_0020
Create Date: 2026-06-22 12:00:00.000000
"""

from __future__ import annotations

from alembic import op

revision = "20260622_0021"
down_revision = "20260620_0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "notification_jobs_recipient_event_created_idx",
        "notification_jobs",
        ["recipient_user_id", "event_type", "created_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "notification_jobs_recipient_event_created_idx",
        table_name="notification_jobs",
    )
