from __future__ import annotations

from collections.abc import Iterator
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from subsmarket.core.config import settings
from subsmarket.core.database import Base, get_auth_db, get_db, utcnow
from subsmarket.identity.models import User
from subsmarket.jobs.service import run_due_jobs
from subsmarket.main import app
from subsmarket.marketplace.jobs import (
    expire_marketplace_listings,
    send_marketplace_listing_expiry_reminders,
)
from subsmarket.marketplace.models import (
    MarketplaceListing,
    MarketplaceListingRequest,
    MarketplaceOperator,
)
from subsmarket.marketplace.queries import list_marketplace_listings_page
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
def tele2(db: Session) -> MarketplaceOperator:
    operator = MarketplaceOperator(
        slug="tele2",
        name="Tele2",
        is_active=True,
        min_lot_gb=Decimal("1.00"),
        max_lot_gb=Decimal("50.00"),
        amount_step_gb=Decimal("1.00"),
        validity_days=7,
        source_url="https://new.tele2.kz/new/transfer-resources",
        verified_at=utcnow(),
    )
    db.add(operator)
    db.commit()
    db.refresh(operator)
    return operator


def auth_headers(user_id: int, username: str) -> dict[str, str]:
    return {
        "X-Dev-Telegram-User-Id": str(user_id),
        "X-Dev-Telegram-Username": username,
        "X-Dev-Telegram-First-Name": username,
        "X-Forwarded-For": f"10.70.{user_id % 250}.{(user_id * 7) % 250}",
    }


def listing_payload(*, price_per_gb: int = 100) -> dict[str, object]:
    return {
        "operator_slug": "tele2",
        "price_per_gb_kzt": price_per_gb,
        "description": "Переведу после согласования в Telegram",
    }


