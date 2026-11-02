from __future__ import annotations

from collections.abc import Iterator
from datetime import date, timedelta

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from subsmarket.catalog.models import FamilyService
from subsmarket.core.database import Base
from subsmarket.families.models import FamilyMember, FamilyPaymentRequisite
from subsmarket.families.schemas import FamilyCreate
from subsmarket.families.service import (
    approve_join_request,
    confirm_access_received,
    create_family,
    create_join_request,
    get_open_payment_requisite,
    mark_access_provided,
    to_family_out,
)
from subsmarket.identity.models import User
from subsmarket.models import import_models


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


def make_service(db: Session, *, slug: str, family_type: str) -> FamilyService:
    service = FamilyService(
        slug=slug,
        name=slug,
        variant=None,
        family_type=family_type,
        category="mobile_tariffs" if family_type == "tariff" else "video_streaming",
        subcategory=None,
        max_members=6,
        supported_periods=["monthly"],
        status="active",
        service_metadata={},
    )
    db.add(service)
    db.commit()
    db.refresh(service)
    return service


def make_user(db: Session, index: int) -> User:
    user = User(
        telegram_user_id=910000 + index,
        username=f"create_user_{index}",
        first_name=f"User {index}",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def payload(service: FamilyService, **overrides: object) -> FamilyCreate:
    data: dict[str, object] = {
        "service_id": service.id,
        "period": "monthly",
        "max_members": 4,
        "total_price_kzt": 6000,
        "payment_day": 15,
        "next_payment_date": date.today() + timedelta(days=20),
        "payment_bank": "kaspi",
        "payment_phone": "+77001234567",
    }
    data.update(overrides)
    return FamilyCreate(**data)


def test_recipient_name_is_stored_encrypted_and_shown_after_access(
    db: Session,
) -> None:
    service = make_service(db, slug="netflix-premium", family_type="subscription")
    owner = make_user(db, 1)
    candidate = make_user(db, 2)
    family = create_family(
        db, owner, payload(service, payment_recipient_name="  Айгерим   Б. ")
    )

    requisite = db.scalar(
        select(FamilyPaymentRequisite).where(
            FamilyPaymentRequisite.family_id == family.id
        )
    )
    assert requisite is not None
    assert requisite.encrypted_recipient_name
    assert "Айгерим" not in requisite.encrypted_recipient_name

    request = create_join_request(db, candidate, family.id)
    approve_join_request(db, owner, request.id)
    member = db.scalar(
        select(FamilyMember).where(
            FamilyMember.family_id == family.id,
            FamilyMember.user_id == candidate.id,
        )
    )
    assert member is not None
    mark_access_provided(db, owner, member.id)
    result = confirm_access_received(db, candidate, member.id)

    assert result.payment_requisite.recipient_name == "Айгерим Б."
    assert get_open_payment_requisite(db, candidate, member.id).recipient_name == (
        "Айгерим Б."
    )


def test_recipient_name_is_optional_for_old_clients(db: Session) -> None:
    service = make_service(db, slug="youtube-premium", family_type="subscription")
    owner = make_user(db, 3)
    family = create_family(db, owner, payload(service))

    requisite = db.scalar(
        select(FamilyPaymentRequisite).where(
            FamilyPaymentRequisite.family_id == family.id
        )
    )
    assert requisite is not None
    assert requisite.encrypted_recipient_name is None


def test_family_can_be_created_hidden_from_the_market(db: Session) -> None:
    service = make_service(db, slug="youtube-premium", family_type="subscription")
    owner = make_user(db, 4)
    shown = create_family(db, owner, payload(service))
    hidden = create_family(db, owner, payload(service, is_search_visible=False))

    assert shown.is_search_visible is True
    assert hidden.is_search_visible is False


@pytest.mark.parametrize("name", ["А", "Айгерим 4400", "4400 4300 1234 5678"])
def test_recipient_name_rejects_short_names_and_digits(name: str) -> None:
    with pytest.raises(ValidationError):
        FamilyCreate(
            service_id="00000000-0000-0000-0000-000000000000",
            max_members=4,
            total_price_kzt=6000,
            payment_day=15,
            next_payment_date=date.today() + timedelta(days=20),
            payment_bank="kaspi",
            payment_phone="+77001234567",
            payment_recipient_name=name,
        )


def test_recipient_name_auto_capitalizes_words() -> None:
    created = FamilyCreate(
        service_id="00000000-0000-0000-0000-000000000000",
        max_members=4,
        total_price_kzt=6000,
        payment_day=15,
        next_payment_date=date.today() + timedelta(days=20),
        payment_bank="kaspi",
        payment_phone="+77001234567",
        payment_recipient_name="кайрат н.",
    )
    assert created.payment_recipient_name == "Кайрат Н."


def test_tariff_family_keeps_full_speed_gb(db: Session) -> None:
    service = make_service(db, slug="beeline-family-tariff", family_type="tariff")
    owner = make_user(db, 4)
    family = create_family(
        db,
        owner,
        payload(service, plan_name="Премиум Семья х4", full_speed_gb=240),
    )

    assert to_family_out(family).full_speed_gb == 240


def test_full_speed_gb_is_only_for_tariffs(db: Session) -> None:
    service = make_service(db, slug="spotify-family", family_type="subscription")
    owner = make_user(db, 5)

    with pytest.raises(HTTPException) as exc:
        create_family(db, owner, payload(service, full_speed_gb=100))

    assert exc.value.status_code == 400
    assert exc.value.detail == "FULL_SPEED_ONLY_FOR_TARIFF"
