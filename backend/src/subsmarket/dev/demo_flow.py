from __future__ import annotations

from datetime import timedelta
from typing import Any

import httpx
from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from subsmarket.core.config import settings
from subsmarket.core.database import SessionLocal, kz_today, utcnow
from subsmarket.families.models import (
    Family,
    FamilyAuditLog,
    FamilyMember,
    FamilyPayment,
    FamilyPaymentRequisite,
    FamilyRequest,
    FamilyRequestRestriction,
)
from subsmarket.identity.models import User
from subsmarket.main import app
from subsmarket.notifications.models import NotificationJob

OWNER_HEADERS = {
    "X-Dev-Telegram-User-Id": "200001",
    "X-Dev-Telegram-Username": "demo_owner",
    "X-Dev-Telegram-First-Name": "Demo Owner",
}
MEMBER_HEADERS = {
    "X-Dev-Telegram-User-Id": "200002",
    "X-Dev-Telegram-Username": "demo_member",
    "X-Dev-Telegram-First-Name": "Demo Member",
}
EXPECTED_NOTIFICATION_EVENTS = {
    "family_request_created_owner",
    "family_request_approved_candidate",
    "family_access_provided_member",
    "family_access_confirmed_owner",
    "family_payment_reported_owner",
    "family_payment_confirmed_member",
    "regular_payment_reminder_3d_member",
    "regular_payment_due_member",
    "regular_payment_overdue_member",
    "regular_payment_overdue_owner",
}
EXPECTED_AUDIT_ACTIONS = {
    "family_created",
    "family_request_created",
    "family_request_approved",
    "family_access_provided",
    "family_access_confirmed",
    "family_payment_reported",
    "family_payment_confirmed",
    "regular_payment_created",
    "regular_payment_due",
    "regular_payment_overdue",
}


def cleanup_demo_data() -> None:
    with SessionLocal() as db:
        demo_users = list(
            db.scalars(
                select(User).where(User.telegram_user_id.in_([200001, 200002]))
            )
        )
        demo_user_ids = [user.id for user in demo_users]
        if not demo_user_ids:
            return

        family_ids = list(
            db.scalars(select(Family.id).where(Family.owner_user_id.in_(demo_user_ids)))
        )
        if family_ids:
            db.execute(delete(FamilyPayment).where(FamilyPayment.family_id.in_(family_ids)))
            db.execute(delete(FamilyMember).where(FamilyMember.family_id.in_(family_ids)))
            db.execute(delete(FamilyRequest).where(FamilyRequest.family_id.in_(family_ids)))
            db.execute(
                delete(FamilyRequestRestriction).where(
                    FamilyRequestRestriction.family_id.in_(family_ids)
                )
            )
            db.execute(
                delete(FamilyPaymentRequisite).where(
                    FamilyPaymentRequisite.family_id.in_(family_ids)
                )
            )
            db.execute(delete(Family).where(Family.id.in_(family_ids)))

        db.execute(
            delete(NotificationJob).where(
                NotificationJob.recipient_user_id.in_(demo_user_ids)
            )
        )
        db.execute(delete(User).where(User.id.in_(demo_user_ids)))
        db.commit()


def read_demo_notification_summary() -> dict[str, Any]:
    with SessionLocal() as db:
        demo_user_ids = list(
            db.scalars(
                select(User.id).where(User.telegram_user_id.in_([200001, 200002]))
            )
        )
        jobs = list(
            db.scalars(
                select(NotificationJob)
                .where(NotificationJob.recipient_user_id.in_(demo_user_ids))
                .order_by(NotificationJob.created_at.asc())
            ).all()
        )

    event_types = [job.event_type for job in jobs]
    missing_events = sorted(EXPECTED_NOTIFICATION_EVENTS - set(event_types))
    if missing_events:
        raise AssertionError(f"Missing notification events: {missing_events}")
    return {
        "count": len(jobs),
        "event_types": sorted(set(event_types)),
    }


