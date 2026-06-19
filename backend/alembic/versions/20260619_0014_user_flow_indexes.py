"""user flow indexes

Revision ID: 20260619_0014
Revises: 20260619_0013
Create Date: 2026-06-19 15:30:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "20260619_0014"
down_revision = "20260619_0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "family_members_user_status_joined_desc_idx",
        "family_members",
        ["user_id", "status", sa.text("joined_at DESC")],
    )
    op.create_index(
        "family_members_family_joined_idx",
        "family_members",
        ["family_id", "joined_at"],
    )
    op.create_index(
        "family_requests_user_created_desc_idx",
        "family_requests",
        ["user_id", sa.text("created_at DESC")],
    )
    op.create_index(
        "family_payments_member_created_desc_idx",
        "family_payments",
        ["member_id", sa.text("created_at DESC")],
    )


def downgrade() -> None:
    op.drop_index(
        "family_payments_member_created_desc_idx",
        table_name="family_payments",
    )
    op.drop_index(
        "family_requests_user_created_desc_idx",
        table_name="family_requests",
    )
    op.drop_index("family_members_family_joined_idx", table_name="family_members")
    op.drop_index(
        "family_members_user_status_joined_desc_idx",
        table_name="family_members",
    )

