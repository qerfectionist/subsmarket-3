"""family invites: allow 6-digit codes (and legacy 8-digit)

Revision ID: 20261102_0039
Revises: 20261028_0038
Create Date: 2026-11-02
"""

from __future__ import annotations

from alembic import op

revision = "20261102_0039"
down_revision = "20261028_0038"
branch_labels = None
depends_on = None

TABLE = "family_invites"
CONSTRAINT_NAME = "family_invite_code_length_ck"


def upgrade() -> None:
    op.drop_constraint(CONSTRAINT_NAME, TABLE, type_="check")
    op.create_check_constraint(
        CONSTRAINT_NAME,
        TABLE,
        "length(code) in (6, 8)",
    )


def downgrade() -> None:
    op.drop_constraint(CONSTRAINT_NAME, TABLE, type_="check")
    op.create_check_constraint(
        CONSTRAINT_NAME,
        TABLE,
        "length(code) = 8",
    )
