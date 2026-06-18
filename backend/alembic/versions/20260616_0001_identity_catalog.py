"""identity and catalog

Revision ID: 20260616_0001
Revises:
Create Date: 2026-06-16
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "20260616_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("telegram_user_id", sa.BigInteger(), nullable=False),
        sa.Column("username", sa.Text(), nullable=False),
        sa.Column("first_name", sa.Text(), nullable=False),
        sa.Column("last_name", sa.Text(), nullable=True),
        sa.Column("photo_url", sa.Text(), nullable=True),
        sa.Column("status", sa.Text(), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("telegram_user_id"),
    )
    op.create_index("users_username_idx", "users", ["username"])

    op.create_table(
        "family_services",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("slug", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("variant", sa.Text(), nullable=True),
        sa.Column("category", sa.Text(), nullable=False),
        sa.Column("subcategory", sa.Text(), nullable=True),
        sa.Column("max_members", sa.Integer(), nullable=False),
        sa.Column("supported_periods", sa.JSON(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("max_members >= 2 and max_members <= 8"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index(
        "family_services_status_category_idx",
        "family_services",
        ["status", "category"],
    )


def downgrade() -> None:
    op.drop_index("family_services_status_category_idx", table_name="family_services")
    op.drop_table("family_services")
    op.drop_index("users_username_idx", table_name="users")
    op.drop_table("users")
