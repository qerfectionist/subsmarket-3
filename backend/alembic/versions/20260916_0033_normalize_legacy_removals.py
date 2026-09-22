"""normalize legacy scheduled removals and drop PRO and legacy columns

Revision ID: 20260916_0033
Revises: 20260908_0031
Create Date: 2026-09-21
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "20260916_0033"
down_revision = "20260908_0031"
branch_labels = None
depends_on = None

ACTIVE_MEMBER_STATUSES = (
    "awaiting_access",
    "awaiting_confirmation",
    "payment_due",
    "active",
)
LEGACY_REMOVAL_COLUMNS = (
    "removal_scheduled_at",
    "removal_acknowledged_at",
    "removal_cancel_requested_at",
)
MEMBER_STATUS_CHECK = (
    "status in ("
    "'awaiting_access', 'awaiting_confirmation', 'payment_due', 'active', "
    "'left', 'removed', 'cancelled_before_access'"
    ")"
)
ACTIVE_MEMBER_INDEX_PREDICATE = (
    "status in ("
    "'awaiting_access', 'awaiting_confirmation', 'payment_due', 'active'"
    ")"
)
LEGACY_MEMBER_STATUS_CHECK = (
    "status in ("
    "'awaiting_access', 'awaiting_confirmation', 'payment_due', 'active', "
    "'removal_pending', 'left', 'removed', 'cancelled_before_access'"
    ")"
)
LEGACY_ACTIVE_MEMBER_INDEX_PREDICATE = (
    "status in ("
    "'awaiting_access', 'awaiting_confirmation', 'payment_due', 'active', "
    "'removal_pending'"
    ")"
)


def _columns(table: str) -> set[str]:
    inspector = sa.inspect(op.get_bind())
    return {column["name"] for column in inspector.get_columns(table)}


def _is_postgresql() -> bool:
    return op.get_bind().dialect.name == "postgresql"


def upgrade() -> None:
    bind = op.get_bind()
    legacy_families = list(
        bind.execute(
            sa.text(
                "SELECT DISTINCT family_id FROM family_members "
                "WHERE status = 'removal_pending'"
            )
        ).scalars()
    )
    if legacy_families:
        # Отложенное удаление отменено продуктом: старые записи удаляются сразу.
        bind.execute(
            sa.text(
                "UPDATE family_members SET status = 'removed', "
                "removed_at = COALESCE(removed_at, now()), "
                "removal_reason = COALESCE(removal_reason, 'other') "
                "WHERE status = 'removal_pending'"
            )
        )
        for family_id in legacy_families:
            bind.execute(
                sa.text(
                    "UPDATE families SET active_members_count = ("
                    "SELECT COUNT(*) FROM family_members "
                    "WHERE family_members.family_id = families.id "
                    "AND family_members.status IN :statuses"
                    "), status = CASE WHEN families.status = 'full' "
                    "THEN 'active' ELSE families.status END "
                    "WHERE families.id = :family_id"
                ).bindparams(sa.bindparam("statuses", expanding=True)),
                {"statuses": list(ACTIVE_MEMBER_STATUSES), "family_id": family_id},
            )

    member_columns = _columns("family_members")
    for column in LEGACY_REMOVAL_COLUMNS:
        if column in member_columns:
            op.drop_column("family_members", column)

    if "owner_occupies_slot" in _columns("families"):
        op.drop_column("families", "owner_occupies_slot")

    if "is_pro" in _columns("users"):
        op.drop_column("users", "is_pro")

    if not _is_postgresql():
        # SQLite в тестах строит схему из моделей и не поддерживает
        # drop/add constraint; частичные индексы здесь создаются без предиката.
        return

    # Индекс срока удаления зависел от удаленной колонки.
    op.execute("DROP INDEX IF EXISTS family_members_removal_due_idx")
    op.execute(
        "ALTER TABLE family_members "
        "DROP CONSTRAINT IF EXISTS family_members_status_check"
    )
    op.create_check_constraint(
        "family_members_status_check",
        "family_members",
        MEMBER_STATUS_CHECK,
    )
    op.execute("DROP INDEX IF EXISTS family_active_member_unique_idx")
    op.create_index(
        "family_active_member_unique_idx",
        "family_members",
        ["family_id", "user_id"],
        unique=True,
        postgresql_where=sa.text(ACTIVE_MEMBER_INDEX_PREDICATE),
    )


def downgrade() -> None:
    member_columns = _columns("family_members")
    for column in LEGACY_REMOVAL_COLUMNS:
        if column not in member_columns:
            op.add_column(
                "family_members",
                sa.Column(column, sa.DateTime(timezone=True), nullable=True),
            )

    if "owner_occupies_slot" not in _columns("families"):
        op.add_column(
            "families",
            sa.Column(
                "owner_occupies_slot",
                sa.Boolean(),
                server_default=sa.text("true"),
                nullable=False,
            ),
        )

    if "is_pro" not in _columns("users"):
        op.add_column(
            "users",
            sa.Column(
                "is_pro",
                sa.Boolean(),
                server_default=sa.text("false"),
                nullable=False,
            ),
        )

    if not _is_postgresql():
        return

    op.execute(
        "ALTER TABLE family_members "
        "DROP CONSTRAINT IF EXISTS family_members_status_check"
    )
    op.create_check_constraint(
        "family_members_status_check",
        "family_members",
        LEGACY_MEMBER_STATUS_CHECK,
    )
    op.execute("DROP INDEX IF EXISTS family_active_member_unique_idx")
    op.create_index(
        "family_active_member_unique_idx",
        "family_members",
        ["family_id", "user_id"],
        unique=True,
        postgresql_where=sa.text(LEGACY_ACTIVE_MEMBER_INDEX_PREDICATE),
    )
    op.create_index(
        "family_members_removal_due_idx",
        "family_members",
        ["removal_scheduled_at"],
        postgresql_where=sa.text(
            "status = 'removal_pending' and removal_scheduled_at is not null"
        ),
    )
