from __future__ import annotations

from collections.abc import Iterator
from datetime import timedelta

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from subsmarket.core.config import settings
from subsmarket.core.database import Base, utcnow
from subsmarket.core.idempotency import cleanup_expired_idempotency_records
from subsmarket.core.models import IdempotencyRecord
from subsmarket.identity.models import User
from subsmarket.models import import_models


@pytest.fixture()
def db() -> Iterator[Session]:
    import_models()
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with session_factory() as session:
        yield session
    Base.metadata.drop_all(engine)
    engine.dispose()


def test_cleanup_expired_idempotency_records_is_batched(
    db: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = User(
        telegram_user_id=991001,
        username="idempotency_cleanup",
        first_name="Cleanup",
    )
    db.add(user)
    db.flush()
    old_records = [
        IdempotencyRecord(
            user_id=user.id,
            operation=f"old-{index}",
            idempotency_key=f"old-key-{index}",
            request_hash=f"old-hash-{index}",
            created_at=utcnow() - timedelta(days=31, minutes=index),
        )
        for index in range(2)
    ]
    current_record = IdempotencyRecord(
        user_id=user.id,
        operation="current",
        idempotency_key="current-key",
        request_hash="current-hash",
        created_at=utcnow(),
    )
    db.add_all([*old_records, current_record])
    db.commit()
    monkeypatch.setattr(settings, "idempotency_retention_days", 30)
    monkeypatch.setattr(settings, "job_batch_size", 1)

    assert cleanup_expired_idempotency_records(db) == 1
    db.commit()
    assert cleanup_expired_idempotency_records(db) == 1
    db.commit()
    assert cleanup_expired_idempotency_records(db) == 0

    remaining = list(db.scalars(select(IdempotencyRecord)).all())
    assert [record.id for record in remaining] == [current_record.id]
