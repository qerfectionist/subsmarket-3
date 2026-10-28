from __future__ import annotations

from collections.abc import Iterator
from datetime import date, timedelta
from typing import Any

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from subsmarket.catalog.models import FamilyService
from subsmarket.core.database import Base
from subsmarket.families.models import FamilyMember, FamilyRequest
from subsmarket.families.schemas import FamilyCreate
from subsmarket.families.service import (
    approve_join_request,
    confirm_access_received,
    create_family,
    create_join_request,
    get_family_view,
    list_family_members,
    list_owner_family_requests,
    mark_access_provided,
    report_access_issue,
    to_member_out,
    to_owner_family_request_out,
)
from subsmarket.identity.models import User
from subsmarket.models import import_models
from subsmarket.notifications.models import NotificationJob

GOOGLE_METADATA: dict[str, Any] = {
    "join_contact": "gmail",
    "rules": ["Сменить семью Google можно раз в 12 месяцев"],
    "join_confirm": "Я не менял(а) семью Google за последние 12 месяцев",
}


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


def make_service(db: Session, slug: str, metadata: dict[str, Any]) -> FamilyService:
    service = FamilyService(
        slug=slug,
        name=slug,
        variant=None,
        family_type="subscription",
        category="video_streaming",
        subcategory=None,
        max_members=6,
        supported_periods=["monthly"],
        status="active",
        service_metadata=metadata,
    )
    db.add(service)
    db.commit()
    db.refresh(service)
    return service


def make_user(db: Session, index: int) -> User:
    user = User(
        telegram_user_id=930000 + index,
        username=f"join_user_{index}",
        first_name=f"User {index}",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def make_family(db: Session, owner: User, service: FamilyService):
    return create_family(
        db,
        owner,
        FamilyCreate(
            service_id=service.id,
            max_members=4,
            total_price_kzt=6000,
            payment_day=15,
            next_payment_date=date.today() + timedelta(days=20),
            payment_bank="kaspi",
            payment_phone="+77001234567",
        ),
    )


def test_view_tells_what_the_request_needs(db: Session) -> None:
    service = make_service(db, "youtube-premium", GOOGLE_METADATA)
    owner = make_user(db, 1)
    candidate = make_user(db, 2)
    family = make_family(db, owner, service)

    view = get_family_view(db, candidate, family.id)

    assert view.join.contact_kind == "gmail"
    assert view.join.rules == ["Сменить семью Google можно раз в 12 месяцев"]
    assert view.join.confirm == GOOGLE_METADATA["join_confirm"]


@pytest.mark.parametrize(
    ("contact", "confirmed", "detail"),
    [
        (None, True, "JOIN_CONTACT_REQUIRED"),
        ("aigerim.gmail.com", True, "JOIN_CONTACT_EMAIL_INVALID"),
        ("aigerim@gmail.com", False, "JOIN_RULES_NOT_CONFIRMED"),
    ],
)
def test_request_needs_contact_and_confirmation(
    db: Session, contact: str | None, confirmed: bool, detail: str
) -> None:
    service = make_service(db, "youtube-premium", GOOGLE_METADATA)
    owner = make_user(db, 3)
    candidate = make_user(db, 4)
    family = make_family(db, owner, service)

    with pytest.raises(HTTPException) as exc:
        create_join_request(
            db, candidate, family.id, join_contact=contact, rules_confirmed=confirmed
        )

    assert exc.value.status_code == 400
    assert exc.value.detail == detail


def test_owner_gets_the_contact_on_request_and_member(db: Session) -> None:
    service = make_service(db, "youtube-premium", GOOGLE_METADATA)
    owner = make_user(db, 5)
    candidate = make_user(db, 6)
    family = make_family(db, owner, service)

    request = create_join_request(
        db,
        candidate,
        family.id,
        join_contact="  Aigerim.B@Gmail.com ",
        rules_confirmed=True,
    )

    stored = db.get(FamilyRequest, request.id)
    assert stored is not None
    assert stored.encrypted_join_contact
    assert "gmail" not in stored.encrypted_join_contact
    [owner_request] = list_owner_family_requests(db, owner, family.id)
    owner_view = to_owner_family_request_out(owner_request)
    assert owner_view.join_contact_kind == "gmail"
    assert owner_view.join_contact == "aigerim.b@gmail.com"

    approve_join_request(db, owner, request.id)
    members = list_family_members(db, owner, family.id)
    member = next(item for item in members if item.user_id == candidate.id)
    assert to_member_out(member).join_contact == "aigerim.b@gmail.com"


def test_phone_contact_is_normalized(db: Session) -> None:
    service = make_service(db, "beeline", {"join_contact": "phone"})
    owner = make_user(db, 7)
    candidate = make_user(db, 8)
    family = make_family(db, owner, service)

    request = create_join_request(
        db, candidate, family.id, join_contact="8 700 123 45 67"
    )

    [owner_request] = list_owner_family_requests(db, owner, family.id)
    assert owner_request.id == request.id
    assert to_owner_family_request_out(owner_request).join_contact == "+77001234567"


def test_services_without_contact_need_nothing(db: Session) -> None:
    service = make_service(db, "netflix", {"join_contact": "none"})
    owner = make_user(db, 9)
    candidate = make_user(db, 10)
    family = make_family(db, owner, service)

    request = create_join_request(db, candidate, family.id, join_contact="ignored")

    assert request.join_contact_kind is None
    assert request.encrypted_join_contact is None


def test_not_working_returns_member_to_waiting_and_notifies_owner(
    db: Session,
) -> None:
    service = make_service(db, "netflix", {})
    owner = make_user(db, 11)
    candidate = make_user(db, 12)
    family = make_family(db, owner, service)
    request = create_join_request(db, candidate, family.id)
    approve_join_request(db, owner, request.id)
    member = db.scalar(select(FamilyMember).where(FamilyMember.user_id == candidate.id))
    assert member is not None

    with pytest.raises(HTTPException) as early:
        report_access_issue(db, candidate, member.id)
    assert early.value.detail == "MEMBER_NOT_AWAITING_CONFIRMATION"

    mark_access_provided(db, owner, member.id)
    with pytest.raises(HTTPException) as stranger:
        report_access_issue(db, owner, member.id)
    assert stranger.value.status_code == 403

    reported = report_access_issue(db, candidate, member.id)

    assert reported.status == "awaiting_access"
    assert reported.access_provided_at is None
    assert reported.access_issue_reported_at is not None
    job = db.scalar(
        select(NotificationJob).where(
            NotificationJob.event_type == "family_access_issue_owner"
        )
    )
    assert job is not None
    assert job.recipient_user_id == owner.id
    assert "не работает" in job.payload["message"]

    mark_access_provided(db, owner, member.id)
    confirm_access_received(db, candidate, member.id)
    db.refresh(member)
    assert member.access_issue_reported_at is None
