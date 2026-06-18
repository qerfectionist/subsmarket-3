from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from subsmarket.core.config import settings
from subsmarket.core.database import get_db
from subsmarket.dev.demo_data import cleanup_demo_data

router = APIRouter(prefix="/api/dev", tags=["dev"])


def require_development() -> None:
    if not settings.is_development:
        raise HTTPException(status_code=404, detail="NOT_FOUND")


@router.post("/reset-demo-data")
def reset_demo_data(
    db: Session = Depends(get_db),
    _: None = Depends(require_development),
) -> dict[str, int]:
    return cleanup_demo_data(db)