def read_demo_audit_summary() -> dict[str, Any]:
    with SessionLocal() as db:
        owner = db.scalar(select(User).where(User.telegram_user_id == 200001))
        if owner is None:
            raise AssertionError("Demo owner was not created")
        family_ids = list(
            db.scalars(select(Family.id).where(Family.owner_user_id == owner.id))
        )
        logs = list(
            db.scalars(
                select(FamilyAuditLog)
                .where(FamilyAuditLog.family_id.in_(family_ids))
                .order_by(FamilyAuditLog.created_at.asc())
            ).all()
        )

    actions = [log.action for log in logs]
    missing_actions = sorted(EXPECTED_AUDIT_ACTIONS - set(actions))
    if missing_actions:
        raise AssertionError(f"Missing audit actions: {missing_actions}")
    return {
        "count": len(logs),
        "actions": sorted(set(actions)),
    }


def set_demo_family_next_payment_date(days_until: int) -> None:
    with SessionLocal() as db:
        owner = db.scalar(select(User).where(User.telegram_user_id == 200001))
        if owner is None:
            raise AssertionError("Demo owner was not created")
        families = list(
            db.scalars(select(Family).where(Family.owner_user_id == owner.id)).all()
        )
        if not families:
            raise AssertionError("Demo families were not created")
        next_payment_date = kz_today() + timedelta(days=days_until)
        for family in families:
            family.next_payment_date = next_payment_date
        db.commit()


def age_due_regular_payments() -> int:
    with SessionLocal() as db:
        owner = db.scalar(select(User).where(User.telegram_user_id == 200001))
        if owner is None:
            raise AssertionError("Demo owner was not created")
        family_ids = list(
            db.scalars(select(Family.id).where(Family.owner_user_id == owner.id))
        )
        payments = list(
            db.scalars(
                select(FamilyPayment)
                .where(FamilyPayment.family_id.in_(family_ids))
                .where(FamilyPayment.kind == "regular")
                .where(FamilyPayment.status == "due")
            ).all()
        )
        if not payments:
            raise AssertionError("No due regular payments to age")
        for payment in payments:
            payment.due_at = utcnow() - timedelta(hours=25)
        db.commit()
        return len(payments)


def api(
    client: httpx.Client | TestClient,
    method: str,
    path: str,
    *,
    headers: dict[str, str] | None = None,
    json: dict[str, Any] | None = None,
) -> Any:
    response = client.request(
        method,
        path,
        headers=headers,
        json=json,
    )
    if response.status_code >= 400:
        raise RuntimeError(
            f"{method} {path} -> {response.status_code}: {response.text}"
        )
    return response.json()


def internal_job_headers() -> dict[str, str] | None:
    if not settings.internal_job_token:
        return None
    return {"X-Internal-Job-Token": settings.internal_job_token}


