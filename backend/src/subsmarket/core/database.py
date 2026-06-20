from __future__ import annotations

from collections.abc import Generator
from datetime import UTC, datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from subsmarket.core.config import settings


class Base(DeclarativeBase):
    pass


engine = create_engine(
    settings.sqlalchemy_database_url,
    **settings.sqlalchemy_engine_kwargs,
)
SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)


def utcnow() -> datetime:
    return datetime.now(UTC)


def get_db() -> Generator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
