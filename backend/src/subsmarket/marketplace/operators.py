"""Whether an operator's GB transfer service can be used today.

An operator can be switched off by hand (``is_active``) or have a published
end date (``available_until``), like Beeline «Дари Гиги» until 10.12.2026.
After that date its listings disappear and new ones cannot be created.
"""

from __future__ import annotations

from datetime import date

from sqlalchemy import ColumnElement, and_, or_

from subsmarket.core.database import kz_today
from subsmarket.marketplace.models import MarketplaceOperator


def operator_is_open(operator: MarketplaceOperator, today: date | None = None) -> bool:
    if not operator.is_active:
        return False
    if operator.available_until is None:
        return True
    return (today or kz_today()) <= operator.available_until


def operator_open_clause(today: date | None = None) -> ColumnElement[bool]:
    return and_(
        MarketplaceOperator.is_active.is_(True),
        or_(
            MarketplaceOperator.available_until.is_(None),
            MarketplaceOperator.available_until >= (today or kz_today()),
        ),
    )
