from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from subsmarket.core.database import utcnow
from subsmarket.marketplace.account_catalog import ACCOUNT_CATALOG
from subsmarket.marketplace.account_models import MarketplaceAccountService
from subsmarket.marketplace.models import MarketplaceOperator
from subsmarket.marketplace.operator_catalog import OPERATOR_FIELDS, OPERATOR_RULES


def ensure_development_marketplace_catalog(db: Session) -> int:
    """Creates or refreshes operators with the official transfer rules."""
    created = _ensure_account_services(db)
    now = utcnow()
    for rules in OPERATOR_RULES:
        operator = db.scalar(
            select(MarketplaceOperator).where(MarketplaceOperator.slug == rules["slug"])
        )
        if operator is None:
            operator = MarketplaceOperator(slug=rules["slug"])
            db.add(operator)
            created += 1
        for field in OPERATOR_FIELDS:
            setattr(operator, field, rules.get(field))
        operator.verified_at = now
    db.flush()
    return created


def _ensure_account_services(db: Session) -> int:
    existing = set(db.scalars(select(MarketplaceAccountService.slug)).all())
    missing = [
        MarketplaceAccountService(slug=entry.slug, name=entry.name, is_active=True)
        for entry in ACCOUNT_CATALOG
        if entry.slug not in existing
    ]
    if missing:
        db.add_all(missing)
        db.flush()
    return len(missing)


__all__ = ["ensure_development_marketplace_catalog"]
