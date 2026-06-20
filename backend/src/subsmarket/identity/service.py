from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from subsmarket.identity.models import User
from subsmarket.identity.schemas import TelegramUserData


def upsert_user(db: Session, telegram_user: TelegramUserData) -> User:
    existing = db.scalar(
        select(User)
        .where(User.telegram_user_id == telegram_user.telegram_user_id)
        .with_for_update()
    )
    if existing:
        existing.username = telegram_user.username or existing.username
        existing.first_name = telegram_user.first_name
        existing.last_name = telegram_user.last_name
        existing.photo_url = telegram_user.photo_url
        db.commit()
        return existing

    user = User(
        telegram_user_id=telegram_user.telegram_user_id,
        username=telegram_user.username or "",
        first_name=telegram_user.first_name,
        last_name=telegram_user.last_name,
        photo_url=telegram_user.photo_url,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = db.scalar(
            select(User).where(
                User.telegram_user_id == telegram_user.telegram_user_id
            )
        )
        if existing is None:
            raise
        existing.username = telegram_user.username or existing.username
        existing.first_name = telegram_user.first_name
        existing.last_name = telegram_user.last_name
        existing.photo_url = telegram_user.photo_url
        db.commit()
        return existing
    return user
