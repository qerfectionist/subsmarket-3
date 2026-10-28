from __future__ import annotations

import importlib.util
from collections.abc import Iterator
from datetime import timedelta
from pathlib import Path
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from subsmarket.core.database import Base, get_auth_db, get_db, utcnow
from subsmarket.main import app
from subsmarket.marketplace.account_catalog import (
    ACCOUNT_CATALOG,
    PERIOD_MONTHS,
    period_title,
)
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
    service = MarketplaceAccountService(slug="chatgpt", name="ChatGPT", is_active=True)
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
            "plan_code": "plus",
            "period_months": 1,
            "delivery": "own_account",
            "price_kzt": 3990,
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
    assert (
        29
        <= (_parse_iso(listing["expires_at"]) - _parse_iso(listing["created_at"])).days
        <= 30
    )

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
    assert (
        "«ChatGPT Plus · 1 месяц, на аккаунт покупателя»"
        in (accepted.json()["telegram_draft"])
    )
    assert (
        client.get(
            f"/api/marketplace/accounts/listings/{listing['id']}", headers=buyer_two
        ).status_code
        == 200
    )

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
    assert (
        client.post(
            f"/api/marketplace/accounts/listings/{listing['id']}/pause",
            headers=seller,
        ).status_code
        == 200
    )
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
    assert (
        db.get(MarketplaceAccountRequest, UUID(request_json["id"])).status == "expired"
    )
    event_types = set(db.scalars(select(NotificationJob.event_type)).all())
    assert {
        "account_listing_expiry_reminder",
        "account_listing_expired",
        "account_request_expired",
    }.issubset(event_types)


def _parse_iso(value: str):
    from datetime import datetime

    return datetime.fromisoformat(value)


LISTINGS = "/api/marketplace/accounts/listings"


def _service(db: Session, slug: str, name: str) -> MarketplaceAccountService:
    service = MarketplaceAccountService(slug=slug, name=name, is_active=True)
    db.add(service)
    db.commit()
    return service


def _create(client: TestClient, seller: dict[str, str], key: str, **payload) -> object:
    return client.post(
        LISTINGS,
        headers={**seller, "Idempotency-Key": key},
        json={"service_slug": "chatgpt", "delivery": "own_account", "price_kzt": 3990}
        | payload,
    )


def test_catalog_periods_and_titles_are_consistent() -> None:
    slugs = [entry.slug for entry in ACCOUNT_CATALOG]
    assert len(slugs) == len(set(slugs))
    for entry in ACCOUNT_CATALOG:
        assert entry.plans and entry.deliveries
        codes = [plan.code for plan in entry.plans]
        assert len(codes) == len(set(codes))
        for plan in entry.plans:
            assert plan.periods and set(plan.periods) <= set(PERIOD_MONTHS)
    assert [period_title(m) for m in (1, 3, 6, 12)] == [
        "1 месяц",
        "3 месяца",
        "6 месяцев",
        "1 год",
    ]


