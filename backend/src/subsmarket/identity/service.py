from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from subsmarket.core.config import settings
from subsmarket.core.database import utcnow
from subsmarket.identity.avatars import generate_public_name_candidates
from subsmarket.identity.models import PublicNamePool, User
from subsmarket.identity.schemas import TelegramUserData

DEVELOPMENT_POOL_BOOTSTRAP_SIZE = 256


class PublicNamePoolExhausted(RuntimeError):
    """Raised when no public name can be assigned safely."""


def assign_public_name(db: Session, user: User) -> str:
    """Claim one prepared public name inside the caller's transaction."""
    if user.public_name:
        return user.public_name

    # A newly constructed User does not have its UUID until it is flushed.
    db.flush()
    _ensure_development_pool(db)
    pool_entry = db.scalar(
        select(PublicNamePool)
        .where(PublicNamePool.assigned_user_id.is_(None))
        .order_by(PublicNamePool.id.asc())
        .with_for_update(skip_locked=True)
        .limit(1)
    )
    if pool_entry is None:
        raise PublicNamePoolExhausted("PUBLIC_NAME_POOL_EXHAUSTED")

    pool_entry.assigned_user_id = user.id
    pool_entry.assigned_at = utcnow()
    user.public_name = pool_entry.name
    db.flush()
    return pool_entry.name


def seed_public_name_pool(
    db: Session,
    *,
    target_free: int,
) -> int:
    """Add enough new rows to reach the requested number of free names."""
    if target_free < 1:
        raise ValueError("target_free must be positive")

    free_count = int(
        db.scalar(
            select(func.count(PublicNamePool.id)).where(
                PublicNamePool.assigned_user_id.is_(None)
            )
        )
        or 0
    )
    missing = target_free - free_count
    if missing <= 0:
        return 0

    existing_names = set(db.scalars(select(User.public_name)).all())
    existing_names.update(db.scalars(select(PublicNamePool.name)).all())
    candidates = generate_public_name_candidates(existing_names, limit=missing)
    if len(candidates) != missing:
        raise PublicNamePoolExhausted(
            "PUBLIC_NAME_POOL_SOURCE_EXHAUSTED: "
            f"needed={missing} available={len(candidates)}"
        )
    db.add_all(
        [
            PublicNamePool(name=name, modifier=modifier, mascot=mascot)
            for name, modifier, mascot in candidates
        ]
    )
    db.flush()
    return len(candidates)


def _ensure_development_pool(db: Session) -> None:
    """Keep lightweight SQLite/dev databases usable before migrations are run."""
    if not settings.is_development:
        return
    has_free_name = db.scalar(
        select(PublicNamePool.id)
        .where(PublicNamePool.assigned_user_id.is_(None))
        .limit(1)
    )
    if has_free_name is not None:
        return
    seed_public_name_pool(
        db,
        target_free=DEVELOPMENT_POOL_BOOTSTRAP_SIZE,
    )


def upsert_user(db: Session, telegram_user: TelegramUserData) -> User:
    existing = db.scalar(
        select(User)
        .where(User.telegram_user_id == telegram_user.telegram_user_id)
        .with_for_update()
    )
    if existing:
        try:
            existing.username = telegram_user.username or existing.username
            existing.first_name = telegram_user.first_name
            existing.last_name = telegram_user.last_name
            existing.photo_url = telegram_user.photo_url
            assign_public_name(db, existing)
            db.commit()
            return existing
        except Exception:
            db.rollback()
            raise

    user = User(
        telegram_user_id=telegram_user.telegram_user_id,
        username=telegram_user.username or "",
        first_name=telegram_user.first_name,
        last_name=telegram_user.last_name,
        photo_url=telegram_user.photo_url,
    )
    db.add(user)
    try:
        db.flush()
        assign_public_name(db, user)
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
        try:
            existing.username = telegram_user.username or existing.username
            existing.first_name = telegram_user.first_name
            existing.last_name = telegram_user.last_name
            existing.photo_url = telegram_user.photo_url
            assign_public_name(db, existing)
            db.commit()
            return existing
        except Exception:
            db.rollback()
            raise
    except Exception:
        db.rollback()
        raise
    db.refresh(user)
    return user
