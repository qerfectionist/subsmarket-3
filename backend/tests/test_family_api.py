from __future__ import annotations

from collections.abc import Iterator
from datetime import date, timedelta
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from subsmarket.catalog.models import FamilyService
from subsmarket.core.config import settings
from subsmarket.core.database import Base, get_db
from subsmarket.families.models import Family
from subsmarket.jobs.service import close_due_families
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
        "X-Forwarded-For": (
            f"10.{(user_id // 65536) % 256}."
            f"{(user_id // 256) % 256}.{user_id % 256}"
        ),
    }


def family_payload(
    service: FamilyService,
    *,
    max_members: int = 4,
    total_price_kzt: int = 4000,
) -> dict[str, object]:
    return {
        "service_id": str(service.id),
        "period": "monthly",
        "max_members": max_members,
        "total_price_kzt": total_price_kzt,
        "payment_day": 15,
        "next_payment_date": (date.today() + timedelta(days=30)).isoformat(),
        "payment_bank": "kaspi",
        "payment_phone": "+77001234567",
    }


def create_family_via_api(
    client: TestClient,
    service: FamilyService,
    owner_headers: dict[str, str],
    *,
    max_members: int = 4,
    total_price_kzt: int = 4000,
) -> str:
    response = client.post(
        "/api/families",
        headers=owner_headers,
        json=family_payload(
            service,
            max_members=max_members,
            total_price_kzt=total_price_kzt,
        ),
    )
    assert response.status_code == 201
    return str(response.json()["family"]["id"])


def approve_member_via_api(
    client: TestClient,
    *,
    family_id: str,
    owner_headers: dict[str, str],
    member_headers: dict[str, str],
) -> str:
    request_response = client.post(
        f"/api/families/{family_id}/requests",
        headers=member_headers,
    )
    assert request_response.status_code == 201
    approve_response = client.post(
        f"/api/families/requests/{request_response.json()['id']}/approve",
        headers=owner_headers,
    )
    assert approve_response.status_code == 200
    members_response = client.get(
        f"/api/families/{family_id}/members",
        headers=owner_headers,
    )
    assert members_response.status_code == 200
    return str(
        next(item for item in members_response.json() if item["role"] == "member")[
            "id"
        ]
    )


def activate_member_via_api(
    client: TestClient,
    *,
    member_id: str,
    owner_headers: dict[str, str],
    member_headers: dict[str, str],
) -> str:
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
    payment_id = str(confirmation_response.json()["payment"]["id"])
    report_response = client.post(
        f"/api/families/payments/{payment_id}/report-paid",
        headers=member_headers,
    )
    assert report_response.status_code == 200
    confirm_response = client.post(
        f"/api/families/payments/{payment_id}/confirm",
        headers=owner_headers,
    )
    assert confirm_response.status_code == 200
    assert confirm_response.json()["member"]["status"] == "active"
    return payment_id


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


def test_family_search_page_uses_cursor_without_duplicates(
    client: TestClient,
    service: FamilyService,
) -> None:
    candidate_headers = auth_headers(610006, "cursor_candidate", "Candidate")
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
    for index in range(3):
        response = client.post(
            "/api/families",
            headers=auth_headers(
                610020 + index,
                f"cursor_owner_{index}",
                f"Owner {index}",
            ),
            json=payload,
        )
        assert response.status_code == 201

    first_page = client.get(
        "/api/families/page?limit=2",
        headers=candidate_headers,
    )
    assert first_page.status_code == 200
    first_body = first_page.json()
    first_ids = {item["id"] for item in first_body["items"]}
    assert len(first_ids) == 2
    assert first_body["next_cursor"]

    second_page = client.get(
        f"/api/families/page?limit=2&cursor={first_body['next_cursor']}",
        headers=candidate_headers,
    )
    assert second_page.status_code == 200
    second_body = second_page.json()
    second_ids = {item["id"] for item in second_body["items"]}
    assert len(second_ids) == 1
    assert first_ids.isdisjoint(second_ids)
    assert second_body["next_cursor"] is None

    invalid_cursor = client.get(
        "/api/families/page?cursor=bad-cursor",
        headers=candidate_headers,
    )
    assert invalid_cursor.status_code == 400
    assert invalid_cursor.json()["detail"] == "INVALID_PAGE_CURSOR"


