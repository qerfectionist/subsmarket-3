"""persist public user names and seed their allocation pool

Revision ID: 20260908_0031
Revises: 20260720_0030
Create Date: 2026-09-08
"""

from __future__ import annotations

from uuid import UUID

import sqlalchemy as sa

from alembic import op
from subsmarket.identity.avatars import (
    PUBLIC_NAME_POOL_TARGET,
    default_avatar_name,
    generate_public_name_candidates,
)

revision = "20260908_0031"
down_revision = "20260720_0030"
branch_labels = None
depends_on = None

PUBLIC_NAME_POOL_TABLE = "public_name_pool"


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("public_name", sa.Text(), nullable=True),
    )
    op.create_index(
        "users_public_name_uq",
        "users",
        ["public_name"],
        unique=True,
    )
    op.create_table(
        "public_name_pool",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("modifier", sa.Text(), nullable=False),
        sa.Column("mascot", sa.Text(), nullable=False),
        sa.Column("assigned_user_id", sa.Uuid(), nullable=True),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["assigned_user_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
        sa.UniqueConstraint("assigned_user_id"),
    )
    op.create_index(
        "public_name_pool_assignment_idx",
        PUBLIC_NAME_POOL_TABLE,
        ["assigned_user_id", "id"],
    )

    _backfill_existing_users()
    _seed_pool()
    _harden_public_name_pool()


def downgrade() -> None:
    _disable_public_name_pool_rls()
    op.drop_index(
        "public_name_pool_assignment_idx",
        table_name=PUBLIC_NAME_POOL_TABLE,
    )
    op.drop_table(PUBLIC_NAME_POOL_TABLE)
    op.drop_index("users_public_name_uq", table_name="users")
    op.drop_column("users", "public_name")


def _backfill_existing_users() -> None:
    bind = op.get_bind()
    users = sa.table(
        "users",
        sa.column("id", sa.Uuid()),
        sa.column("public_name", sa.Text()),
    )
    user_ids = list(
        bind.execute(
            sa.select(users.c.id).where(users.c.public_name.is_(None))
        ).scalars()
    )
    # Preserve the currently displayed legacy alias, including reserved
    # examples. Reserved names are excluded only from newly seeded pool rows.
    seen: set[str] = set()

    for raw_user_id in user_ids:
        user_id = _as_uuid(raw_user_id)
        candidate = default_avatar_name(user_id)
        if candidate in seen:
            replacement = generate_public_name_candidates(seen, limit=1)
            if not replacement:
                raise RuntimeError(
                    "Unable to assign a unique public name during backfill"
                )
            candidate = replacement[0][0]
        seen.add(candidate)
        bind.execute(
            users.update()
            .where(users.c.id == raw_user_id)
            .values(public_name=candidate)
        )


def _seed_pool() -> None:
    bind = op.get_bind()
    users = sa.table(
        "users",
        sa.column("public_name", sa.Text()),
    )
    existing_names = set(
        bind.execute(sa.select(users.c.public_name)).scalars()
    )
    candidates = generate_public_name_candidates(
        existing_names,
        limit=PUBLIC_NAME_POOL_TARGET,
    )
    if len(candidates) != PUBLIC_NAME_POOL_TARGET:
        raise RuntimeError(
            "Public name dictionaries do not contain enough valid unique names: "
            f"{len(candidates)} of {PUBLIC_NAME_POOL_TARGET}"
        )

    pool = sa.table(
        PUBLIC_NAME_POOL_TABLE,
        sa.column("name", sa.Text()),
        sa.column("modifier", sa.Text()),
        sa.column("mascot", sa.Text()),
        sa.column("assigned_user_id", sa.Uuid()),
        sa.column("assigned_at", sa.DateTime(timezone=True)),
    )
    op.bulk_insert(
        pool,
        [
            {
                "name": name,
                "modifier": modifier,
                "mascot": mascot,
                "assigned_user_id": None,
                "assigned_at": None,
            }
            for name, modifier, mascot in candidates
        ],
    )


def _harden_public_name_pool() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    table_name = _qualified_table_name(PUBLIC_NAME_POOL_TABLE)
    op.execute(sa.text(f"ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY"))
    if _has_role("anon") and _has_role("authenticated"):
        op.execute(
            sa.text(
                f"REVOKE ALL ON TABLE {table_name} FROM anon, authenticated"
            )
        )


def _disable_public_name_pool_rls() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(
            sa.text(
                f"ALTER TABLE {_qualified_table_name(PUBLIC_NAME_POOL_TABLE)} "
                "DISABLE ROW LEVEL SECURITY"
            )
        )


def _qualified_table_name(table: str) -> str:
    if not table.isidentifier() or not table.islower():
        raise ValueError(f"Unsafe table identifier: {table}")
    return f'public."{table}"'


def _has_role(role: str) -> bool:
    return bool(
        op.get_bind()
        .execute(
            sa.text("select 1 from pg_roles where rolname = :role"),
            {"role": role},
        )
        .scalar()
    )


def _as_uuid(value: UUID | str) -> UUID:
    return value if isinstance(value, UUID) else UUID(str(value))
