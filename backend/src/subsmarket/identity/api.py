from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from subsmarket.core.database import get_db
from subsmarket.identity.schemas import MeResponse
from subsmarket.identity.service import upsert_user
from subsmarket.identity.telegram import parse_telegram_user

router = APIRouter(prefix="/api", tags=["identity"])


def _me_response(db: Session, telegram_user) -> MeResponse:
    if not telegram_user.username:
        return MeResponse(
            ok=False,
            error="USERNAME_REQUIRED",
            message="Создайте username в Telegram и снова откройте SubsMarket.",
        )

    user = upsert_user(db, telegram_user)
    return MeResponse(ok=True, user=user)


@router.get("/me", response_model=MeResponse)
def get_me(
    db: Session = Depends(get_db),
    telegram_user=Depends(parse_telegram_user),
) -> MeResponse:
    return _me_response(db, telegram_user)


@router.patch("/me/refresh-telegram-profile", response_model=MeResponse)
def refresh_telegram_profile(
    db: Session = Depends(get_db),
    telegram_user=Depends(parse_telegram_user),
) -> MeResponse:
    return _me_response(db, telegram_user)
