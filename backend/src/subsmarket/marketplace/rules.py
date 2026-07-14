from __future__ import annotations

from decimal import Decimal

MINIMUM_GB_ORDER = Decimal("1.00")
GB_ORDER_STEP = Decimal("1.00")


def is_whole_gb(value: Decimal) -> bool:
    return value % GB_ORDER_STEP == 0


__all__ = [
    "GB_ORDER_STEP",
    "MINIMUM_GB_ORDER",
    "is_whole_gb",
]
