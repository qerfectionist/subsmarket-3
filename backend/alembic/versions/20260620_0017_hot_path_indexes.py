"""hot path indexes

Revision ID: 20260620_0017
Revises: 20260619_0016
Create Date: 2026-06-20 09:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "20260620_0017"
down_revision = "20260619_0016"
branch_labels = None
depends_on = None


VISIBLE_JOINABLE_FAMILY = sa.text(
    "status = 'active' and is_search_visible = true "
    "and active_members_count < max_members"
)


def upgrade() -> None:
    op.create_index(
        "families_discovery_visible_created_idx",
        "families",
        [sa.text("created_at DESC")],
        postgresql_where=VISIBLE_JOINABLE_FAMILY,
    )
    op.create_index(
        "families_discovery_visible_type_created_idx",
        "families",
        ["family_type", sa.text("created_at DESC")],
        postgresql_where=VISIBLE_JOINABLE_FAMILY,
    )
    op.create_index(
        "family_requests_family_user_created_desc_idx",
        "family_requests",
        ["family_id", "user_id", sa.text("created_at DESC")],
    )
    op.create_index(
        "family_payments_member_due_created_desc_idx",
        "family_payments",
        ["member_id", sa.text("due_at DESC"), sa.text("created_at DESC")],
    )
    op.create_index(
        "family_payments_reported_paid_reminder_idx",
        "family_payments",
        [sa.text("reported_paid_at ASC")],
        postgresql_where=sa.text(
            "status = 'payment_reported' and reported_paid_at is not null"
        ),
    )
    op.drop_index("notification_jobs_dispatch_idx", table_name="notification_jobs")
    op.create_index(
        "notification_jobs_dispatch_status_available_created_idx",
        "notification_jobs",
        ["status", sa.text("available_at ASC"), sa.text("created_at ASC")],
    )


def downgrade() -> None:
    op.drop_index(
        "notification_jobs_dispatch_status_available_created_idx",
        table_name="notification_jobs",
    )
    op.create_index(
        "notification_jobs_dispatch_idx",
        "notification_jobs",
        ["status", "available_at"],
    )
    op.drop_index(
        "family_payments_reported_paid_reminder_idx",
        table_name="family_payments",
    )
    op.drop_index(
        "family_payments_member_due_created_desc_idx",
        table_name="family_payments",
    )
    op.drop_index(
        "family_requests_family_user_created_desc_idx",
        table_name="family_requests",
    )
    op.drop_index(
        "families_discovery_visible_type_created_idx",
        table_name="families",
    )
    op.drop_index(
        "families_discovery_visible_created_idx",
        table_name="families",
    )
