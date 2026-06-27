from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from subsmarket.core.database import get_auth_db, get_db
from subsmarket.identity.models import User
from subsmarket.identity.schemas import MeResponse
from subsmarket.identity.service import upsert_user
from subsmarket.identity.telegram import parse_telegram_user

router = APIRouter(prefix="/api", tags=["identity"])


def _me_response(db: Session, auth_db: Session, telegram_user) -> MeResponse:
    if not telegram_user.username:
        return MeResponse(
            ok=False,
            error="USERNAME_REQUIRED",
            message="Создайте username в Telegram и снова откройте SubsMarket.",
        )

    user = upsert_user(auth_db, telegram_user)
    user_id = user.id
    # Avoid holding the auth session's connection while the response session
    # needs a connection from the same pool.
    if auth_db is not db:
        auth_db.close()
    fresh = db.get(User, user_id)
    if fresh is None:
        db.expire_all()
        fresh = db.get(User, user_id)
    return MeResponse(ok=True, user=fresh)


@router.get("/me", response_model=MeResponse)
def get_me(
    db: Session = Depends(get_db),
    auth_db: Session = Depends(get_auth_db),
    telegram_user=Depends(parse_telegram_user),
) -> MeResponse:
    return _me_response(db, auth_db, telegram_user)


@router.patch("/me/refresh-telegram-profile", response_model=MeResponse)
def refresh_telegram_profile(
    db: Session = Depends(get_db),
    auth_db: Session = Depends(get_auth_db),
    telegram_user=Depends(parse_telegram_user),
) -> MeResponse:
    return _me_response(db, auth_db, telegram_user)
