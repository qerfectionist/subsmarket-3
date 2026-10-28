"""Official GB transfer rules per operator, checked 27.10.2026.

Production data comes from migration 20261028_0037; this copy seeds
development and test databases. Update both when the rules change.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any

OPERATOR_RULES: list[dict[str, Any]] = [
    {
        "slug": "tele2",
        "name": "Tele2",
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
        "name": "Beeline",
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
        "name": "activ",
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
        "name": "Kcell",
        "is_active": False,
        "conditions": "Передача ГБ такая же, как у activ: выбирайте activ.",
    },
    {
        "slug": "altel",
        "name": "Altel",
        "is_active": False,
        "conditions": "У Altel нет услуги передачи ГБ.",
    },
    {
        "slug": "izi",
        "name": "Izi",
        "is_active": False,
        "conditions": "У Izi нет услуги передачи ГБ.",
    },
]

OPERATOR_FIELDS = (
    "name",
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