def run_family_flow(
    client: httpx.Client | TestClient, family_type: str
) -> dict[str, Any]:
    services = api(
        client,
        "GET",
        f"/api/catalog/family-services?family_type={family_type}",
    )
    service = services[0]
    family = api(
        client,
        "POST",
        "/api/families",
        headers=OWNER_HEADERS,
        json={
            "service_id": service["id"],
            "period": "monthly",
            "max_members": min(4, service["max_members"]),
            "total_price_kzt": 3990 if family_type == "subscription" else 7990,
            "payment_day": 15,
            "next_payment_date": (kz_today() + timedelta(days=30)).isoformat(),
            "description": (
                f"Demo {family_type} family: access first, payment after check."
            ),
            "owner_rules": "Demo flow. Pay after access is confirmed.",
            "payment_bank": "kaspi",
            "payment_phone": "+77001234567",
        },
    )["family"]

    searchable = api(client, "GET", f"/api/families?family_type={family_type}")
    assert any(item["id"] == family["id"] for item in searchable)

    request = api(
        client,
        "POST",
        f"/api/families/{family['id']}/requests",
        headers=MEMBER_HEADERS,
    )
    owner_requests = api(
        client,
        "GET",
        f"/api/families/{family['id']}/requests",
        headers=OWNER_HEADERS,
    )
    assert owner_requests and owner_requests[0]["id"] == request["id"]

    approved_request = api(
        client,
        "POST",
        f"/api/families/requests/{request['id']}/approve",
        headers=OWNER_HEADERS,
    )
    assert approved_request["status"] == "approved"

    members = api(
        client,
        "GET",
        f"/api/families/{family['id']}/members",
        headers=OWNER_HEADERS,
    )
    member = next(item for item in members if item["user"]["username"] == "demo_member")
    access_member = api(
        client,
        "POST",
        f"/api/families/members/{member['id']}/access-provided",
        headers=OWNER_HEADERS,
    )
    assert access_member["status"] == "awaiting_confirmation"

    access_confirmation = api(
        client,
        "POST",
        f"/api/families/members/{member['id']}/access-confirmed",
        headers=MEMBER_HEADERS,
    )
    assert access_confirmation["member"]["status"] == "payment_due"
    assert access_confirmation["payment_requisite"]["phone"] == "+77001234567"

    payment = access_confirmation["payment"]
    reported_payment = api(
        client,
        "POST",
        f"/api/families/payments/{payment['id']}/report-paid",
        headers=MEMBER_HEADERS,
    )
    assert reported_payment["status"] == "payment_reported"

    confirmed = api(
        client,
        "POST",
        f"/api/families/payments/{payment['id']}/confirm",
        headers=OWNER_HEADERS,
    )
    assert confirmed["payment"]["status"] == "paid"
    assert confirmed["member"]["status"] == "active"

    member_view = api(
        client,
        "GET",
        f"/api/families/{family['id']}/view",
        headers=MEMBER_HEADERS,
    )
    assert member_view["family"]["id"] == family["id"]
    assert member_view["my_membership"]["status"] == "active"
    assert member_view["my_payments"][0]["status"] == "paid"

    return {
        "family_type": family_type,
        "service": (
            f"{family['service_name']} {family['service_variant'] or ''}".strip()
        ),
        "family_id": family["id"],
        "member_share_kzt": family["member_share_kzt"],
        "request_status": approved_request["status"],
        "member_status": confirmed["member"]["status"],
        "payment_status": confirmed["payment"]["status"],
    }


def run_regular_payment_flow(client: httpx.Client | TestClient) -> dict[str, Any]:
    set_demo_family_next_payment_date(days_until=3)
    reminder_jobs = api(
        client,
        "POST",
        "/api/internal/jobs/run-due",
        headers=internal_job_headers(),
    )
    assert reminder_jobs["created_regular_payments"] == 2
    assert reminder_jobs["regular_payment_reminders_sent"] >= 2

    set_demo_family_next_payment_date(days_until=0)
    due_jobs = api(
        client,
        "POST",
        "/api/internal/jobs/run-due",
        headers=internal_job_headers(),
    )
    assert due_jobs["created_regular_payments"] == 2
    assert due_jobs["activated_regular_payments"] == 2

    aged_payments = age_due_regular_payments()
    overdue_jobs = api(
        client,
        "POST",
        "/api/internal/jobs/run-due",
        headers=internal_job_headers(),
    )
    assert overdue_jobs["overdue_regular_payments"] >= aged_payments

    return {
        "reminder_jobs": reminder_jobs,
        "due_jobs": due_jobs,
        "overdue_jobs": overdue_jobs,
    }


def main() -> None:
    cleanup_demo_data()
    with TestClient(app) as client:
        owner = api(client, "GET", "/api/me", headers=OWNER_HEADERS)
        member = api(client, "GET", "/api/me", headers=MEMBER_HEADERS)
        results = [
            run_family_flow(client, "subscription"),
            run_family_flow(client, "tariff"),
        ]
        regular_payments = run_regular_payment_flow(client)
        first_family_audit = api(
            client,
            "GET",
            f"/api/families/{results[0]['family_id']}/audit-log",
            headers=OWNER_HEADERS,
        )
        assert first_family_audit
        assert first_family_audit[0]["family_id"] == results[0]["family_id"]
        owner_families = api(client, "GET", "/api/families/me", headers=OWNER_HEADERS)
        member_families = api(client, "GET", "/api/families/me", headers=MEMBER_HEADERS)
        notifications = read_demo_notification_summary()
        audit = read_demo_audit_summary()

    print(
        {
            "owner": owner["user"]["username"],
            "member": member["user"]["username"],
            "flows": results,
            "regular_payments": regular_payments,
            "first_family_audit_count": len(first_family_audit),
            "owner_families": len(owner_families),
            "member_families": len(member_families),
            "notifications": notifications,
            "audit": audit,
        }
    )


if __name__ == "__main__":
    main()
