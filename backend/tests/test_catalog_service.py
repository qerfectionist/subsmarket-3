from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from subsmarket.catalog.service import import_family_services, list_family_services
from subsmarket.core.database import Base
from subsmarket.models import import_models

CATALOG_FILE = Path(__file__).resolve().parents[2] / "data" / "family-services.json"


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


def test_family_catalog_keeps_subscriptions_and_tariffs_separate(db: Session) -> None:
    imported = import_family_services(db, CATALOG_FILE, activate_demo=True)

    subscriptions = list_family_services(db, family_type="subscription")
    tariffs = list_family_services(db, family_type="tariff")

    assert imported > 0
    assert subscriptions
    assert tariffs
    assert all(service.family_type == "subscription" for service in subscriptions)
    assert all(service.family_type == "tariff" for service in tariffs)
    assert {service.slug for service in tariffs} >= {
        "beeline-family-tariff",
        "tele2-family-tariff",
        "kcell-family-tariff",
    }
    assert all(service.category == "mobile_tariffs" for service in tariffs)
    assert all(service.supported_periods == ["monthly"] for service in tariffs)


def test_catalog_rejects_unsupported_family_type(
    db: Session, tmp_path: Path
) -> None:
    catalog_file = tmp_path / "bad-catalog.json"
    catalog_file.write_text(
        """
        {
          "services": [
            {
              "id": "bad-service",
              "name": "Bad Service",
              "family_type": "marketplace",
              "category": "bad",
              "status": "active"
            }
          ]
        }
        """,
        encoding="utf-8",
    )

    with pytest.raises(ValueError, match="Unsupported family_type"):
        import_family_services(db, catalog_file)
