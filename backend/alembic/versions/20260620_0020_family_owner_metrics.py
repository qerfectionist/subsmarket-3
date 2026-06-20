"""add family owner metrics

Revision ID: 20260620_0020
Revises: 20260620_0019
Create Date: 2026-06-20 19:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy import text

from alembic import op

revision = "20260620_0020"
down_revision = "20260620_0019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "family_owner_metrics",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("owner_user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "requests_received_count",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "requests_approved_count",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "requests_rejected_count",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "requests_expired_count",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "requests_cancelled_by_candidate_count",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column("responses_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "response_time_seconds_total",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "last_request_received_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column("last_response_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_request_expired_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "owner_user_id",
            name="family_owner_metrics_owner_user_id_uq",
        ),
    )
    op.create_index(
        "family_owner_metrics_owner_user_id_idx",
        "family_owner_metrics",
        ["owner_user_id"],
    )
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(
            text(
                'ALTER TABLE public."family_owner_metrics" '
                "ENABLE ROW LEVEL SECURITY"
            )
        )
        if _has_role("anon") and _has_role("authenticated"):
            op.execute(
                text(
                    'REVOKE ALL ON TABLE public."family_owner_metrics" '
                    "FROM anon, authenticated"
                )
            )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(
            text(
                'ALTER TABLE public."family_owner_metrics" '
                "DISABLE ROW LEVEL SECURITY"
            )
        )
    op.drop_index(
        "family_owner_metrics_owner_user_id_idx",
        table_name="family_owner_metrics",
    )
    op.drop_table("family_owner_metrics")


def _has_role(role: str) -> bool:
    bind = op.get_bind()
    return bool(
        bind.execute(
            text("select 1 from pg_roles where rolname = :role"),
            {"role": role},
        ).scalar()
    )
