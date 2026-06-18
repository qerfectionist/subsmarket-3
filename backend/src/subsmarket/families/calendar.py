from __future__ import annotations

import calendar
from datetime import UTC, date, datetime, time


def add_months(value: date, months: int) -> date:
    year = value.year + (value.month - 1 + months) // 12
    month = (value.month - 1 + months) % 12 + 1
    day = min(value.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def add_payment_period(value: date, period: str) -> date:
    if period == "yearly":
        return add_months(value, 12)
    return add_months(value, 1)


def payment_due_at(value: date) -> datetime:
    return datetime.combine(value, time.min, tzinfo=UTC)
