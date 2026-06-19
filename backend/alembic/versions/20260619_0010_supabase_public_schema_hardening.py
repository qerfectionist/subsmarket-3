"""supabase public schema hardening

Revision ID: 20260619_0010
Revises: 20260618_0009
Create Date: 2026-06-19 00:30:00.000000

"""

from __future__ import annotations

import re

from sqlalchemy import text

from alembic import op

revision = "20260619_0010"
down_revision = "20260618_0009"
branch_labels = None
depends_on = None

PUBLIC_TABLES = (
    "alembic_version",
    "users",
    "family_services",
    "families",
    "family_payment_requisites",
    "family_members",
    "family_requests",
    "family_request_restrictions",
    "family_payments",
    "family_audit_logs",
    "notification_jobs",
)


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    has_supabase_roles = _has_role("anon") and _has_role("authenticated")
    for table in PUBLIC_TABLES:
        table_name = _public_table_name(table)
        op.execute(text(f"ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY"))
        if has_supabase_roles:
            op.execute(
                text(f"REVOKE ALL ON TABLE {table_name} FROM anon, authenticated")
            )

    op.create_index(
        "family_audit_target_member_idx",
        "family_audit_logs",
        ["target_member_id"],
    )
    op.create_index(
        "family_audit_target_request_idx",
        "family_audit_logs",
        ["target_request_id"],
    )
    op.create_index(
        "family_audit_target_payment_idx",
        "family_audit_logs",
        ["target_payment_id"],
    )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    op.drop_index("family_audit_target_payment_idx", table_name="family_audit_logs")
    op.drop_index("family_audit_target_request_idx", table_name="family_audit_logs")
    op.drop_index("family_audit_target_member_idx", table_name="family_audit_logs")

    for table in PUBLIC_TABLES:
        op.execute(
            text(f"ALTER TABLE {_public_table_name(table)} DISABLE ROW LEVEL SECURITY")
        )


def _public_table_name(table: str) -> str:
    if not re.fullmatch(r"[a-z_][a-z0-9_]*", table):
        raise ValueError(f"Unsafe table identifier: {table}")
    return f'public."{table}"'


def _has_role(role: str) -> bool:
    bind = op.get_bind()
    return bool(
        bind.execute(
            text("select 1 from pg_roles where rolname = :role"),
            {"role": role},
        ).scalar()
    )
