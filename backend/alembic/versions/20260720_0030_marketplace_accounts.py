"""add account marketplace vertical

Revision ID: 20260720_0030
Revises: 20260714_0029
Create Date: 2026-07-20 12:00:00.000000
"""

from __future__ import annotations

import re
from datetime import UTC, datetime
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy import text

from alembic import op

revision = "20260720_0030"
down_revision = "20260714_0029"
branch_labels = None
depends_on = None

ACCOUNT_TABLES = (
    "marketplace_account_services",
    "marketplace_account_listings",
    "marketplace_account_requests",
)


def upgrade() -> None:
    op.create_table(
        "marketplace_account_services",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("slug", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index(
        "ix_marketplace_account_services_is_active",
        "marketplace_account_services",
        ["is_active"],
    )

    op.create_table(
        "marketplace_account_listings",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("seller_user_id", sa.Uuid(), nullable=False),
        sa.Column("service_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("price_kzt", sa.Integer(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expiry_reminder_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "status in ('active', 'paused', 'expired', 'archived')",
            name="marketplace_account_listing_status_ck",
        ),
        sa.CheckConstraint(
            "price_kzt > 0", name="marketplace_account_listing_price_ck"
        ),
        sa.CheckConstraint(
            "length(title) between 2 and 100",
            name="marketplace_account_listing_title_length_ck",
        ),
        sa.CheckConstraint(
            "description is null or length(description) <= 500",
            name="marketplace_account_listing_description_length_ck",
        ),
        sa.ForeignKeyConstraint(
            ["seller_user_id"], ["users.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["service_id"], ["marketplace_account_services.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "marketplace_account_listing_catalog_idx",
        "marketplace_account_listings",
        ["status", "service_id", "published_at", "id"],
    )
    op.create_index(
        "marketplace_account_listing_seller_idx",
        "marketplace_account_listings",
        ["seller_user_id", "status", "updated_at"],
    )
    op.create_index(
        "marketplace_account_listing_expiry_idx",
        "marketplace_account_listings",
        ["status", "expires_at"],
    )

    op.create_table(
        "marketplace_account_requests",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("listing_id", sa.Uuid(), nullable=False),
        sa.Column("buyer_user_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("service_slug_snapshot", sa.Text(), nullable=False),
        sa.Column("service_name_snapshot", sa.Text(), nullable=False),
        sa.Column("title_snapshot", sa.Text(), nullable=False),
        sa.Column("price_kzt_snapshot", sa.Integer(), nullable=False),
        sa.Column("outcome", sa.Text(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_reminded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reminder_count", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "status in ('pending', 'accepted', 'rejected', 'cancelled', "
            "'closed', 'expired')",
            name="marketplace_account_request_status_ck",
        ),
        sa.CheckConstraint(
            "price_kzt_snapshot > 0",
            name="marketplace_account_request_price_ck",
        ),
        sa.CheckConstraint(
            "outcome is null or outcome in ('sold', 'not_sold')",
            name="marketplace_account_request_outcome_ck",
        ),
        sa.CheckConstraint(
            "reason is null or length(reason) <= 200",
            name="marketplace_account_request_reason_length_ck",
        ),
        sa.CheckConstraint(
            "reminder_count >= 0",
            name="marketplace_account_request_reminder_count_ck",
        ),
        sa.ForeignKeyConstraint(
            ["listing_id"], ["marketplace_account_listings.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["buyer_user_id"], ["users.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "marketplace_account_request_active_uq",
        "marketplace_account_requests",
        ["listing_id", "buyer_user_id"],
        unique=True,
        postgresql_where=text("status in ('pending', 'accepted')"),
        sqlite_where=text("status in ('pending', 'accepted')"),
    )
    op.create_index(
        "marketplace_account_request_buyer_idx",
        "marketplace_account_requests",
        ["buyer_user_id", "status", "created_at"],
    )
    op.create_index(
        "marketplace_account_request_listing_idx",
        "marketplace_account_requests",
        ["listing_id", "status", "created_at"],
    )

    _seed_services()
    _harden_public_tables()


def downgrade() -> None:
    op.drop_index(
        "marketplace_account_request_listing_idx",
        table_name="marketplace_account_requests",
    )
    op.drop_index(
        "marketplace_account_request_buyer_idx",
        table_name="marketplace_account_requests",
    )
    op.drop_index(
        "marketplace_account_request_active_uq",
        table_name="marketplace_account_requests",
    )
    op.drop_table("marketplace_account_requests")
    op.drop_index(
        "marketplace_account_listing_expiry_idx",
        table_name="marketplace_account_listings",
    )
    op.drop_index(
        "marketplace_account_listing_seller_idx",
        table_name="marketplace_account_listings",
    )
    op.drop_index(
        "marketplace_account_listing_catalog_idx",
        table_name="marketplace_account_listings",
    )
    op.drop_table("marketplace_account_listings")
    op.drop_index(
        "ix_marketplace_account_services_is_active",
        table_name="marketplace_account_services",
    )
    op.drop_table("marketplace_account_services")


def _seed_services() -> None:
    table = sa.table(
        "marketplace_account_services",
        sa.column("id", sa.Uuid()),
        sa.column("slug", sa.Text()),
        sa.column("name", sa.Text()),
        sa.column("is_active", sa.Boolean()),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )
    now = datetime.now(UTC)
    services = (
        ("b0000000-0000-0000-0000-000000000001", "chatgpt", "ChatGPT"),
        ("b0000000-0000-0000-0000-000000000002", "gemini", "Gemini"),
        ("b0000000-0000-0000-0000-000000000003", "grok", "Grok"),
        ("b0000000-0000-0000-0000-000000000004", "canva", "Canva"),
    )
    op.bulk_insert(
        table,
        [
            {
                "id": UUID(service_id),
                "slug": slug,
                "name": name,
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            }
            for service_id, slug, name in services
        ],
    )


def _harden_public_tables() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    has_supabase_roles = _has_role("anon") and _has_role("authenticated")
    for table in ACCOUNT_TABLES:
        table_name = _public_table_name(table)
        op.execute(sa.text(f"ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY"))
        if has_supabase_roles:
            op.execute(
                sa.text(
                    f"REVOKE ALL ON TABLE {table_name} FROM anon, authenticated"
                )
            )


def _public_table_name(table: str) -> str:
    if not re.fullmatch(r"[a-z_][a-z0-9_]*", table):
        raise ValueError(f"Unsafe table identifier: {table}")
    return f'public."{table}"'


def _has_role(role: str) -> bool:
    return bool(
        op.get_bind()
        .execute(
            sa.text("select 1 from pg_roles where rolname = :role"),
            {"role": role},
        )
        .scalar()
    )
