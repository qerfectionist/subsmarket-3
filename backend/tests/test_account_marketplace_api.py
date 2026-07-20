from __future__ import annotations

from collections.abc import Iterator
from datetime import timedelta
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from subsmarket.core.database import Base, get_auth_db, get_db, utcnow
from subsmarket.main import app
from subsmarket.marketplace.account_models import (
    MarketplaceAccountListing,
    MarketplaceAccountRequest,
    MarketplaceAccountService,
)
from subsmarket.marketplace.jobs import (
    expire_marketplace_listings,
    send_marketplace_listing_expiry_reminders,
)
from subsmarket.models import import_models
from subsmarket.notifications.models import NotificationJob


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


@pytest.fixture()
def chatgpt(db: Session) -> MarketplaceAccountService:
    service = MarketplaceAccountService(
        slug="chatgpt", name="ChatGPT", is_active=True
    )
    db.add(service)
    db.commit()
    db.refresh(service)
    return service


def auth_headers(user_id: int, username: str) -> dict[str, str]:
    return {
        "X-Dev-Telegram-User-Id": str(user_id),
        "X-Dev-Telegram-Username": username,
        "X-Dev-Telegram-First-Name": username,
        "X-Forwarded-For": f"10.80.{user_id % 250}.{(user_id * 7) % 250}",
    }


def create_listing(client: TestClient, seller: dict[str, str]) -> dict:
    response = client.post(
        "/api/marketplace/accounts/listings",
        headers={**seller, "Idempotency-Key": "account-listing-create"},
        json={
            "service_slug": "chatgpt",
            "title": "ChatGPT Plus на месяц",
            "price_kzt": 3990,
            "description": "Детали обсудим в Telegram",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_account_request_flow_keeps_listing_active_for_multiple_buyers(
    client: TestClient, db: Session, chatgpt: MarketplaceAccountService
) -> None:
    seller = auth_headers(810001, "account_seller")
    buyer_one = auth_headers(810002, "account_buyer_one")
    buyer_two = auth_headers(810003, "account_buyer_two")
    listing = create_listing(client, seller)
    assert 29 <= (
        _parse_iso(listing["expires_at"]) - _parse_iso(listing["created_at"])
    ).days <= 30

    first = client.post(
        f"/api/marketplace/accounts/listings/{listing['id']}/requests",
        headers={**buyer_one, "Idempotency-Key": "account-request-one"},
    )
    second = client.post(
        f"/api/marketplace/accounts/listings/{listing['id']}/requests",
        headers={**buyer_two, "Idempotency-Key": "account-request-two"},
    )
    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["counterparty_username"] is None

    accepted = client.post(
        f"/api/marketplace/accounts/requests/{first.json()['id']}/accept",
        headers={**seller, "Idempotency-Key": "account-accept-one"},
    )
    assert accepted.status_code == 200
    assert accepted.json()["counterparty_username"] == "account_buyer_one"
    assert "ChatGPT Plus на месяц" in accepted.json()["telegram_draft"]
    assert client.get(
        f"/api/marketplace/accounts/listings/{listing['id']}", headers=buyer_two
    ).status_code == 200

    summary = client.get("/api/marketplace/actions/me", headers=seller).json()
    assert summary["pending_account_sales_requests"] == 1
    assert summary["accepted_account_sales_requests"] == 1

    cancelled = client.post(
        f"/api/marketplace/accounts/requests/{first.json()['id']}/cancel",
        headers={**buyer_one, "Idempotency-Key": "account-cancel-one"},
        json={"reason": "Передумал"},
    )
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"
    assert db.get(MarketplaceAccountListing, UUID(listing["id"])).status == "active"


def test_paused_account_listing_blocks_new_requests_but_allows_decision(
    client: TestClient, chatgpt: MarketplaceAccountService
) -> None:
    seller = auth_headers(820001, "paused_seller")
    buyer_one = auth_headers(820002, "paused_buyer_one")
    buyer_two = auth_headers(820003, "paused_buyer_two")
    listing = create_listing(client, seller)
    request = client.post(
        f"/api/marketplace/accounts/listings/{listing['id']}/requests",
        headers=buyer_one,
    ).json()
    assert client.post(
        f"/api/marketplace/accounts/listings/{listing['id']}/pause",
        headers=seller,
    ).status_code == 200
    blocked = client.post(
        f"/api/marketplace/accounts/listings/{listing['id']}/requests",
        headers=buyer_two,
    )
    assert blocked.status_code == 409
    accepted = client.post(
        f"/api/marketplace/accounts/requests/{request['id']}/accept",
        headers=seller,
    )
    assert accepted.status_code == 200


def test_account_listing_expiry_closes_only_pending_requests(
    client: TestClient, db: Session, chatgpt: MarketplaceAccountService
) -> None:
    seller = auth_headers(830001, "expiry_seller")
    buyer = auth_headers(830002, "expiry_buyer")
    listing_json = create_listing(client, seller)
    request_json = client.post(
        f"/api/marketplace/accounts/listings/{listing_json['id']}/requests",
        headers=buyer,
    ).json()
    listing = db.get(MarketplaceAccountListing, UUID(listing_json["id"]))
    listing.expires_at = utcnow() + timedelta(hours=12)
    db.commit()
    assert send_marketplace_listing_expiry_reminders(db) == 1
    db.commit()
    listing.expires_at = utcnow() - timedelta(seconds=1)
    db.commit()
    expired_count, notifications = expire_marketplace_listings(db)
    db.commit()
    assert expired_count == 1
    assert notifications == 2
    assert listing.status == "expired"
    assert db.get(
        MarketplaceAccountRequest, UUID(request_json["id"])
    ).status == "expired"
    event_types = set(db.scalars(select(NotificationJob.event_type)).all())
    assert {
        "account_listing_expiry_reminder",
        "account_listing_expired",
        "account_request_expired",
    }.issubset(event_types)


def _parse_iso(value: str):
    from datetime import datetime

    return datetime.fromisoformat(value)
