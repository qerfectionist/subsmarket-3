"""replace mobile data lots with seller inventory

Revision ID: 20260713_0024
Revises: 20260713_0023
Create Date: 2026-07-13 22:30:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy import text

from alembic import op

revision = "20260713_0024"
down_revision = "20260713_0023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "marketplace_listings",
        sa.Column("stock_gb", sa.Numeric(8, 2), nullable=True),
    )
    op.add_column(
        "marketplace_listings",
        sa.Column(
            "reserved_gb",
            sa.Numeric(8, 2),
            nullable=True,
            server_default="0",
        ),
    )
    op.add_column(
        "marketplace_listings",
        sa.Column("price_per_gb_kzt", sa.Integer(), nullable=True),
    )
    op.add_column(
        "marketplace_listings",
        sa.Column("minimum_order_gb", sa.Numeric(8, 2), nullable=True),
    )
    op.add_column(
        "marketplace_listing_requests",
        sa.Column("price_per_gb_kzt_snapshot", sa.Integer(), nullable=True),
    )
    op.add_column(
        "marketplace_listing_requests",
        sa.Column("outcome", sa.Text(), nullable=True),
    )

    op.execute(
        text(
            """
            UPDATE marketplace_listings
            SET stock_gb = amount_gb,
                reserved_gb = 0,
                price_per_gb_kzt = CASE
                    WHEN round(total_price_kzt / amount_gb) < 1 THEN 1
                    ELSE CAST(round(total_price_kzt / amount_gb) AS INTEGER)
                END,
                minimum_order_gb = amount_gb
            """
        )
    )
    op.execute(
        text(
            """
            UPDATE marketplace_listing_requests
            SET price_per_gb_kzt_snapshot = CASE
                WHEN round(total_price_kzt_snapshot / amount_gb_snapshot) < 1 THEN 1
                ELSE CAST(
                    round(total_price_kzt_snapshot / amount_gb_snapshot) AS INTEGER
                )
            END
            """
        )
    )
    # Old accepted requests had no inventory reservation. Treating them as
    # reserved after the migration could oversell stock, so close them without
    # a sale and let users create a fresh request under the new rules.
    op.execute(
        text(
            """
            UPDATE marketplace_listing_requests
            SET status = 'closed',
                outcome = 'not_sold',
                closed_at = CURRENT_TIMESTAMP,
                reason = 'Заявка закрыта при переходе на учёт доступного остатка.'
            WHERE status = 'accepted'
            """
        )
    )

    # Keep the most recently updated managed listing for each seller/operator.
    # Older duplicates are archived before the partial unique index is added.
    op.execute(
        text(
            """
            WITH ranked AS (
                SELECT id,
                       row_number() OVER (
                           PARTITION BY seller_user_id, operator_id
                           ORDER BY updated_at DESC, id DESC
                       ) AS position
                FROM marketplace_listings
                WHERE status IN ('active', 'paused', 'expired')
            )
            UPDATE marketplace_listings
            SET status = 'archived'
            WHERE id IN (SELECT id FROM ranked WHERE position > 1)
            """
        )
    )
    op.execute(
        text(
            """
            UPDATE marketplace_listing_requests
            SET status = 'expired',
                decided_at = CURRENT_TIMESTAMP,
                reason = 'Объявление объединено с более новым предложением продавца.'
            WHERE status = 'pending'
              AND listing_id IN (
                  SELECT id FROM marketplace_listings WHERE status = 'archived'
              )
            """
        )
    )

    op.alter_column("marketplace_listings", "stock_gb", nullable=False)
    op.alter_column(
        "marketplace_listings",
        "reserved_gb",
        nullable=False,
        server_default=None,
    )
    op.alter_column("marketplace_listings", "price_per_gb_kzt", nullable=False)
    op.alter_column("marketplace_listings", "minimum_order_gb", nullable=False)
    op.alter_column(
        "marketplace_listing_requests",
        "price_per_gb_kzt_snapshot",
        nullable=False,
    )

    op.drop_constraint(
        "marketplace_listing_amount_ck",
        "marketplace_listings",
        type_="check",
    )
    op.drop_constraint(
        "marketplace_listing_price_ck",
        "marketplace_listings",
        type_="check",
    )
    op.drop_column("marketplace_listings", "amount_gb")
    op.drop_column("marketplace_listings", "total_price_kzt")

    op.create_check_constraint(
        "marketplace_listing_stock_ck",
        "marketplace_listings",
        "stock_gb >= 0",
    )
    op.create_check_constraint(
        "marketplace_listing_reserved_ck",
        "marketplace_listings",
        "reserved_gb >= 0 and reserved_gb <= stock_gb",
    )
    op.create_check_constraint(
        "marketplace_listing_unit_price_ck",
        "marketplace_listings",
        "price_per_gb_kzt > 0",
    )
    op.create_check_constraint(
        "marketplace_listing_minimum_order_ck",
        "marketplace_listings",
        "minimum_order_gb > 0",
    )
    op.create_check_constraint(
        "marketplace_request_unit_price_ck",
        "marketplace_listing_requests",
        "price_per_gb_kzt_snapshot > 0",
    )
    op.create_check_constraint(
        "marketplace_request_outcome_ck",
        "marketplace_listing_requests",
        "outcome is null or outcome in ('sold', 'not_sold')",
    )
    op.create_index(
        "marketplace_listing_active_seller_operator_uq",
        "marketplace_listings",
        ["seller_user_id", "operator_id"],
        unique=True,
        postgresql_where=text("status in ('active', 'paused', 'expired')"),
        sqlite_where=text("status in ('active', 'paused', 'expired')"),
    )


def downgrade() -> None:
    op.drop_index(
        "marketplace_listing_active_seller_operator_uq",
        table_name="marketplace_listings",
    )
    op.drop_constraint(
        "marketplace_request_outcome_ck",
        "marketplace_listing_requests",
        type_="check",
    )
    op.drop_constraint(
        "marketplace_request_unit_price_ck",
        "marketplace_listing_requests",
        type_="check",
    )
    op.drop_constraint(
        "marketplace_listing_minimum_order_ck",
        "marketplace_listings",
        type_="check",
    )
    op.drop_constraint(
        "marketplace_listing_unit_price_ck",
        "marketplace_listings",
        type_="check",
    )
    op.drop_constraint(
        "marketplace_listing_reserved_ck",
        "marketplace_listings",
        type_="check",
    )
    op.drop_constraint(
        "marketplace_listing_stock_ck",
        "marketplace_listings",
        type_="check",
    )

    op.add_column(
        "marketplace_listings",
        sa.Column("amount_gb", sa.Numeric(8, 2), nullable=True),
    )
    op.add_column(
        "marketplace_listings",
        sa.Column("total_price_kzt", sa.Integer(), nullable=True),
    )
    op.execute(
        text(
            """
            UPDATE marketplace_listings
            SET amount_gb = CASE
                    WHEN stock_gb > 0 THEN stock_gb
                    ELSE minimum_order_gb
                END,
                total_price_kzt = CAST(
                    round(
                        CASE
                            WHEN stock_gb > 0 THEN stock_gb
                            ELSE minimum_order_gb
                        END * price_per_gb_kzt
                    ) AS INTEGER
                )
            """
        )
    )
    op.alter_column("marketplace_listings", "amount_gb", nullable=False)
    op.alter_column("marketplace_listings", "total_price_kzt", nullable=False)
    op.create_check_constraint(
        "marketplace_listing_amount_ck",
        "marketplace_listings",
        "amount_gb > 0",
    )
    op.create_check_constraint(
        "marketplace_listing_price_ck",
        "marketplace_listings",
        "total_price_kzt > 0",
    )

    op.drop_column("marketplace_listing_requests", "outcome")
    op.drop_column("marketplace_listing_requests", "price_per_gb_kzt_snapshot")
    op.drop_column("marketplace_listings", "minimum_order_gb")
    op.drop_column("marketplace_listings", "price_per_gb_kzt")
    op.drop_column("marketplace_listings", "reserved_gb")
    op.drop_column("marketplace_listings", "stock_gb")
