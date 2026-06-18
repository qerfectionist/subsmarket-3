"""family engine

Revision ID: 20260616_0002
Revises: 20260616_0001
Create Date: 2026-06-16
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "20260616_0002"
down_revision = "20260616_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "families",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("service_id", sa.Uuid(), nullable=False),
        sa.Column("owner_user_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("period", sa.Text(), nullable=False),
        sa.Column("max_members", sa.Integer(), nullable=False),
        sa.Column("active_members_count", sa.Integer(), nullable=False),
        sa.Column("has_been_full", sa.Boolean(), nullable=False),
        sa.Column("total_price_kzt", sa.Integer(), nullable=False),
        sa.Column("member_share_kzt", sa.Integer(), nullable=False),
        sa.Column("rounding_delta_kzt", sa.Integer(), nullable=False),
        sa.Column("payment_day", sa.Integer(), nullable=False),
        sa.Column("next_payment_date", sa.Date(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("owner_rules", sa.Text(), nullable=True),
        sa.Column("closing_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closes_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("status in ('active', 'full', 'closing', 'closed')"),
        sa.CheckConstraint("period in ('monthly', 'yearly')"),
        sa.CheckConstraint("max_members >= 2 and max_members <= 8"),
        sa.CheckConstraint("active_members_count >= 1"),
        sa.CheckConstraint("active_members_count <= max_members"),
        sa.CheckConstraint("total_price_kzt > 0"),
        sa.CheckConstraint("member_share_kzt > 0"),
        sa.CheckConstraint("rounding_delta_kzt >= 0"),
        sa.CheckConstraint("payment_day >= 1 and payment_day <= 31"),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["service_id"], ["family_services.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "families_search_idx",
        "families",
        ["service_id", "period", "status", "next_payment_date"],
    )
    op.create_index("families_owner_idx", "families", ["owner_user_id", "status"])

    op.create_table(
        "family_payment_requisites",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("family_id", sa.Uuid(), nullable=False),
        sa.Column("bank", sa.Text(), nullable=False),
        sa.Column("encrypted_phone", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("bank in ('kaspi', 'halyk', 'freedom', 'jusan')"),
        sa.ForeignKeyConstraint(["family_id"], ["families.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("family_id"),
    )

    op.create_table(
        "family_members",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("family_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("role", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("access_provided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("access_confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("removal_scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("left_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("removed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("role in ('owner', 'member')"),
        sa.CheckConstraint(
            "status in ("
            "'awaiting_access', 'awaiting_confirmation', 'payment_due', 'active', "
            "'removal_pending', 'left', 'removed', 'cancelled_before_access'"
            ")"
        ),
        sa.ForeignKeyConstraint(["family_id"], ["families.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "family_one_owner_idx",
        "family_members",
        ["family_id"],
        unique=True,
        postgresql_where=sa.text("role = 'owner'"),
    )
    op.create_index(
        "family_active_member_unique_idx",
        "family_members",
        ["family_id", "user_id"],
        unique=True,
        postgresql_where=sa.text(
            "status in ("
            "'awaiting_access', 'awaiting_confirmation', 'payment_due', "
            "'active', 'removal_pending'"
            ")"
        ),
    )
    op.create_index(
        "family_members_user_idx",
        "family_members",
        ["user_id", "status"],
    )

    op.create_table(
        "family_requests",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("family_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("cancel_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expired_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status in ('pending', 'approved', 'rejected', 'cancelled', 'expired')"
        ),
        sa.CheckConstraint(
            "cancel_reason is null or cancel_reason in ("
            "'user_cancelled', 'family_full', "
            "'owner_cancelled_before_access', 'candidate_cancelled_before_access'"
            ")"
        ),
        sa.ForeignKeyConstraint(["family_id"], ["families.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "family_pending_request_unique_idx",
        "family_requests",
        ["family_id", "user_id"],
        unique=True,
        postgresql_where=sa.text("status = 'pending'"),
    )
    op.create_index(
        "family_requests_owner_queue_idx",
        "family_requests",
        ["family_id", "status", "created_at"],
    )
    op.create_index(
        "family_requests_user_idx",
        "family_requests",
        ["user_id", "status", "created_at"],
    )

    op.create_table(
        "family_request_restrictions",
        sa.Column("family_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["family_id"], ["families.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("family_id", "user_id"),
    )

    op.create_table(
        "family_payments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("family_id", sa.Uuid(), nullable=False),
        sa.Column("member_id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("amount_kzt", sa.Integer(), nullable=False),
        sa.Column("period", sa.Text(), nullable=False),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("period_end", sa.Date(), nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("requisites_opened_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reported_paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("confirmed_paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("overdue_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("kind in ('first', 'regular', 'prepaid')"),
        sa.CheckConstraint(
            "status in ('scheduled', 'due', 'payment_reported', 'paid', 'overdue')"
        ),
        sa.CheckConstraint("period in ('monthly', 'yearly')"),
        sa.CheckConstraint("amount_kzt > 0"),
        sa.ForeignKeyConstraint(["family_id"], ["families.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["member_id"], ["family_members.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "member_id",
            "period_start",
            "period_end",
            "kind",
            name="family_payment_unique_period_uq",
        ),
    )
    op.create_index("family_payments_due_idx", "family_payments", ["status", "due_at"])
    op.create_index(
        "family_payments_member_idx",
        "family_payments",
        ["member_id", "status"],
    )


def downgrade() -> None:
    op.drop_index("family_payments_member_idx", table_name="family_payments")
    op.drop_index("family_payments_due_idx", table_name="family_payments")
    op.drop_table("family_payments")
    op.drop_table("family_request_restrictions")
    op.drop_index("family_requests_user_idx", table_name="family_requests")
    op.drop_index("family_requests_owner_queue_idx", table_name="family_requests")
    op.drop_index("family_pending_request_unique_idx", table_name="family_requests")
    op.drop_table("family_requests")
    op.drop_index("family_members_user_idx", table_name="family_members")
    op.drop_index("family_active_member_unique_idx", table_name="family_members")
    op.drop_index("family_one_owner_idx", table_name="family_members")
    op.drop_table("family_members")
    op.drop_table("family_payment_requisites")
    op.drop_index("families_owner_idx", table_name="families")
    op.drop_index("families_search_idx", table_name="families")
    op.drop_table("families")
