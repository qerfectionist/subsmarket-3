"""supabase explicit deny policies

Revision ID: 20260619_0011
Revises: 20260619_0010
Create Date: 2026-06-19 00:40:00.000000

"""

from __future__ import annotations

from sqlalchemy import text

from alembic import op

revision = "20260619_0011"
down_revision = "20260619_0010"
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
    if not (_has_role("anon") and _has_role("authenticated")):
        return

    for table in PUBLIC_TABLES:
        op.execute(
            f"""
            CREATE POLICY {table}_deny_client_roles
            ON public.{table}
            FOR ALL
            TO anon, authenticated
            USING (false)
            WITH CHECK (false)
            """
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    if not (_has_role("anon") and _has_role("authenticated")):
        return

    for table in PUBLIC_TABLES:
        op.execute(f"DROP POLICY IF EXISTS {table}_deny_client_roles ON public.{table}")


def _has_role(role: str) -> bool:
    bind = op.get_bind()
    return bool(
        bind.execute(
            text("select 1 from pg_roles where rolname = :role"),
            {"role": role},
        ).scalar()
    )