def test_family_search_keeps_subscriptions_and_tariffs_separate(
    client: TestClient,
    db: Session,
    service: FamilyService,
) -> None:
    tariff_service = FamilyService(
        slug="api-tariff-service",
        name="API Tariff Service",
        variant="Family Tariff",
        family_type="tariff",
        category="mobile_tariffs",
        subcategory=None,
        max_members=5,
        supported_periods=["monthly"],
        status="active",
        service_metadata={},
    )
    db.add(tariff_service)
    db.commit()
    db.refresh(tariff_service)

    subscription_response = client.post(
        "/api/families",
        headers=auth_headers(610030, "subscription_owner", "Subscription Owner"),
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
    tariff_response = client.post(
        "/api/families",
        headers=auth_headers(610031, "tariff_owner", "Tariff Owner"),
        json={
            "service_id": str(tariff_service.id),
            "period": "monthly",
            "max_members": 4,
            "total_price_kzt": 6000,
            "payment_day": 15,
            "next_payment_date": (date.today() + timedelta(days=30)).isoformat(),
            "payment_bank": "kaspi",
            "payment_phone": "+77001234567",
        },
    )
    candidate_headers = auth_headers(610032, "type_candidate", "Type Candidate")

    subscriptions = client.get(
        "/api/families?family_type=subscription",
        headers=candidate_headers,
    )
    tariffs = client.get(
        "/api/families?family_type=tariff",
        headers=candidate_headers,
    )

    assert subscription_response.status_code == 201
    assert tariff_response.status_code == 201
    assert [item["id"] for item in subscriptions.json()] == [
        subscription_response.json()["family"]["id"]
    ]
    assert [item["id"] for item in tariffs.json()] == [
        tariff_response.json()["family"]["id"]
    ]
    assert subscriptions.json()[0]["family_type"] == "subscription"
    assert tariffs.json()[0]["family_type"] == "tariff"


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


def test_non_owner_cannot_manage_family_or_requests(
    client: TestClient,
    service: FamilyService,
) -> None:
    owner_headers = auth_headers(610040, "permission_owner", "Permission Owner")
    candidate_headers = auth_headers(
        610041,
        "permission_candidate",
        "Permission Candidate",
    )
    outsider_headers = auth_headers(610042, "permission_outsider", "Outsider")
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
    request_response = client.post(
        f"/api/families/{family_id}/requests",
        headers=candidate_headers,
    )
    request_id = request_response.json()["id"]

    checks = [
        client.get(f"/api/families/{family_id}/requests", headers=outsider_headers),
        client.get(f"/api/families/{family_id}/members", headers=outsider_headers),
        client.get(f"/api/families/{family_id}/payments", headers=outsider_headers),
        client.get(f"/api/families/{family_id}/invite", headers=outsider_headers),
        client.post(
            f"/api/families/requests/{request_id}/approve",
            headers=outsider_headers,
        ),
        client.post(
            f"/api/families/requests/{request_id}/reject",
            headers=outsider_headers,
        ),
        client.post(f"/api/families/{family_id}/close", headers=outsider_headers),
    ]

    assert create_response.status_code == 201
    assert request_response.status_code == 201
    assert [response.status_code for response in checks] == [403] * len(checks)
    assert checks[0].json()["detail"] == "ONLY_OWNER_CAN_VIEW_REQUESTS"
    assert checks[1].json()["detail"] == "ONLY_OWNER_CAN_VIEW_MEMBERS"
    assert checks[2].json()["detail"] == "ONLY_OWNER_CAN_VIEW_PAYMENTS"
    assert checks[3].json()["detail"] == "ONLY_OWNER_CAN_VIEW_INVITE"
    assert checks[4].json()["detail"] == "ONLY_OWNER_CAN_APPROVE_REQUEST"
    assert checks[5].json()["detail"] == "ONLY_OWNER_CAN_REJECT_REQUEST"
    assert checks[6].json()["detail"] == "ONLY_OWNER_CAN_CHANGE_FAMILY"


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

    access_headers = {
        **owner_headers,
        "Idempotency-Key": "access-provided-test-key",
    }
    access_response = client.post(
        f"/api/families/members/{member_id}/access-provided",
        headers=access_headers,
    )
    repeated_access = client.post(
        f"/api/families/members/{member_id}/access-provided",
        headers=access_headers,
    )
    assert access_response.status_code == 200
    assert repeated_access.status_code == 200
    assert repeated_access.json()["id"] == access_response.json()["id"]
    confirm_access_headers = {
        **member_headers,
        "Idempotency-Key": "access-confirmed-test-key",
    }
    confirmation_response = client.post(
        f"/api/families/members/{member_id}/access-confirmed",
        headers=confirm_access_headers,
    )
    repeated_confirmation = client.post(
        f"/api/families/members/{member_id}/access-confirmed",
        headers=confirm_access_headers,
    )
    assert confirmation_response.status_code == 200
    assert repeated_confirmation.status_code == 200
    confirmation = confirmation_response.json()
    assert confirmation["payment_requisite"] == {
        "bank": "kaspi",
        "phone": "+77001234567",
    }
    payment_id = confirmation["payment"]["id"]
    assert repeated_confirmation.json()["payment"]["id"] == payment_id

    report_headers = {
        **member_headers,
        "Idempotency-Key": "payment-reported-test-key",
    }
    report_response = client.post(
        f"/api/families/payments/{payment_id}/report-paid",
        headers=report_headers,
    )
    repeated_report = client.post(
        f"/api/families/payments/{payment_id}/report-paid",
        headers=report_headers,
    )
    assert report_response.status_code == 200
    assert report_response.json()["status"] == "payment_reported"
    assert repeated_report.status_code == 200
    assert repeated_report.json()["id"] == payment_id
    payment_confirm_headers = {
        **owner_headers,
        "Idempotency-Key": "payment-confirmed-test-key",
    }
    confirm_response = client.post(
        f"/api/families/payments/{payment_id}/confirm",
        headers=payment_confirm_headers,
    )
    repeated_payment_confirmation = client.post(
        f"/api/families/payments/{payment_id}/confirm",
        headers=payment_confirm_headers,
    )
    assert confirm_response.status_code == 200
    assert repeated_payment_confirmation.status_code == 200
    assert confirm_response.json()["payment"]["status"] == "paid"
    assert confirm_response.json()["member"]["status"] == "active"
    assert repeated_payment_confirmation.json()["payment"]["id"] == payment_id

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


def test_non_member_cannot_view_member_payment_data(
    client: TestClient,
    service: FamilyService,
) -> None:
    owner_headers = auth_headers(610050, "private_owner", "Private Owner")
    member_headers = auth_headers(610051, "private_member", "Private Member")
    outsider_headers = auth_headers(610052, "private_outsider", "Outsider")
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
            "payment_bank": "kaspi",
            "payment_phone": "+77001234567",
        },
    )
    family_id = create_response.json()["family"]["id"]
    request_response = client.post(
        f"/api/families/{family_id}/requests",
        headers=member_headers,
    )
    approve_response = client.post(
        f"/api/families/requests/{request_response.json()['id']}/approve",
        headers=owner_headers,
    )
    members_response = client.get(
        f"/api/families/{family_id}/members",
        headers=owner_headers,
    )
    member_id = next(
        item for item in members_response.json() if item["role"] == "member"
    )["id"]

    requisite_response = client.get(
        f"/api/families/members/{member_id}/payment-requisite",
        headers=outsider_headers,
    )
    payments_response = client.get(
        f"/api/families/members/{member_id}/payments",
        headers=outsider_headers,
    )
    leave_response = client.post(
        f"/api/families/members/{member_id}/leave",
        headers=outsider_headers,
    )

    assert create_response.status_code == 201
    assert request_response.status_code == 201
    assert approve_response.status_code == 200
    assert requisite_response.status_code == 403
    assert requisite_response.json()["detail"] == "PAYMENT_REQUISITE_FORBIDDEN"
    assert payments_response.status_code == 403
    assert payments_response.json()["detail"] == "FAMILY_PAYMENTS_FORBIDDEN"
    assert leave_response.status_code == 403
    assert leave_response.json()["detail"] == "ONLY_MEMBER_CAN_LEAVE"


