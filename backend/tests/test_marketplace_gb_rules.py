from __future__ import annotations

from collections.abc import Iterator
from datetime import date, timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from subsmarket.core.database import Base, get_auth_db, get_db, kz_today
from subsmarket.main import app
from subsmarket.marketplace.bootstrap import ensure_development_marketplace_catalog
from subsmarket.marketplace.models import MarketplaceOperator
from subsmarket.models import import_models


@pytest.fixture()
def db() -> Iterator[Session]:
    import_models()
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with factory() as session:
        ensure_development_marketplace_catalog(session)
        session.commit()
        yield session
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture()
def client(db: Session) -> Iterator[TestClient]:
    def _db_with_commit() -> Iterator[Session]:
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise

    app.dependency_overrides[get_db] = _db_with_commit
    app.dependency_overrides[get_auth_db] = lambda: db
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()


def headers(user_id: int, username: str) -> dict[str, str]:
    return {
        "X-Dev-Telegram-User-Id": str(user_id),
        "X-Dev-Telegram-Username": username,
        "X-Dev-Telegram-First-Name": username,
        "X-Forwarded-For": f"10.71.{user_id % 250}.{(user_id * 7) % 250}",
    }


SELLER = headers(810001, "gb_seller")
BUYER = headers(810002, "gb_buyer")


def publish(client: TestClient, operator: str, *, max_gb: int | None, price: int = 150):
    return client.post(
        "/api/marketplace/listings",
        headers=SELLER,
        json={"operator_slug": operator, "price_per_gb_kzt": price, "max_gb": max_gb},
    )


def test_only_operators_with_a_transfer_service_are_offered(client: TestClient) -> None:
    response = client.get("/api/marketplace/operators", headers=BUYER)

    assert response.status_code == 200
    operators = {item["slug"]: item for item in response.json()}
    beeline_open = kz_today() <= date(2026, 12, 10)
    assert set(operators) == {"tele2", "activ"} | (
        {"beeline"} if beeline_open else set()
    )
    assert Decimal(operators["tele2"]["min_lot_gb"]) == 3
    assert Decimal(operators["activ"]["max_lot_gb"]) == 20
    if beeline_open:
        assert operators["beeline"]["validity_days"] == 3
        assert operators["beeline"]["available_until"] == "2026-12-10"


def test_buyer_picks_an_amount_up_to_the_sellers_maximum(client: TestClient) -> None:
    listing = publish(client, "activ", max_gb=12)
    assert listing.status_code == 201, listing.text
    listing_id = listing.json()["id"]
    assert listing.json()["max_gb"] == 12

    too_much = client.post(
        f"/api/marketplace/listings/{listing_id}/requests",
        headers=BUYER,
        json={"amount_gb": "15"},
    )
    assert too_much.status_code == 422
    assert too_much.json()["detail"] == "MARKETPLACE_AMOUNT_ABOVE_LISTING_MAXIMUM"

    ok = client.post(
        f"/api/marketplace/listings/{listing_id}/requests",
        headers=BUYER,
        json={"amount_gb": "12"},
    )
    assert ok.status_code == 201, ok.text
    assert ok.json()["total_price_kzt"] == 1800


def test_tele2_needs_at_least_three_gb(client: TestClient) -> None:
    too_small_max = publish(client, "tele2", max_gb=2)
    assert too_small_max.status_code == 422
    assert too_small_max.json()["detail"] == "MARKETPLACE_MAX_BELOW_OPERATOR_MINIMUM"

    listing = publish(client, "tele2", max_gb=10)
    assert listing.status_code == 201, listing.text
    small = client.post(
        f"/api/marketplace/listings/{listing.json()['id']}/requests",
        headers=BUYER,
        json={"amount_gb": "2"},
    )
    assert small.status_code == 422
    assert small.json()["detail"] == "MARKETPLACE_AMOUNT_BELOW_MINIMUM"


def test_beeline_closes_after_its_service_end_date(
    client: TestClient, db: Session
) -> None:
    beeline = db.scalar(
        select(MarketplaceOperator).where(MarketplaceOperator.slug == "beeline")
    )
    assert beeline is not None
    beeline.available_until = kz_today() + timedelta(days=10)
    db.commit()
    listing = publish(client, "beeline", max_gb=5)
    assert listing.status_code == 201, listing.text

    beeline.available_until = kz_today() - timedelta(days=1)
    db.commit()

    operators = client.get("/api/marketplace/operators", headers=BUYER).json()
    assert "beeline" not in {item["slug"] for item in operators}
    catalog = client.get("/api/marketplace/listings", headers=BUYER).json()
    assert catalog["items"] == []
    request = client.post(
        f"/api/marketplace/listings/{listing.json()['id']}/requests",
        headers=BUYER,
        json={"amount_gb": "3"},
    )
    assert request.status_code == 409
    assert request.json()["detail"] == "MARKETPLACE_OPERATOR_UNAVAILABLE"


def test_beeline_end_date_is_the_published_one() -> None:
    from subsmarket.marketplace.operator_catalog import OPERATOR_RULES

    beeline = next(item for item in OPERATOR_RULES if item["slug"] == "beeline")
    assert beeline["available_until"] == date(2026, 12, 10)
