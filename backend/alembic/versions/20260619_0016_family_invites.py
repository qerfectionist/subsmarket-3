"""family invites

Revision ID: 20260619_0016
Revises: 20260619_0015
Create Date: 2026-06-19 19:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "20260619_0016"
down_revision = "20260619_0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "families",
        sa.Column(
            "is_search_visible",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )
    op.create_table(
        "family_invites",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("family_id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("revoked_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "length(code) = 8",
            name="family_invite_code_length_ck",
        ),
        sa.CheckConstraint(
            "status in ('active', 'revoked')",
            name="family_invite_status_ck",
        ),
        sa.ForeignKeyConstraint(
            ["family_id"],
            ["families.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code", name="family_invites_code_key"),
    )
    op.create_index(
        "family_invites_family_id_idx",
        "family_invites",
        ["family_id"],
    )
    op.create_index(
        "family_invite_one_active_idx",
        "family_invites",
        ["family_id"],
        unique=True,
        postgresql_where=sa.text("status = 'active'"),
        sqlite_where=sa.text("status = 'active'"),
    )

    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    op.execute("ALTER TABLE public.family_invites ENABLE ROW LEVEL SECURITY")
    if _has_role("anon") and _has_role("authenticated"):
        op.execute(
            "REVOKE ALL ON TABLE public.family_invites FROM anon, authenticated"
        )
        op.execute(
            """
            CREATE POLICY family_invites_deny_client_roles
            ON public.family_invites
            FOR ALL
            TO anon, authenticated
            USING (false)
            WITH CHECK (false)
            """
        )


def downgrade() -> None:
    op.drop_index("family_invite_one_active_idx", table_name="family_invites")
    op.drop_index("family_invites_family_id_idx", table_name="family_invites")
    op.drop_table("family_invites")
    op.drop_column("families", "is_search_visible")


def _has_role(role: str) -> bool:
    bind = op.get_bind()
    return bool(
        bind.execute(
            sa.text("select 1 from pg_roles where rolname = :role"),
            {"role": role},
        ).scalar()
    )
