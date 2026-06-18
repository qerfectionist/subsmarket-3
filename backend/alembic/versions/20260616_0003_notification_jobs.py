"""notification jobs

Revision ID: 20260616_0003
Revises: 20260616_0002
Create Date: 2026-06-16
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "20260616_0003"
down_revision = "20260616_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "notification_jobs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("recipient_user_id", sa.Uuid(), nullable=False),
        sa.Column("event_type", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("available_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("status in ('pending', 'sent', 'failed', 'cancelled')"),
        sa.ForeignKeyConstraint(["recipient_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "notification_jobs_dispatch_idx",
        "notification_jobs",
        ["status", "available_at"],
    )
    op.create_index(
        "notification_jobs_recipient_idx",
        "notification_jobs",
        ["recipient_user_id", "status"],
    )
    op.create_index(
        "notification_jobs_event_type_idx",
        "notification_jobs",
        ["event_type"],
    )


def downgrade() -> None:
    op.drop_index("notification_jobs_event_type_idx", table_name="notification_jobs")
    op.drop_index("notification_jobs_recipient_idx", table_name="notification_jobs")
    op.drop_index("notification_jobs_dispatch_idx", table_name="notification_jobs")
    op.drop_table("notification_jobs")
