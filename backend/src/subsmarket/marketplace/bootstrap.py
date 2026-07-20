from __future__ import annotations

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from subsmarket.core.database import utcnow
from subsmarket.marketplace.account_models import MarketplaceAccountService
from subsmarket.marketplace.models import MarketplaceOperator
from subsmarket.marketplace.rules import GB_ORDER_STEP, MINIMUM_GB_ORDER


def ensure_development_marketplace_catalog(db: Session) -> int:
    created = _ensure_account_services(db)
    existing = db.scalar(
        select(MarketplaceOperator.id).where(MarketplaceOperator.slug == "tele2")
    )
    if existing is not None:
        return created
    now = utcnow()
    db.add(
        MarketplaceOperator(
            slug="tele2",
            name="Tele2",
            is_active=True,
            min_lot_gb=MINIMUM_GB_ORDER,
            max_lot_gb=Decimal("50.00"),
            amount_step_gb=GB_ORDER_STEP,
            validity_days=7,
            fee_note=(
                "Бесплатно на актуальных тарифах; на части архивных "
                "тарифов комиссия 100 ₸."
            ),
            conditions=(
                "Только Tele2 → Tele2. У отправителя должны остаться "
                "минимум 1 ГБ и 10 минут."
            ),
            source_url="https://new.tele2.kz/new/transfer-resources",
            verified_at=now,
        )
    )
    db.flush()
    return created + 1


def _ensure_account_services(db: Session) -> int:
    existing = set(db.scalars(select(MarketplaceAccountService.slug)).all())
    services = (
        ("chatgpt", "ChatGPT"),
        ("gemini", "Gemini"),
        ("grok", "Grok"),
        ("canva", "Canva"),
    )
    missing = [
        MarketplaceAccountService(slug=slug, name=name, is_active=True)
        for slug, name in services
        if slug not in existing
    ]
    if missing:
        db.add_all(missing)
        db.flush()
    return len(missing)


__all__ = ["ensure_development_marketplace_catalog"]
