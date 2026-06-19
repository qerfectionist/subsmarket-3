from __future__ import annotations

from collections.abc import Iterator
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from subsmarket.catalog.models import FamilyService
from subsmarket.core.config import settings
from subsmarket.core.database import Base, get_db
from subsmarket.main import app
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
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with session_factory() as session:
        yield session
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture()
def client(db: Session) -> Iterator[TestClient]:
    app.dependency_overrides[get_db] = lambda: db
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()


@pytest.fixture()
def service(db: Session) -> FamilyService:
    item = FamilyService(
        slug="api-family-service",
        name="API Family Service",
        variant="Premium",
        family_type="subscription",
        category="tests",
        subcategory=None,
        max_members=5,
        supported_periods=["monthly"],
        status="active",
        service_metadata={},
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def auth_headers(user_id: int, username: str, first_name: str) -> dict[str, str]:
    return {
        "X-Dev-Telegram-User-Id": str(user_id),
        "X-Dev-Telegram-Username": username,
        "X-Dev-Telegram-First-Name": first_name,
    }


def test_family_creation_is_idempotent(
    client: TestClient,
    service: FamilyService,
) -> None:
    headers = {
        **auth_headers(610000, "idempotent_owner", "Idempotent Owner"),
        "Idempotency-Key": "family-create-test-key",
    }
    payload = {
        "service_id": str(service.id),
        "period": "monthly",
        "max_members": 4,
        "total_price_kzt": 4000,
        "payment_day": 15,
        "next_payment_date": (date.today() + timedelta(days=30)).isoformat(),
        "payment_bank": "kaspi",
        "payment_phone": "+77001234567",
    }

    first = client.post("/api/families", headers=headers, json=payload)
    repeated = client.post("/api/families", headers=headers, json=payload)
    changed = client.post(
        "/api/families",
        headers=headers,
        json={**payload, "total_price_kzt": 4500},
    )

    assert first.status_code == 201
    assert repeated.status_code == 201
    assert repeated.json()["family"]["id"] == first.json()["family"]["id"]
    assert changed.status_code == 409
    assert changed.json()["detail"] == "IDEMPOTENCY_KEY_REUSED"


def test_family_invite_lifecycle_and_hidden_discovery(
    client: TestClient,
    service: FamilyService,
) -> None:
    owner_headers = auth_headers(610010, "invite_owner", "Invite Owner")
    candidate_headers = auth_headers(610011, "invite_candidate", "Candidate")
    create_response = client.post(
        "/api/families",
        headers=owner_headers,
        json={
            "service_id": str(service.id),
            "period": "monthly",
            "max_members": 4,
            "total_price_kzt": 4000,
            "payment_day": 15,
            "next_payment_date": (date.today() + timedelta(days=30)).isoformat(),
            "payment_bank": "kaspi",
            "payment_phone": "+77001234567",
        },
    )
    family_id = create_response.json()["family"]["id"]

    invite_response = client.post(
        f"/api/families/{family_id}/invite",
        headers=owner_headers,
    )
    assert invite_response.status_code == 201
    first_code = invite_response.json()["code"]
    assert len(first_code) == 8
    assert first_code.isdigit()

    hidden = client.patch(
        f"/api/families/{family_id}/visibility",
        headers=owner_headers,
        json={"is_search_visible": False},
    )
    assert hidden.status_code == 200
    assert hidden.json()["is_search_visible"] is False
    assert client.get("/api/families", headers=candidate_headers).json() == []

    resolved = client.get(
        f"/api/families/invites/{first_code}",
        headers=candidate_headers,
    )
    assert resolved.status_code == 200
    assert resolved.json()["family"]["id"] == family_id
    assert resolved.json()["can_request"] is True

    rotated = client.post(
        f"/api/families/{family_id}/invite/rotate",
        headers=owner_headers,
    )
    assert rotated.status_code == 200
    second_code = rotated.json()["code"]
    assert second_code != first_code
    assert (
        client.get(
            f"/api/families/invites/{first_code}",
            headers=candidate_headers,
        ).status_code
        == 410
    )

    disabled = client.post(
        f"/api/families/{family_id}/invite/disable",
        headers=owner_headers,
    )
    assert disabled.status_code == 204
    assert (
        client.get(
            f"/api/families/invites/{second_code}",
            headers=candidate_headers,
        ).status_code
        == 410
    )

    active_again = client.post(
        f"/api/families/{family_id}/invite",
        headers=owner_headers,
    ).json()["code"]
    close_response = client.post(
        f"/api/families/{family_id}/close",
        headers=owner_headers,
    )
    assert close_response.status_code == 200
    assert close_response.json()["is_search_visible"] is False
    closed_invite = client.get(
        f"/api/families/invites/{active_again}",
        headers=candidate_headers,
    )
    assert closed_invite.status_code == 410
    assert closed_invite.json()["detail"] == "FAMILY_INVITE_INACTIVE"


def test_family_api_happy_path_keeps_requisites_private_until_access(
    client: TestClient,
    service: FamilyService,
) -> None:
    owner_headers = auth_headers(610001, "api_owner", "API Owner")
    member_headers = auth_headers(610002, "api_member", "API Member")
    create_response = client.post(
        "/api/families",
        headers=owner_headers,
        json={
            "service_id": str(service.id),
            "period": "monthly",
            "max_members": 4,
            "total_price_kzt": 3990,
            "payment_day": 15,
            "next_payment_date": (date.today() + timedelta(days=30)).isoformat(),
            "description": "API integration family",
            "owner_rules": "Access first, payment after check.",
            "payment_bank": "kaspi",
            "payment_phone": "+77001234567",
        },
    )
    assert create_response.status_code == 201
    family_id = create_response.json()["family"]["id"]

    owner_search = client.get("/api/families", headers=owner_headers)
    member_search = client.get("/api/families", headers=member_headers)
    assert owner_search.status_code == 200
    assert owner_search.json() == []
    assert [item["id"] for item in member_search.json()] == [family_id]

    before_request = client.get(
        f"/api/families/{family_id}/view",
        headers=member_headers,
    )
    assert before_request.status_code == 200
    assert before_request.json()["owner_username"] is None

    request_headers = {
        **member_headers,
        "Idempotency-Key": "family-request-test-key",
    }
    request_response = client.post(
        f"/api/families/{family_id}/requests",
        headers=request_headers,
    )
    assert request_response.status_code == 201
    request_id = request_response.json()["id"]
    assert request_response.json()["owner_username"] == "api_owner"
    repeated_request = client.post(
        f"/api/families/{family_id}/requests",
        headers=request_headers,
    )
    assert repeated_request.status_code == 201
    assert repeated_request.json()["id"] == request_id

    pending_search = client.get("/api/families", headers=member_headers)
    assert pending_search.json() == []
    after_request = client.get(
        f"/api/families/{family_id}/view",
        headers=member_headers,
    )
    assert after_request.json()["owner_username"] == "api_owner"

    owner_requests = client.get(
        f"/api/families/{family_id}/requests",
        headers=owner_headers,
    )
    assert owner_requests.status_code == 200
    assert owner_requests.json()[0]["candidate"]["username"] == "api_member"

    approve_response = client.post(
        f"/api/families/requests/{request_id}/approve",
        headers=owner_headers,
    )
    assert approve_response.status_code == 200
    members_response = client.get(
        f"/api/families/{family_id}/members",
        headers=owner_headers,
    )
    member = next(
        item for item in members_response.json() if item["role"] == "member"
    )
    member_id = member["id"]

    hidden_requisite = client.get(
        f"/api/families/members/{member_id}/payment-requisite",
        headers=member_headers,
    )
    assert hidden_requisite.status_code == 409
    assert hidden_requisite.json()["detail"] == "ACCESS_NOT_CONFIRMED"

    access_response = client.post(
        f"/api/families/members/{member_id}/access-provided",
        headers=owner_headers,
    )
    assert access_response.status_code == 200
    confirmation_response = client.post(
        f"/api/families/members/{member_id}/access-confirmed",
        headers=member_headers,
    )
    assert confirmation_response.status_code == 200
    confirmation = confirmation_response.json()
    assert confirmation["payment_requisite"] == {
        "bank": "kaspi",
        "phone": "+77001234567",
    }
    payment_id = confirmation["payment"]["id"]

    report_response = client.post(
        f"/api/families/payments/{payment_id}/report-paid",
        headers=member_headers,
    )
    assert report_response.status_code == 200
    assert report_response.json()["status"] == "payment_reported"
    confirm_response = client.post(
        f"/api/families/payments/{payment_id}/confirm",
        headers=owner_headers,
    )
    assert confirm_response.status_code == 200
    assert confirm_response.json()["payment"]["status"] == "paid"
    assert confirm_response.json()["member"]["status"] == "active"

    member_families = client.get("/api/families/me", headers=member_headers)
    assert member_families.status_code == 200
    assert member_families.json()[0]["membership"]["status"] == "active"

    prepayment_response = client.post(
        f"/api/families/members/{member_id}/prepayments",
        headers=member_headers,
    )
    assert prepayment_response.status_code == 201
    assert prepayment_response.json()["kind"] == "prepaid"
    assert prepayment_response.json()["status"] == "due"
    prepayment_id = prepayment_response.json()["id"]

    duplicate_prepayment = client.post(
        f"/api/families/members/{member_id}/prepayments",
        headers=member_headers,
    )
    assert duplicate_prepayment.status_code == 409
    assert duplicate_prepayment.json()["detail"] == "MEMBER_PREPAYMENT_LIMIT_REACHED"

    client.post(
        f"/api/families/payments/{prepayment_id}/report-paid",
        headers=member_headers,
    )
    prepaid_confirm = client.post(
        f"/api/families/payments/{prepayment_id}/confirm",
        headers=owner_headers,
    )
    assert prepaid_confirm.status_code == 200
    assert prepaid_confirm.json()["payment"]["status"] == "paid"

    owner_prepayments = client.post(
        f"/api/families/members/{member_id}/prepayments/record-paid",
        headers=owner_headers,
        json={"periods": 2},
    )
    assert owner_prepayments.status_code == 201
    assert len(owner_prepayments.json()) == 2
    assert all(item["status"] == "paid" for item in owner_prepayments.json())

    family_payments = client.get(
        f"/api/families/{family_id}/payments?limit_per_member=2",
        headers=owner_headers,
    )
    assert family_payments.status_code == 200
    member_payments = next(
        item for item in family_payments.json() if item["member_id"] == member_id
    )
    assert len(member_payments["payments"]) == 2


def test_family_by_id_requires_telegram_auth_in_production(
    client: TestClient,
    service: FamilyService,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    owner_headers = auth_headers(610101, "api_owner_secure", "API Owner")
    create_response = client.post(
        "/api/families",
        headers=owner_headers,
        json={
            "service_id": str(service.id),
            "period": "monthly",
            "max_members": 4,
            "total_price_kzt": 3990,
            "payment_day": 15,
            "next_payment_date": (date.today() + timedelta(days=30)).isoformat(),
            "description": "Private by id",
            "owner_rules": "Access first.",
            "payment_bank": "kaspi",
            "payment_phone": "+77001234567",
        },
    )
    assert create_response.status_code == 201
    family_id = create_response.json()["family"]["id"]

    monkeypatch.setattr(settings, "app_env", "production")

    response = client.get(f"/api/families/{family_id}")

    assert response.status_code == 401
    assert response.json()["detail"] == "TELEGRAM_INIT_DATA_REQUIRED"
