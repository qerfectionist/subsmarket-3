"""add family chats (Telegram group or WhatsApp link)

Revision ID: 20261028_0035
Revises: 20261028_0034
Create Date: 2026-10-28
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "20261028_0035"
down_revision = "20261028_0034"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "family_chats",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "family_id",
            sa.Uuid(),
            sa.ForeignKey("families.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("connect_token", sa.Text(), nullable=False, unique=True),
        sa.Column("telegram_chat_id", sa.BigInteger(), nullable=True, unique=True),
        sa.Column("encrypted_invite_url", sa.Text(), nullable=True),
        sa.Column("connected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "kind in ('telegram', 'whatsapp')", name="family_chat_kind_ck"
        ),
        sa.CheckConstraint(
            "status in ('pending', 'connected')", name="family_chat_status_ck"
        ),
    )
    if op.get_bind().dialect.name == "postgresql":
        op.execute(
            sa.text('ALTER TABLE public."family_chats" ENABLE ROW LEVEL SECURITY')
        )
        has_roles = op.get_bind().scalar(
            sa.text(
                "select count(*) from pg_roles "
                "where rolname in ('anon', 'authenticated')"
            )
        )
        if has_roles == 2:
            op.execute(
                sa.text(
                    'REVOKE ALL ON TABLE public."family_chats" FROM anon, authenticated'
                )
            )


def downgrade() -> None:
    op.drop_table("family_chats")
