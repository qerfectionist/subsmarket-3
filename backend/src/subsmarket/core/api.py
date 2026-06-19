from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from subsmarket.core.database import get_db
from subsmarket.core.rate_limit import rate_limit_backend_status

router = APIRouter(tags=["system"])


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/ready")
async def ready(db: Session = Depends(get_db)) -> dict[str, str]:
    try:
        db.execute(text("select 1"))
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="DATABASE_NOT_READY") from exc
    return {
        "status": "ok",
        "database": "ok",
        "rate_limit": await rate_limit_backend_status(),
    }
