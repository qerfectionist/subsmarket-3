"""family service types

Revision ID: 20260617_0005
Revises: 20260617_0004
Create Date: 2026-06-17
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "20260617_0005"
down_revision = "20260617_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "family_services",
        sa.Column(
            "family_type",
            sa.Text(),
            nullable=False,
            server_default="subscription",
        ),
    )
    op.create_check_constraint(
        "family_services_family_type_check",
        "family_services",
        "family_type in ('subscription', 'tariff')",
    )
    op.create_index(
        "family_services_type_status_category_idx",
        "family_services",
        ["family_type", "status", "category"],
    )

    op.add_column(
        "families",
        sa.Column(
            "family_type",
            sa.Text(),
            nullable=False,
            server_default="subscription",
        ),
    )
    op.create_check_constraint(
        "families_family_type_check",
        "families",
        "family_type in ('subscription', 'tariff')",
    )
    op.create_index(
        "families_type_status_idx",
        "families",
        ["family_type", "status"],
    )


def downgrade() -> None:
    op.drop_index("families_type_status_idx", table_name="families")
    op.drop_constraint("families_family_type_check", "families", type_="check")
    op.drop_column("families", "family_type")

    op.drop_index(
        "family_services_type_status_category_idx",
        table_name="family_services",
    )
    op.drop_constraint(
        "family_services_family_type_check",
        "family_services",
        type_="check",
    )
    op.drop_column("family_services", "family_type")