def test_payment_actions_are_limited_to_correct_side(
    client: TestClient,
    service: FamilyService,
) -> None:
    owner_headers = auth_headers(610060, "payment_owner", "Payment Owner")
    member_headers = auth_headers(610061, "payment_member", "Payment Member")
    outsider_headers = auth_headers(610062, "payment_outsider", "Outsider")
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
            "payment_bank": "kaspi",
            "payment_phone": "+77001234567",
        },
    )
    family_id = create_response.json()["family"]["id"]
    request_response = client.post(
        f"/api/families/{family_id}/requests",
        headers=member_headers,
    )
    client.post(
        f"/api/families/requests/{request_response.json()['id']}/approve",
        headers=owner_headers,
    )
    members_response = client.get(
        f"/api/families/{family_id}/members",
        headers=owner_headers,
    )
    member_id = next(
        item for item in members_response.json() if item["role"] == "member"
    )["id"]
    client.post(
        f"/api/families/members/{member_id}/access-provided",
        headers=owner_headers,
    )
    access_confirmation = client.post(
        f"/api/families/members/{member_id}/access-confirmed",
        headers=member_headers,
    )
    payment_id = access_confirmation.json()["payment"]["id"]

    owner_report = client.post(
        f"/api/families/payments/{payment_id}/report-paid",
        headers=owner_headers,
    )
    outsider_report = client.post(
        f"/api/families/payments/{payment_id}/report-paid",
        headers=outsider_headers,
    )
    member_confirm = client.post(
        f"/api/families/payments/{payment_id}/confirm",
        headers=member_headers,
    )
    outsider_confirm = client.post(
        f"/api/families/payments/{payment_id}/confirm",
        headers=outsider_headers,
    )
    outsider_not_received = client.post(
        f"/api/families/payments/{payment_id}/not-received",
        headers=outsider_headers,
    )
    member_not_received = client.post(
        f"/api/families/payments/{payment_id}/not-received",
        headers=member_headers,
    )
    report_response = client.post(
        f"/api/families/payments/{payment_id}/report-paid",
        headers=member_headers,
    )
    outsider_cancel_report = client.post(
        f"/api/families/payments/{payment_id}/cancel-report",
        headers=outsider_headers,
    )
    owner_cancel_report = client.post(
        f"/api/families/payments/{payment_id}/cancel-report",
        headers=owner_headers,
    )
    owner_not_received = client.post(
        f"/api/families/payments/{payment_id}/not-received",
        headers=owner_headers,
    )
    report_again = client.post(
        f"/api/families/payments/{payment_id}/report-paid",
        headers=member_headers,
    )
    owner_confirm = client.post(
        f"/api/families/payments/{payment_id}/confirm",
        headers=owner_headers,
    )
    member_confirm_after_paid = client.post(
        f"/api/families/payments/{payment_id}/confirm",
        headers=member_headers,
    )
    member_cancel_after_paid = client.post(
        f"/api/families/payments/{payment_id}/cancel-report",
        headers=member_headers,
    )

    assert create_response.status_code == 201
    assert access_confirmation.status_code == 200
    assert owner_report.status_code == 403
    assert owner_report.json()["detail"] == "ONLY_MEMBER_CAN_REPORT_PAYMENT"
    assert outsider_report.status_code == 403
    assert outsider_report.json()["detail"] == "ONLY_MEMBER_CAN_REPORT_PAYMENT"
    assert member_confirm.status_code == 403
    assert member_confirm.json()["detail"] == "ONLY_OWNER_CAN_CONFIRM_PAYMENT"
    assert outsider_confirm.status_code == 403
    assert outsider_confirm.json()["detail"] == "ONLY_OWNER_CAN_CONFIRM_PAYMENT"
    assert outsider_not_received.status_code == 403
    assert outsider_not_received.json()["detail"] == "ONLY_OWNER_CAN_MARK_NOT_RECEIVED"
    assert member_not_received.status_code == 403
    assert member_not_received.json()["detail"] == "ONLY_OWNER_CAN_MARK_NOT_RECEIVED"
    assert report_response.status_code == 200
    assert report_response.json()["status"] == "payment_reported"
    assert outsider_cancel_report.status_code == 403
    assert outsider_cancel_report.json()["detail"] == "ONLY_MEMBER_CAN_CANCEL_REPORT"
    assert owner_cancel_report.status_code == 403
    assert owner_cancel_report.json()["detail"] == "ONLY_MEMBER_CAN_CANCEL_REPORT"
    assert owner_not_received.status_code == 200
    assert owner_not_received.json()["status"] == "due"
    assert report_again.status_code == 200
    assert report_again.json()["status"] == "payment_reported"
    assert owner_confirm.status_code == 200
    assert owner_confirm.json()["payment"]["status"] == "paid"
    assert member_confirm_after_paid.status_code == 403
    assert member_confirm_after_paid.json()["detail"] == (
        "ONLY_OWNER_CAN_CONFIRM_PAYMENT"
    )
    assert member_cancel_after_paid.status_code == 409
    assert member_cancel_after_paid.json()["detail"] == "PAYMENT_REPORT_NOT_ACTIVE"


