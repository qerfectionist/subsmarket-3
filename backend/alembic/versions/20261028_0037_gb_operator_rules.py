"""official GB transfer rules, operator end date and seller maximum

Revision ID: 20261028_0037
Revises: 20261028_0036
Create Date: 2026-10-28
"""

from __future__ import annotations

from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any

import sqlalchemy as sa

from alembic import op

revision = "20261028_0037"
down_revision = "20261028_0036"
branch_labels = None
depends_on = None

VERIFIED_AT = datetime(2026, 10, 27, tzinfo=UTC)

# Checked 27.10.2026 on the operators' sites; mirrored in
# subsmarket/marketplace/operator_catalog.py for development databases.
OPERATORS: list[dict[str, Any]] = [
    {
        "slug": "tele2",
        "is_active": True,
        "min_lot_gb": Decimal("3.00"),
        "max_lot_gb": Decimal("50.00"),
        "amount_step_gb": Decimal("1.00"),
        "validity_days": 7,
        "fee_note": (
            "Бесплатно на большинстве тарифов. На части тарифов 200 ₸ за перевод, "
            "поэтому минимум 3 ГБ."
        ),
        "conditions": (
            "Только Tele2 → Tele2. Одному получателю до 50 ГБ в месяц. "
            "У отправителя должен остаться 1 ГБ. Продлить ГБ на 7 дней — 290 ₸."
        ),
        "source_url": "https://new.tele2.kz/new/transfer-resources",
        "available_until": None,
    },
    {
        "slug": "beeline",
        "is_active": True,
        "min_lot_gb": Decimal("2.00"),
        "max_lot_gb": None,
        "amount_step_gb": Decimal("1.00"),
        "validity_days": 3,
        "fee_note": (
            "99 ₸ за отправку на части тарифов. Бесплатно на «Мега за 7999+» "
            "и «ЭкстраSIM»."
        ),
        "conditions": (
            "Только в приложении Janymda, на тарифах с кнопкой «Дари Гиги». "
            "У отправителя должно остаться не меньше 500 МБ. "
            "Услуга работает до 10.12.2026."
        ),
        "source_url": "https://beeline.kz/ru/products/services/dari-gigi",
        "available_until": date(2026, 12, 10),
    },
    {
        "slug": "activ",
        "is_active": True,
        "min_lot_gb": Decimal("1.00"),
        "max_lot_gb": Decimal("20.00"),
        "amount_step_gb": Decimal("1.00"),
        "validity_days": 7,
        "fee_note": "Бесплатно на тарифах «Лучше», на остальных 90 ₸ за 1 ГБ.",
        "conditions": (
            "Только на номера activ и Kcell, не больше 20 ГБ за раз. "
            "У отправителя должно остаться не меньше 500 МБ. "
            "С семейных тарифов передавать нельзя."
        ),
        "source_url": "https://activ.kz/gb-general",
        "available_until": None,
    },
    {
        "slug": "kcell",
        "is_active": False,
        "conditions": "Передача ГБ такая же, как у activ: выбирайте activ.",
    },
    {
        "slug": "altel",
        "is_active": False,
        "conditions": "У Altel нет услуги передачи ГБ.",
    },
    {"slug": "izi", "is_active": False, "conditions": "У Izi нет услуги передачи ГБ."},
]
FIELDS = (
    "is_active",
    "min_lot_gb",
    "max_lot_gb",
    "amount_step_gb",
    "validity_days",
    "fee_note",
    "conditions",
    "source_url",
    "available_until",
)


def upgrade() -> None:
    op.add_column(
        "marketplace_operators", sa.Column("available_until", sa.Date(), nullable=True)
    )
    op.add_column(
        "marketplace_listings", sa.Column("max_gb", sa.Integer(), nullable=True)
    )
    op.create_check_constraint(
        "marketplace_listing_max_gb_ck",
        "marketplace_listings",
        "max_gb IS NULL OR max_gb >= 1",
    )
    operators = sa.table(
        "marketplace_operators",
        sa.column("slug", sa.Text()),
        sa.column("is_active", sa.Boolean()),
        sa.column("min_lot_gb", sa.Numeric(8, 2)),
        sa.column("max_lot_gb", sa.Numeric(8, 2)),
        sa.column("amount_step_gb", sa.Numeric(8, 2)),
        sa.column("validity_days", sa.Integer()),
        sa.column("fee_note", sa.Text()),
        sa.column("conditions", sa.Text()),
        sa.column("source_url", sa.Text()),
        sa.column("available_until", sa.Date()),
        sa.column("verified_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )
    for row in OPERATORS:
        values = {field: row.get(field) for field in FIELDS}
        values["verified_at"] = VERIFIED_AT
        values["updated_at"] = VERIFIED_AT
        op.execute(
            operators.update().where(operators.c.slug == row["slug"]).values(**values)
        )


def downgrade() -> None:
    op.drop_constraint(
        "marketplace_listing_max_gb_ck", "marketplace_listings", type_="check"
    )
    op.drop_column("marketplace_listings", "max_gb")
    op.drop_column("marketplace_operators", "available_until")
