"""enforce one gigabyte marketplace minimum

Revision ID: 20260714_0025
Revises: 20260713_0024
Create Date: 2026-07-14 00:30:00.000000
"""

from __future__ import annotations

from alembic import op

revision = "20260714_0025"
down_revision = "20260713_0024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "UPDATE marketplace_operators "
        "SET min_lot_gb = ceil(min_lot_gb) "
        "WHERE min_lot_gb IS NOT NULL "
        "AND (min_lot_gb < 1 OR min_lot_gb <> cast(min_lot_gb as integer))"
    )
    op.execute(
        "UPDATE marketplace_listings "
        "SET minimum_order_gb = ceil(minimum_order_gb) "
        "WHERE minimum_order_gb < 1 "
        "OR minimum_order_gb <> cast(minimum_order_gb as integer)"
    )
    op.execute(
        "UPDATE marketplace_operators "
        "SET amount_step_gb = 1 "
        "WHERE amount_step_gb IS NOT NULL "
        "AND (amount_step_gb < 1 "
        "OR amount_step_gb <> cast(amount_step_gb as integer))"
    )
    op.drop_constraint(
        "marketplace_operator_min_lot_ck",
        "marketplace_operators",
        type_="check",
    )
    op.create_check_constraint(
        "marketplace_operator_min_lot_ck",
        "marketplace_operators",
        "min_lot_gb IS NULL OR "
        "(min_lot_gb >= 1 AND min_lot_gb = cast(min_lot_gb as integer))",
    )
    op.drop_constraint(
        "marketplace_listing_minimum_order_ck",
        "marketplace_listings",
        type_="check",
    )
    op.create_check_constraint(
        "marketplace_listing_minimum_order_ck",
        "marketplace_listings",
        "minimum_order_gb >= 1 AND "
        "minimum_order_gb = cast(minimum_order_gb as integer)",
    )
    op.drop_constraint(
        "marketplace_operator_step_ck",
        "marketplace_operators",
        type_="check",
    )
    op.create_check_constraint(
        "marketplace_operator_step_ck",
        "marketplace_operators",
        "amount_step_gb IS NULL OR "
        "(amount_step_gb >= 1 AND "
        "amount_step_gb = cast(amount_step_gb as integer))",
    )


def downgrade() -> None:
    op.drop_constraint(
        "marketplace_operator_step_ck",
        "marketplace_operators",
        type_="check",
    )
    op.create_check_constraint(
        "marketplace_operator_step_ck",
        "marketplace_operators",
        "amount_step_gb IS NULL OR amount_step_gb > 0",
    )
    op.drop_constraint(
        "marketplace_listing_minimum_order_ck",
        "marketplace_listings",
        type_="check",
    )
    op.create_check_constraint(
        "marketplace_listing_minimum_order_ck",
        "marketplace_listings",
        "minimum_order_gb > 0",
    )
    op.drop_constraint(
        "marketplace_operator_min_lot_ck",
        "marketplace_operators",
        type_="check",
    )
    op.create_check_constraint(
        "marketplace_operator_min_lot_ck",
        "marketplace_operators",
        "min_lot_gb IS NULL OR min_lot_gb > 0",
    )
