"""idempotency records

Revision ID: 20260619_0015
Revises: 20260619_0014
Create Date: 2026-06-19 18:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "20260619_0015"
down_revision = "20260619_0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "idempotency_records",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("operation", sa.Text(), nullable=False),
        sa.Column("idempotency_key", sa.Text(), nullable=False),
        sa.Column("request_hash", sa.Text(), nullable=False),
        sa.Column("resource_type", sa.Text(), nullable=True),
        sa.Column("resource_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "operation",
            "idempotency_key",
            name="idempotency_record_user_operation_key_uq",
        ),
    )
    op.create_index(
        "idempotency_records_created_at_idx",
        "idempotency_records",
        ["created_at"],
    )

    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    op.execute(
        "ALTER TABLE public.idempotency_records ENABLE ROW LEVEL SECURITY"
    )
    if _has_role("anon") and _has_role("authenticated"):
        op.execute(
            "REVOKE ALL ON TABLE public.idempotency_records FROM anon, authenticated"
        )
        op.execute(
            """
            CREATE POLICY idempotency_records_deny_client_roles
            ON public.idempotency_records
            FOR ALL
            TO anon, authenticated
            USING (false)
            WITH CHECK (false)
            """
        )


def downgrade() -> None:
    op.drop_index(
        "idempotency_records_created_at_idx",
        table_name="idempotency_records",
    )
    op.drop_table("idempotency_records")


def _has_role(role: str) -> bool:
    bind = op.get_bind()
    return bool(
        bind.execute(
            sa.text("select 1 from pg_roles where rolname = :role"),
            {"role": role},
        ).scalar()
    )
