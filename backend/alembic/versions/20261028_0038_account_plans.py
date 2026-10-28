"""account listings: plan from the official catalog instead of free text

Revision ID: 20261028_0038
Revises: 20261028_0037
Create Date: 2026-10-28
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import sqlalchemy as sa

from alembic import op

revision = "20261028_0038"
down_revision = "20261028_0037"
branch_labels = None
depends_on = None

# Services added with the plan catalog (subsmarket/marketplace/account_catalog.py).
NEW_SERVICES = (
    ("claude", "Claude"),
    ("perplexity", "Perplexity"),
    ("capcut", "CapCut"),
    ("telegram-premium", "Telegram Premium"),
    ("spotify", "Spotify"),
    ("youtube-premium", "YouTube Premium"),
    ("discord-nitro", "Discord Nitro"),
)

TABLE = "marketplace_account_listings"


def upgrade() -> None:
    op.add_column(TABLE, sa.Column("plan_code", sa.Text(), nullable=True))
    op.add_column(TABLE, sa.Column("period_months", sa.Integer(), nullable=True))
    op.add_column(TABLE, sa.Column("delivery", sa.Text(), nullable=True))
    op.create_check_constraint(
        "marketplace_account_listing_period_ck",
        TABLE,
        "period_months is null or period_months in (1, 3, 6, 12)",
    )
    op.create_check_constraint(
        "marketplace_account_listing_delivery_ck",
        TABLE,
        "delivery is null or delivery in ('own_account', 'ready_account')",
    )

    services = sa.table(
        "marketplace_account_services",
        sa.column("id", sa.Uuid()),
        sa.column("slug", sa.Text()),
        sa.column("name", sa.Text()),
        sa.column("is_active", sa.Boolean()),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )
    bind = op.get_bind()
    existing = set(bind.execute(sa.select(services.c.slug)).scalars().all())
    now = datetime.now(UTC)
    rows = [
        {
            "id": uuid.uuid4(),
            "slug": slug,
            "name": name,
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        }
        for slug, name in NEW_SERVICES
        if slug not in existing
    ]
    if rows:
        op.bulk_insert(services, rows)


def downgrade() -> None:
    bind = op.get_bind()
    services = sa.table(
        "marketplace_account_services",
        sa.column("id", sa.Uuid()),
        sa.column("slug", sa.Text()),
    )
    listings = sa.table(TABLE, sa.column("service_id", sa.Uuid()))
    used = set(bind.execute(sa.select(listings.c.service_id)).scalars().all())
    for slug, _name in NEW_SERVICES:
        service_id = bind.execute(
            sa.select(services.c.id).where(services.c.slug == slug)
        ).scalar()
        if service_id is not None and service_id not in used:
            op.execute(services.delete().where(services.c.id == service_id))
    op.drop_constraint("marketplace_account_listing_delivery_ck", TABLE, type_="check")
    op.drop_constraint("marketplace_account_listing_period_ck", TABLE, type_="check")
    op.drop_column(TABLE, "delivery")
    op.drop_column(TABLE, "period_months")
    op.drop_column(TABLE, "plan_code")
