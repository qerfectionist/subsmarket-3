from __future__ import annotations

import sys
from collections.abc import Iterator
from pathlib import Path

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

# Ensure tools module can be imported
tools_dir = Path(__file__).resolve().parents[2] / "tools"
if str(tools_dir) not in sys.path:
    sys.path.insert(0, str(tools_dir))

from seed_development_db import (  # noqa: E402
    ensure_users,
    seed_families,
    seed_marketplace,
)

from subsmarket.core.database import Base  # noqa: E402
from subsmarket.families.models import Family  # noqa: E402
from subsmarket.marketplace.models import MarketplaceListing  # noqa: E402
from subsmarket.models import import_models  # noqa: E402


@pytest.fixture()
def db() -> Iterator[Session]:
    import_models()
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with SessionLocal() as session:
        yield session
    Base.metadata.drop_all(engine)
    engine.dispose()


def test_seed_development_db_smoke(db: Session) -> None:
    """Verifies that development database seeding runs without schema drift."""
    users = ensure_users(db)
    assert "demo_owner" in users
    assert "demo_member" in users

    seed_families(db, users)
    families = db.scalars(select(Family)).all()
    assert len(families) >= 1

    seed_marketplace(db, users)
    listings = db.scalars(select(MarketplaceListing)).all()
    assert len(listings) >= 1