def test_member_leave_and_removal_flow_permissions(
    client: TestClient,
    service: FamilyService,
) -> None:
    owner_headers = auth_headers(610070, "removal_owner", "Removal Owner")
    member_headers = auth_headers(610071, "removal_member", "Removal Member")
    outsider_headers = auth_headers(610072, "removal_outsider", "Outsider")
    family_id = create_family_via_api(client, service, owner_headers)
    member_id = approve_member_via_api(
        client,
        family_id=family_id,
        owner_headers=owner_headers,
        member_headers=member_headers,
    )
    activate_member_via_api(
        client,
        member_id=member_id,
        owner_headers=owner_headers,
        member_headers=member_headers,
    )
    owner_members = client.get(
        f"/api/families/{family_id}/members",
        headers=owner_headers,
    ).json()
    owner_member_id = next(item for item in owner_members if item["role"] == "owner")[
        "id"
    ]

    owner_leave = client.post(
        f"/api/families/members/{owner_member_id}/leave",
        headers=owner_headers,
    )
    outsider_remove = client.post(
        f"/api/families/members/{member_id}/remove",
        headers=outsider_headers,
    )
    member_remove = client.post(
        f"/api/families/members/{member_id}/remove",
        headers=member_headers,
    )
    owner_remove = client.post(
        f"/api/families/members/{member_id}/remove",
        headers=owner_headers,
    )
    repeated_remove = client.post(
        f"/api/families/members/{member_id}/remove",
        headers=owner_headers,
    )
    outsider_ack = client.post(
        f"/api/families/members/{member_id}/acknowledge-removal",
        headers=outsider_headers,
    )
    member_ack = client.post(
        f"/api/families/members/{member_id}/acknowledge-removal",
        headers=member_headers,
    )
    outsider_cancel_request = client.post(
        f"/api/families/members/{member_id}/request-removal-cancellation",
        headers=outsider_headers,
    )
    member_cancel_request = client.post(
        f"/api/families/members/{member_id}/request-removal-cancellation",
        headers=member_headers,
    )
    outsider_revoke = client.post(
        f"/api/families/members/{member_id}/revoke-removal",
        headers=outsider_headers,
    )
    member_revoke = client.post(
        f"/api/families/members/{member_id}/revoke-removal",
        headers=member_headers,
    )
    owner_revoke = client.post(
        f"/api/families/members/{member_id}/revoke-removal",
        headers=owner_headers,
    )
    member_leave = client.post(
        f"/api/families/members/{member_id}/leave",
        headers=member_headers,
    )
    member_leave_again = client.post(
        f"/api/families/members/{member_id}/leave",
        headers=member_headers,
    )
    family_after_leave = client.get(
        f"/api/families/{family_id}",
        headers=owner_headers,
    )

    assert owner_leave.status_code == 400
    assert owner_leave.json()["detail"] == "OWNER_MUST_CLOSE_FAMILY"
    assert outsider_remove.status_code == 403
    assert outsider_remove.json()["detail"] == "ONLY_OWNER_CAN_REMOVE_MEMBER"
    assert member_remove.status_code == 403
    assert member_remove.json()["detail"] == "ONLY_OWNER_CAN_REMOVE_MEMBER"
    assert owner_remove.status_code == 200
    assert owner_remove.json()["status"] == "removal_pending"
    assert repeated_remove.status_code == 409
    assert repeated_remove.json()["detail"] == "MEMBER_NOT_REMOVABLE"
    assert outsider_ack.status_code == 403
    assert outsider_ack.json()["detail"] == "ONLY_MEMBER_CAN_ACK_REMOVAL"
    assert member_ack.status_code == 200
    assert member_ack.json()["removal_acknowledged_at"] is not None
    assert outsider_cancel_request.status_code == 403
    assert outsider_cancel_request.json()["detail"] == (
        "ONLY_MEMBER_CAN_REQUEST_REMOVAL_CANCELLATION"
    )
    assert member_cancel_request.status_code == 200
    assert member_cancel_request.json()["removal_cancel_requested_at"] is not None
    assert outsider_revoke.status_code == 403
    assert outsider_revoke.json()["detail"] == "ONLY_OWNER_CAN_REVOKE_REMOVAL"
    assert member_revoke.status_code == 403
    assert member_revoke.json()["detail"] == "ONLY_OWNER_CAN_REVOKE_REMOVAL"
    assert owner_revoke.status_code == 200
    assert owner_revoke.json()["status"] == "active"
    assert owner_revoke.json()["removal_scheduled_at"] is None
    assert member_leave.status_code == 200
    assert member_leave.json()["status"] == "left"
    assert member_leave_again.status_code == 409
    assert member_leave_again.json()["detail"] == "MEMBER_NOT_ACTIVE"
    assert family_after_leave.status_code == 200
    assert family_after_leave.json()["active_members_count"] == 1


