from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from subsmarket.core.config import settings
from subsmarket.core.database import get_db
from subsmarket.core.rate_limit import reset_rate_limiter
from subsmarket.dev.cleanup import clean_all_cards, clean_archive, purge_all_test_data
from subsmarket.dev.demo_data import seed_demo_account_orders
from subsmarket.dev.seed_incoming_cards import reset_and_reseed_all

router = APIRouter(prefix="/api/dev", tags=["dev"])


def require_development() -> None:
    if not settings.is_development or not settings.dev_auth_enabled:
        raise HTTPException(status_code=404, detail="NOT_FOUND")


@router.post("/reset-demo-data")
def reset_demo_data(
    db: Session = Depends(get_db),
    _: None = Depends(require_development),
) -> dict[str, int]:
    reset_rate_limiter()
    return purge_all_test_data(db)


@router.post("/seed-account-orders")
def seed_account_orders(
    db: Session = Depends(get_db),
    _: None = Depends(require_development),
) -> dict[str, int]:
    return seed_demo_account_orders(db)


@router.post("/clear-archive")
def clear_archive_endpoint(
    db: Session = Depends(get_db),
    _: None = Depends(require_development),
) -> dict[str, int]:
    reset_rate_limiter()
    return clean_archive(db)


@router.post("/clean-all")
def clean_all_endpoint(
    db: Session = Depends(get_db),
    _: None = Depends(require_development),
) -> dict[str, int]:
    reset_rate_limiter()
    return clean_all_cards(db)


@router.post("/purge-all")
def purge_all_endpoint(
    db: Session = Depends(get_db),
    _: None = Depends(require_development),
) -> dict[str, int]:
    reset_rate_limiter()
    return purge_all_test_data(db)


@router.post("/reset-and-seed")
def reset_and_seed_endpoint(
    db: Session = Depends(get_db),
    _: None = Depends(require_development),
) -> dict[str, int]:
    reset_rate_limiter()
    return reset_and_reseed_all(db)