def create_listing(
    client: TestClient,
    headers: dict[str, str],
    *,
    price_per_gb: int = 100,
    key: str | None = None,
) -> dict[str, object]:
    request_headers = dict(headers)
    if key:
        request_headers["Idempotency-Key"] = key
    response = client.post(
        "/api/marketplace/listings",
        headers=request_headers,
        json=listing_payload(price_per_gb=price_per_gb),
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_marketplace_full_request_flow_hides_contact_until_acceptance(
    client: TestClient,
    db: Session,
    tele2: MarketplaceOperator,
) -> None:
    seller = auth_headers(710001, "gb_seller")
    buyer = auth_headers(710002, "gb_buyer")
    listing = create_listing(client, seller, key="listing-create-001")

    catalog = client.get("/api/marketplace/listings", headers=buyer)
    assert catalog.status_code == 200
    assert [item["id"] for item in catalog.json()["items"]] == [listing["id"]]
    assert "stock_gb" not in listing
    assert "minimum_order_gb" not in listing

    created = client.post(
        f"/api/marketplace/listings/{listing['id']}/requests",
        headers={**buyer, "Idempotency-Key": "request-create-001"},
        json={"amount_gb": "10"},
    )
    assert created.status_code == 201
    request_id = created.json()["id"]
    assert created.json()["counterparty_username"] is None
    assert client.get("/api/marketplace/actions/me", headers=seller).json() == {
        "pending_sales_requests": 1,
        "accepted_sales_requests": 0,
        "accepted_purchase_requests": 0,
        "pending_account_sales_requests": 0,
        "accepted_account_sales_requests": 0,
        "accepted_account_purchase_requests": 0,
    }
    assert client.get("/api/marketplace/actions/me", headers=buyer).json() == {
        "pending_sales_requests": 0,
        "accepted_sales_requests": 0,
        "accepted_purchase_requests": 0,
        "pending_account_sales_requests": 0,
        "accepted_account_sales_requests": 0,
        "accepted_account_purchase_requests": 0,
    }

    accepted = client.post(
        f"/api/marketplace/requests/{request_id}/accept",
        headers={**seller, "Idempotency-Key": "request-accept-001"},
    )
    assert accepted.status_code == 200
    assert accepted.json()["counterparty_username"] == "gb_buyer"
    assert "10 ГБ Tele2" in accepted.json()["telegram_draft"]
    assert client.get("/api/marketplace/actions/me", headers=seller).json() == {
        "pending_sales_requests": 0,
        "accepted_sales_requests": 1,
        "accepted_purchase_requests": 0,
        "pending_account_sales_requests": 0,
        "accepted_account_sales_requests": 0,
        "accepted_account_purchase_requests": 0,
    }
    assert client.get("/api/marketplace/actions/me", headers=buyer).json() == {
        "pending_sales_requests": 0,
        "accepted_sales_requests": 0,
        "accepted_purchase_requests": 1,
        "pending_account_sales_requests": 0,
        "accepted_account_sales_requests": 0,
        "accepted_account_purchase_requests": 0,
    }

    assert client.post(
        f"/api/marketplace/requests/{request_id}/close",
        headers=buyer,
        json={"outcome": "sold"},
    ).status_code == 403
    closed = client.post(
        f"/api/marketplace/requests/{request_id}/close",
        headers={**seller, "Idempotency-Key": "request-close-001"},
        json={"outcome": "sold"},
    )
    assert closed.status_code == 200
    assert closed.json()["outcome"] == "sold"
    assert client.get("/api/marketplace/actions/me", headers=seller).json() == {
        "pending_sales_requests": 0,
        "accepted_sales_requests": 0,
        "accepted_purchase_requests": 0,
        "pending_account_sales_requests": 0,
        "accepted_account_sales_requests": 0,
        "accepted_account_purchase_requests": 0,
    }
    assert client.get("/api/marketplace/actions/me", headers=buyer).json() == {
        "pending_sales_requests": 0,
        "accepted_sales_requests": 0,
        "accepted_purchase_requests": 0,
        "pending_account_sales_requests": 0,
        "accepted_account_sales_requests": 0,
        "accepted_account_purchase_requests": 0,
    }
    assert client.get(
        f"/api/marketplace/listings/{listing['id']}", headers=buyer
    ).status_code == 200
    event_types = set(db.scalars(select(NotificationJob.event_type)).all())
    assert {
        "marketplace_request_created",
        "marketplace_request_accepted",
        "marketplace_request_closed",
    }.issubset(event_types)


def test_marketplace_rejects_foreign_listing_and_request_actions(
    client: TestClient,
    db: Session,
    tele2: MarketplaceOperator,
) -> None:
    seller = auth_headers(710011, "permission_seller")
    buyer = auth_headers(710012, "permission_buyer")
    stranger = auth_headers(710013, "permission_stranger")
    listing = create_listing(client, seller)
    listing_id = str(listing["id"])

    forbidden_update = client.patch(
        f"/api/marketplace/listings/{listing_id}",
        headers=stranger,
        json={"price_per_gb_kzt": 90},
    )
    assert forbidden_update.status_code == 403

    created = client.post(
        f"/api/marketplace/listings/{listing_id}/requests",
        headers=buyer,
        json={"amount_gb": "5"},
    )
    assert created.status_code == 201
    request_id = str(created.json()["id"])

    assert client.post(
        f"/api/marketplace/requests/{request_id}/accept",
        headers=stranger,
    ).status_code == 403
    assert client.post(
        f"/api/marketplace/requests/{request_id}/close",
        headers=stranger,
        json={"outcome": "sold"},
    ).status_code == 403

    stranger_requests = client.get(
        "/api/marketplace/requests/me?role=buyer",
        headers=stranger,
    )
    assert stranger_requests.status_code == 200
    assert stranger_requests.json()["items"] == []


def test_request_snapshot_and_idempotency_are_stable(
    client: TestClient,
    tele2: MarketplaceOperator,
) -> None:
    seller = auth_headers(710011, "snapshot_seller")
    buyer = auth_headers(710012, "snapshot_buyer")
    first = create_listing(client, seller, key="stable-listing-001")
    replay = create_listing(client, seller, key="stable-listing-001")
    assert replay["id"] == first["id"]

    request = client.post(
        f"/api/marketplace/listings/{first['id']}/requests",
        headers=buyer,
        json={"amount_gb": "10"},
    )
    assert request.status_code == 201
    update = client.patch(
        f"/api/marketplace/listings/{first['id']}",
        headers={**seller, "Idempotency-Key": "stable-update-001"},
        json={"price_per_gb_kzt": 180},
    )
    assert update.status_code == 200

    incoming = client.get(
        "/api/marketplace/requests/me?role=seller", headers=seller
    ).json()["items"][0]
    assert incoming["amount_gb"] == "10.00"
    assert incoming["total_price_kzt"] == 1000
    assert incoming["price_per_gb_kzt"] == 100


def test_bulletin_board_accepts_multiple_buyers_without_fake_stock(
    client: TestClient,
    tele2: MarketplaceOperator,
) -> None:
    seller = auth_headers(710015, "board_seller")
    listing = create_listing(client, seller)
    requests = []
    for index, amount in enumerate((15, 10), start=1):
        response = client.post(
            f"/api/marketplace/listings/{listing['id']}/requests",
            headers=auth_headers(710015 + index, f"board_buyer_{index}"),
            json={"amount_gb": str(amount)},
        )
        assert response.status_code == 201
        requests.append(response.json()["id"])

    for request_id in requests:
        accepted = client.post(
            f"/api/marketplace/requests/{request_id}/accept",
            headers=seller,
        )
        assert accepted.status_code == 200


def test_seller_has_one_managed_listing_per_operator(
    client: TestClient,
    tele2: MarketplaceOperator,
) -> None:
    seller = auth_headers(710018, "single_listing_seller")
    first = create_listing(client, seller)
    duplicate = client.post(
        "/api/marketplace/listings", headers=seller, json=listing_payload()
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["detail"] == "MARKETPLACE_OPERATOR_LISTING_EXISTS"
    assert client.post(
        f"/api/marketplace/listings/{first['id']}/archive", headers=seller
    ).status_code == 200
    assert client.post(
        "/api/marketplace/listings", headers=seller, json=listing_payload()
    ).status_code == 201


def test_published_listing_operator_cannot_change(
    client: TestClient,
    db: Session,
    tele2: MarketplaceOperator,
) -> None:
    db.add(
        MarketplaceOperator(
            slug="altel-test",
            name="Altel",
            is_active=True,
            min_lot_gb=Decimal("1"),
            max_lot_gb=Decimal("50"),
            amount_step_gb=Decimal("1"),
        )
    )
    db.commit()
    seller = auth_headers(710019, "immutable_operator_seller")
    listing = create_listing(client, seller)
    changed = client.patch(
        f"/api/marketplace/listings/{listing['id']}",
        headers=seller,
        json={"operator_slug": "altel-test"},
    )
    assert changed.status_code == 409
    assert changed.json()["detail"] == "MARKETPLACE_LISTING_OPERATOR_IMMUTABLE"


def test_validation_pagination_and_listing_lifecycle(
    client: TestClient,
    db: Session,
    tele2: MarketplaceOperator,
) -> None:
    seller = auth_headers(710021, "catalog_seller")
    buyer = auth_headers(710022, "catalog_buyer")
    legacy_inventory = client.post(
        "/api/marketplace/listings",
        headers=seller,
        json={**listing_payload(), "stock_gb": 20},
    )
    assert legacy_inventory.status_code == 422

    listings = [
        create_listing(
            client,
            auth_headers(710030 + index, f"catalog_seller_{index}"),
            price_per_gb=price,
        )
        for index, price in enumerate((200, 300, 400))
    ]
    for invalid_amount in ("0", "1.5", "51"):
        response = client.post(
            f"/api/marketplace/listings/{listings[0]['id']}/requests",
            headers=buyer,
            json={"amount_gb": invalid_amount},
        )
        assert response.status_code == 422

    first_page = client.get(
        "/api/marketplace/listings?sort=price_asc&limit=2", headers=buyer
    ).json()
    second_page = client.get(
        "/api/marketplace/listings",
        headers=buyer,
        params={"sort": "price_asc", "limit": 2, "cursor": first_page["next_cursor"]},
    ).json()
    assert {
        *(item["id"] for item in first_page["items"]),
        *(item["id"] for item in second_page["items"]),
    } == {item["id"] for item in listings}

    listing_id = str(listings[0]["id"])
    owner = auth_headers(710030, "catalog_seller_0")
    assert client.post(
        f"/api/marketplace/listings/{listing_id}/pause", headers=owner
    ).status_code == 200
    assert client.get(
        f"/api/marketplace/listings/{listing_id}", headers=buyer
    ).status_code == 404
    stored = db.get(MarketplaceListing, UUID(listing_id))
    assert stored is not None
    stored.status = "expired"
    stored.expires_at = utcnow() - timedelta(minutes=1)
    db.commit()
    renewed = client.post(
        f"/api/marketplace/listings/{listing_id}/renew", headers=owner
    )
    assert renewed.status_code == 200
    assert renewed.json()["status"] == "active"


def test_request_guards_reminder_and_listing_expiry(
    client: TestClient,
    db: Session,
    tele2: MarketplaceOperator,
) -> None:
    seller = auth_headers(710041, "guard_seller")
    buyer = auth_headers(710042, "guard_buyer")
    second_buyer = auth_headers(710043, "guard_buyer_two")
    listing = create_listing(client, seller)
    listing_id = str(listing["id"])
    assert client.post(
        f"/api/marketplace/listings/{listing_id}/requests",
        headers=seller,
        json={"amount_gb": "5"},
    ).status_code == 409

    request = client.post(
        f"/api/marketplace/listings/{listing_id}/requests",
        headers=buyer,
        json={"amount_gb": "5"},
    )
    request_id = str(request.json()["id"])
    assert client.post(
        f"/api/marketplace/listings/{listing_id}/requests",
        headers=buyer,
        json={"amount_gb": "5"},
    ).status_code == 409
    assert client.post(
        f"/api/marketplace/requests/{request_id}/remind", headers=buyer
    ).status_code == 409
    stored_request = db.get(MarketplaceListingRequest, UUID(request_id))
    assert stored_request is not None
    stored_request.created_at = utcnow() - timedelta(hours=3)
    db.commit()
    assert client.post(
        f"/api/marketplace/requests/{request_id}/remind", headers=buyer
    ).status_code == 200

    accepted = client.post(
        f"/api/marketplace/listings/{listing_id}/requests",
        headers=second_buyer,
        json={"amount_gb": "5"},
    )
    assert client.post(
        f"/api/marketplace/requests/{accepted.json()['id']}/accept", headers=seller
    ).status_code == 200
    stored_listing = db.get(MarketplaceListing, UUID(listing_id))
    assert stored_listing is not None
    stored_listing.expires_at = utcnow() - timedelta(minutes=1)
    db.commit()
    expired_count, notification_count = expire_marketplace_listings(db)
    db.flush()
    assert expired_count == 1
    assert notification_count == 2
    db.expire_all()
    assert db.get(MarketplaceListingRequest, UUID(request_id)).status == "expired"
    assert db.get(
        MarketplaceListingRequest, UUID(str(accepted.json()["id"]))
    ).status == "accepted"


def test_paused_listing_keeps_existing_request_actionable_and_buyer_can_cancel(
    client: TestClient,
    tele2: MarketplaceOperator,
) -> None:
    seller = auth_headers(710044, "paused_seller")
    buyer = auth_headers(710045, "paused_buyer")
    second_buyer = auth_headers(710046, "paused_buyer_two")
    listing = create_listing(client, seller)
    listing_id = str(listing["id"])
    request = client.post(
        f"/api/marketplace/listings/{listing_id}/requests",
        headers=buyer,
        json={"amount_gb": "5"},
    )
    assert request.status_code == 201
    request_id = str(request.json()["id"])

    assert client.post(
        f"/api/marketplace/listings/{listing_id}/pause",
        headers=seller,
    ).status_code == 200
    unavailable = client.post(
        f"/api/marketplace/listings/{listing_id}/requests",
        headers=second_buyer,
        json={"amount_gb": "5"},
    )
    assert unavailable.status_code == 409
    assert unavailable.json()["detail"] == "MARKETPLACE_LISTING_UNAVAILABLE"

    accepted = client.post(
        f"/api/marketplace/requests/{request_id}/accept",
        headers=seller,
    )
    assert accepted.status_code == 200
    assert accepted.json()["status"] == "accepted"

    cancelled = client.post(
        f"/api/marketplace/requests/{request_id}/cancel",
        headers=buyer,
        json={"reason": "Передумал"},
    )
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"
    assert cancelled.json()["reason"] == "Передумал"


def test_due_jobs_include_marketplace_expiry(
    client: TestClient,
    db: Session,
    tele2: MarketplaceOperator,
) -> None:
    listing = create_listing(client, auth_headers(710051, "jobs_seller"))
    stored = db.get(MarketplaceListing, UUID(str(listing["id"])))
    assert stored is not None
    stored.expires_at = utcnow() - timedelta(minutes=1)
    db.commit()
    result = run_due_jobs(db)
    assert result.expired_marketplace_listings == 1
    assert result.notification_jobs_created >= 1
    assert not result.job_errors


def test_expiry_reminders_advance_batches_and_reset_after_renewal(
    client: TestClient,
    db: Session,
    tele2: MarketplaceOperator,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "job_batch_size", 2)
    sellers: list[tuple[dict[str, str], MarketplaceListing]] = []
    for index in range(3):
        headers = auth_headers(710070 + index, f"reminder_seller_{index}")
        created = create_listing(client, headers)
        listing = db.get(MarketplaceListing, UUID(str(created["id"])))
        assert listing is not None
        listing.expires_at = utcnow() + timedelta(hours=12)
        sellers.append((headers, listing))
    db.commit()

    assert send_marketplace_listing_expiry_reminders(db) == 2
    db.commit()
    assert send_marketplace_listing_expiry_reminders(db) == 1
    db.commit()
    assert send_marketplace_listing_expiry_reminders(db) == 0

    first_headers, first_listing = sellers[0]
    renewed = client.post(
        f"/api/marketplace/listings/{first_listing.id}/renew",
        headers=first_headers,
    )
    assert renewed.status_code == 200
    db.expire_all()
    refreshed = db.get(MarketplaceListing, first_listing.id)
    assert refreshed is not None
    assert refreshed.expiry_reminder_sent_at is None

    refreshed.expires_at = utcnow() + timedelta(hours=12)
    db.commit()
    assert send_marketplace_listing_expiry_reminders(db) == 1


def test_marketplace_catalog_is_bounded_and_has_no_n_plus_one_queries(
    client: TestClient,
    db: Session,
    tele2: MarketplaceOperator,
) -> None:
    buyer_headers = auth_headers(710062, "load_buyer")
    assert client.get("/api/me", headers=buyer_headers).status_code == 200
    buyer = db.scalar(select(User).where(User.telegram_user_id == 710062))
    assert buyer is not None
    load_sellers = [
        User(
            telegram_user_id=720000 + index,
            username=f"load_seller_{index}",
            first_name=f"seller_{index}",
        )
        for index in range(1000)
    ]
    db.add_all(load_sellers)
    db.flush()
    expires_at = utcnow() + timedelta(days=7)
    db.add_all(
        [
            MarketplaceListing(
                seller_user_id=seller.id,
                listing_type="mobile_data",
                operator_id=tele2.id,
                price_per_gb_kzt=500 + index,
                status="active",
                expires_at=expires_at,
                published_at=utcnow(),
            )
            for index, seller in enumerate(load_sellers)
        ]
    )
    db.commit()
    db.refresh(buyer)

    select_count = 0

    def count_selects(*args) -> None:
        nonlocal select_count
        if str(args[2]).lstrip().upper().startswith("SELECT"):
            select_count += 1

    engine = db.get_bind()
    event.listen(engine, "before_cursor_execute", count_selects)
    try:
        items, next_cursor = list_marketplace_listings_page(
            db,
            buyer,
            operator_slug="tele2",
            sort="recent",
            limit=20,
            cursor=None,
        )
    finally:
        event.remove(engine, "before_cursor_execute", count_selects)
    assert len(items) == 20
    assert next_cursor is not None
    assert select_count == 1


def test_listing_lives_seven_days_edits_do_not_bump_and_renewal_republishes(
    client: TestClient,
    db: Session,
    tele2: MarketplaceOperator,
) -> None:
    seller = auth_headers(710071, "publication_seller")
    before_create = utcnow()
    listing = create_listing(client, seller)
    expires_at = datetime.fromisoformat(str(listing["expires_at"]))
    assert before_create + timedelta(days=6, hours=23) < expires_at
    assert expires_at < before_create + timedelta(days=7, minutes=1)
    published_at = datetime.fromisoformat(str(listing["published_at"]))

    edited = client.patch(
        f"/api/marketplace/listings/{listing['id']}",
        headers=seller,
        json={"description": "Новое описание", "price_per_gb_kzt": 130},
    )
    assert edited.status_code == 200
    assert datetime.fromisoformat(edited.json()["published_at"]).replace(
        tzinfo=None
    ) == published_at.replace(tzinfo=None)
    assert edited.json()["can_renew"] is False

    too_early = client.post(
        f"/api/marketplace/listings/{listing['id']}/renew", headers=seller
    )
    assert too_early.status_code == 409
    assert too_early.json()["detail"] == "MARKETPLACE_LISTING_RENEW_TOO_EARLY"

    stored = db.get(MarketplaceListing, UUID(str(listing["id"])))
    assert stored is not None
    stored.expires_at = utcnow() + timedelta(hours=12)
    db.commit()
    renewable = client.get(
        f"/api/marketplace/listings/{listing['id']}", headers=seller
    )
    assert renewable.status_code == 200
    assert renewable.json()["can_renew"] is True

    renewed = client.post(
        f"/api/marketplace/listings/{listing['id']}/renew", headers=seller
    )
    assert renewed.status_code == 200
    assert datetime.fromisoformat(renewed.json()["published_at"]).replace(
        tzinfo=None
    ) > published_at.replace(tzinfo=None)
    renewed_expiry = datetime.fromisoformat(renewed.json()["expires_at"])
    assert utcnow() + timedelta(days=6, hours=23) < renewed_expiry
    assert renewed_expiry < utcnow() + timedelta(days=7, minutes=1)


def test_price_insight_uses_other_sellers_active_listings(
    client: TestClient,
    db: Session,
    tele2: MarketplaceOperator,
) -> None:
    requester = auth_headers(710081, "price_requester")
    for index, price in enumerate((100, 120, 140, 160, 180), start=1):
        create_listing(
            client,
            auth_headers(710081 + index, f"price_seller_{index}"),
            price_per_gb=price,
        )
    insight = client.get(
        "/api/marketplace/price-insight?operator=tele2", headers=requester
    )
    assert insight.json() == {
        "operator_slug": "tele2",
        "sample_size": 5,
        "median_price_per_gb_kzt": 140,
        "typical_min_price_per_gb_kzt": 120,
        "typical_max_price_per_gb_kzt": 160,
    }
    first = db.scalar(
        select(MarketplaceListing).order_by(MarketplaceListing.created_at.asc())
    )
    assert first is not None
    first.status = "paused"
    db.commit()
    reduced = client.get(
        "/api/marketplace/price-insight?operator=tele2", headers=requester
    ).json()
    assert reduced["sample_size"] == 4
    assert reduced["median_price_per_gb_kzt"] is None
