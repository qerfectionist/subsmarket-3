from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from subsmarket.core.config import settings
from subsmarket.core.database import get_db
from subsmarket.core.rate_limit import reset_rate_limiter
from subsmarket.dev.demo_data import cleanup_demo_data, seed_demo_account_orders

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
    return cleanup_demo_data(db)


@router.post("/seed-account-orders")
def seed_account_orders(
    db: Session = Depends(get_db),
    _: None = Depends(require_development),
) -> dict[str, int]:
    return seed_demo_account_orders(db)
