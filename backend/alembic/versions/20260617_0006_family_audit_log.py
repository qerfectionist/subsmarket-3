"""family audit log

Revision ID: 20260617_0006
Revises: 20260617_0005
Create Date: 2026-06-17
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "20260617_0006"
down_revision = "20260617_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "family_audit_logs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("family_id", sa.Uuid(), nullable=False),
        sa.Column("actor_user_id", sa.Uuid(), nullable=True),
        sa.Column("target_user_id", sa.Uuid(), nullable=True),
        sa.Column("target_member_id", sa.Uuid(), nullable=True),
        sa.Column("target_request_id", sa.Uuid(), nullable=True),
        sa.Column("target_payment_id", sa.Uuid(), nullable=True),
        sa.Column("action", sa.Text(), nullable=False),
        sa.Column("old_status", sa.Text(), nullable=True),
        sa.Column("new_status", sa.Text(), nullable=True),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["family_id"], ["families.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["target_member_id"],
            ["family_members.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["target_payment_id"],
            ["family_payments.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["target_request_id"],
            ["family_requests.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(["target_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "family_audit_family_created_idx",
        "family_audit_logs",
        ["family_id", "created_at"],
    )
    op.create_index(
        "family_audit_action_created_idx",
        "family_audit_logs",
        ["action", "created_at"],
    )
    op.create_index(
        "family_audit_actor_created_idx",
        "family_audit_logs",
        ["actor_user_id", "created_at"],
    )
    op.create_index(
        "family_audit_target_user_created_idx",
        "family_audit_logs",
        ["target_user_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "family_audit_target_user_created_idx",
        table_name="family_audit_logs",
    )
    op.drop_index("family_audit_actor_created_idx", table_name="family_audit_logs")
    op.drop_index("family_audit_action_created_idx", table_name="family_audit_logs")
    op.drop_index("family_audit_family_created_idx", table_name="family_audit_logs")
    op.drop_table("family_audit_logs")
