from __future__ import annotations

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from subsmarket.core.database import get_auth_db, get_db
from subsmarket.identity.models import User
from subsmarket.identity.service import upsert_user
from subsmarket.identity.telegram import parse_telegram_user


def get_current_user(
    db: Session = Depends(get_db),
    auth_db: Session = Depends(get_auth_db),
    telegram_user=Depends(parse_telegram_user),
) -> User:
    if not telegram_user.username:
        raise HTTPException(status_code=403, detail="USERNAME_REQUIRED")

    user = upsert_user(auth_db, telegram_user)
    user_id = user.id
    if auth_db is not db:
        auth_db.close()

    fresh = db.get(User, user_id)
    if fresh is None:
        db.expire_all()
        fresh = db.get(User, user_id)
    if fresh is None:
        raise RuntimeError("Authenticated user was not found")
    return fresh