def test_full_closing_and_closed_family_api_rules(
    client: TestClient,
    db: Session,
    service: FamilyService,
) -> None:
    full_owner_headers = auth_headers(610080, "full_owner", "Full Owner")
    full_member_headers = auth_headers(610081, "full_member", "Full Member")
    full_candidate_headers = auth_headers(
        610082,
        "full_candidate",
        "Full Candidate",
    )
    full_family_id = create_family_via_api(
        client,
        service,
        full_owner_headers,
        max_members=2,
    )
    approve_member_via_api(
        client,
        family_id=full_family_id,
        owner_headers=full_owner_headers,
        member_headers=full_member_headers,
    )

    full_request = client.post(
        f"/api/families/{full_family_id}/requests",
        headers=full_candidate_headers,
    )
    full_invite = client.post(
        f"/api/families/{full_family_id}/invite",
        headers=full_owner_headers,
    )

    assert full_request.status_code == 409
    assert full_request.json()["detail"] == "FAMILY_NOT_JOINABLE"
    assert full_invite.status_code == 201
    full_invite_lookup = client.get(
        f"/api/families/invites/{full_invite.json()['code']}",
        headers=full_candidate_headers,
    )
    assert full_invite_lookup.status_code == 409
    assert full_invite_lookup.json()["detail"] == "FAMILY_INVITE_NOT_ACCEPTING"

    closing_owner_headers = auth_headers(610083, "closing_owner", "Closing Owner")
    closing_member_headers = auth_headers(
        610084,
        "closing_member",
        "Closing Member",
    )
    pending_candidate_headers = auth_headers(
        610085,
        "closing_candidate",
        "Closing Candidate",
    )
    new_candidate_headers = auth_headers(
        610086,
        "new_closing_candidate",
        "New Closing Candidate",
    )
    closing_family_id = create_family_via_api(client, service, closing_owner_headers)
    closing_member_id = approve_member_via_api(
        client,
        family_id=closing_family_id,
        owner_headers=closing_owner_headers,
        member_headers=closing_member_headers,
    )
    request_response = client.post(
        f"/api/families/{closing_family_id}/requests",
        headers=pending_candidate_headers,
    )
    invite_code = client.post(
        f"/api/families/{closing_family_id}/invite",
        headers=closing_owner_headers,
    ).json()["code"]
    close_response = client.post(
        f"/api/families/{closing_family_id}/close",
        headers=closing_owner_headers,
    )
    repeated_close = client.post(
        f"/api/families/{closing_family_id}/close",
        headers=closing_owner_headers,
    )
    pending_candidate_requests = client.get(
        "/api/families/requests/me",
        headers=pending_candidate_headers,
    )
    closing_request = client.post(
        f"/api/families/{closing_family_id}/requests",
        headers=new_candidate_headers,
    )
    closing_invite_lookup = client.get(
        f"/api/families/invites/{invite_code}",
        headers=new_candidate_headers,
    )
    closing_ack = client.post(
        f"/api/families/{closing_family_id}/acknowledge-closing",
        headers=closing_member_headers,
    )
    access_after_closing = client.post(
        f"/api/families/members/{closing_member_id}/access-provided",
        headers=closing_owner_headers,
    )

    assert request_response.status_code == 201
    assert close_response.status_code == 200
    assert close_response.json()["status"] == "closing"
    assert close_response.json()["is_search_visible"] is False
    assert repeated_close.status_code == 200
    assert repeated_close.json()["id"] == closing_family_id
    assert pending_candidate_requests.status_code == 200
    assert pending_candidate_requests.json()[0]["status"] == "cancelled"
    assert pending_candidate_requests.json()[0]["cancel_reason"] == "family_closing"
    assert closing_request.status_code == 409
    assert closing_request.json()["detail"] == "FAMILY_NOT_JOINABLE"
    assert closing_invite_lookup.status_code == 410
    assert closing_invite_lookup.json()["detail"] == "FAMILY_INVITE_INACTIVE"
    assert closing_ack.status_code == 200
    assert closing_ack.json()["closing_acknowledged_at"] is not None
    assert access_after_closing.status_code == 409
    assert access_after_closing.json()["detail"] == "FAMILY_NOT_MUTABLE"

    family = db.get(Family, UUID(closing_family_id))
    assert family is not None
    family.closes_at = family.closing_started_at - timedelta(seconds=1)
    db.commit()
    closed_count, _ = close_due_families(db)
    close_closed_again = client.post(
        f"/api/families/{closing_family_id}/close",
        headers=closing_owner_headers,
    )
    closed_request = client.post(
        f"/api/families/{closing_family_id}/requests",
        headers=auth_headers(610087, "closed_candidate", "Closed Candidate"),
    )

    assert closed_count == 1
    assert close_closed_again.status_code == 409
    assert close_closed_again.json()["detail"] == "FAMILY_ALREADY_CLOSED"
    assert closed_request.status_code == 409
    assert closed_request.json()["detail"] == "FAMILY_NOT_JOINABLE"


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