def test_migrations_seed_every_catalog_service() -> None:
    versions = Path(__file__).resolve().parents[1] / "alembic" / "versions"
    path = versions / "20261028_0038_account_plans.py"
    spec = importlib.util.spec_from_file_location("account_plans_migration", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    seeded = {"chatgpt", "gemini", "grok", "canva"} | {
        slug for slug, _ in module.NEW_SERVICES
    }
    assert seeded == {entry.slug for entry in ACCOUNT_CATALOG}


def test_services_list_official_plans_only(
    client: TestClient, db: Session, chatgpt: MarketplaceAccountService
) -> None:
    _service(db, "telegram-premium", "Telegram Premium")
    _service(db, "old-free-text", "Old")
    response = client.get(
        "/api/marketplace/accounts/services", headers=auth_headers(51001, "plans_buyer")
    )
    assert response.status_code == 200, response.text
    services = {item["slug"]: item for item in response.json()}
    assert list(services) == ["chatgpt", "telegram-premium"]
    plans = {plan["code"]: plan for plan in services["chatgpt"]["plans"]}
    assert plans["plus"] == {
        "code": "plus",
        "name": "Plus",
        "full_name": "ChatGPT Plus",
        "periods": [1],
    }
    assert services["chatgpt"]["deliveries"] == ["own_account", "ready_account"]
    assert "чат" in services["chatgpt"]["keywords"]
    assert services["telegram-premium"]["deliveries"] == ["own_account"]


def test_listing_title_is_built_from_plan(
    client: TestClient, chatgpt: MarketplaceAccountService
) -> None:
    listing = create_listing(client, auth_headers(51002, "plans_seller"))
    assert listing["title"] == "ChatGPT Plus · 1 месяц, на аккаунт покупателя"
    assert listing["plan_code"] == "plus"
    assert listing["plan_name"] == "ChatGPT Plus"
    assert listing["period_months"] == 1
    assert listing["delivery"] == "own_account"
    assert listing["description"] is None


def test_listing_rejects_free_text_and_unofficial_plans(
    client: TestClient, db: Session, chatgpt: MarketplaceAccountService
) -> None:
    seller = auth_headers(51003, "plans_rules")
    free_text = _create(
        client,
        seller,
        "plans-key-1",
        plan_code="plus",
        period_months=1,
        title="ChatGPT навсегда",
    )
    assert free_text.status_code == 422
    unknown = _create(client, seller, "plans-key-2", plan_code="team", period_months=1)
    assert unknown.json()["detail"] == "ACCOUNT_PLAN_UNAVAILABLE"
    half_year = _create(
        client, seller, "plans-key-3", plan_code="plus", period_months=6
    )
    assert half_year.json()["detail"] == "ACCOUNT_PERIOD_UNAVAILABLE"

    _service(db, "telegram-premium", "Telegram Premium")
    ready = _create(
        client,
        seller,
        "plans-key-4",
        service_slug="telegram-premium",
        plan_code="gift",
        period_months=3,
        delivery="ready_account",
    )
    assert ready.json()["detail"] == "ACCOUNT_DELIVERY_UNAVAILABLE"
    gift = _create(
        client,
        seller,
        "plans-key-5",
        service_slug="telegram-premium",
        plan_code="gift",
        period_months=3,
    )
    assert gift.status_code == 201, gift.text
    assert gift.json()["title"] == "Telegram Premium в подарок · 3 месяца"


def test_update_changes_plan_and_title(
    client: TestClient, chatgpt: MarketplaceAccountService
) -> None:
    seller = auth_headers(51004, "plans_editor")
    listing = create_listing(client, seller)
    response = client.patch(
        f"{LISTINGS}/{listing['id']}",
        headers={**seller, "Idempotency-Key": "plans-update"},
        json={"plan_code": "pro-200", "delivery": "ready_account", "price_kzt": 99000},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["title"] == "ChatGPT Pro 200 · 1 месяц, готовый аккаунт"
    assert body["price_kzt"] == 99000


def test_legacy_listing_needs_full_plan_to_change_it(
    client: TestClient, db: Session, chatgpt: MarketplaceAccountService
) -> None:
    seller = auth_headers(51005, "plans_legacy")
    create_listing(client, seller)  # creates the seller user
    seller_listing = db.query(MarketplaceAccountListing).one()
    legacy = MarketplaceAccountListing(
        seller_user_id=seller_listing.seller_user_id,
        service_id=chatgpt.id,
        title="ChatGPT на месяц",
        description="Старый текст",
        price_kzt=2000,
        status="active",
        expires_at=seller_listing.expires_at,
        published_at=utcnow(),
    )
    db.add(legacy)
    db.commit()

    partial = client.patch(
        f"{LISTINGS}/{legacy.id}",
        headers={**seller, "Idempotency-Key": "legacy-partial"},
        json={"delivery": "own_account"},
    )
    assert partial.json()["detail"] == "ACCOUNT_PLAN_REQUIRED"

    price_only = client.patch(
        f"{LISTINGS}/{legacy.id}",
        headers={**seller, "Idempotency-Key": "legacy-price"},
        json={"price_kzt": 2500},
    )
    assert price_only.status_code == 200
    assert price_only.json()["title"] == "ChatGPT на месяц"

    full = client.patch(
        f"{LISTINGS}/{legacy.id}",
        headers={**seller, "Idempotency-Key": "legacy-full"},
        json={"plan_code": "go", "period_months": 1, "delivery": "own_account"},
    )
    assert full.status_code == 200, full.text
    assert full.json()["title"] == "ChatGPT Go · 1 месяц, на аккаунт покупателя"
    assert full.json()["description"] is None
