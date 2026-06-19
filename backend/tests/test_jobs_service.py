from __future__ import annotations

from collections.abc import Iterator
from datetime import date, timedelta

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from subsmarket.catalog.models import FamilyService
from subsmarket.core.database import Base, utcnow
from subsmarket.families.calendar import add_months
from subsmarket.families.models import (
    Family,
    FamilyMember,
    FamilyPayment,
    FamilyRequest,
)
from subsmarket.families.schemas import FamilyCreate
from subsmarket.families.service import (
    acknowledge_family_closing,
    close_family,
    create_family,
    create_join_request,
)
from subsmarket.identity.models import User
from subsmarket.jobs.service import (
    activate_regular_payments,
    close_due_families,
    create_regular_payments,
    expire_family_requests,
    mark_overdue_first_payments,
    mark_overdue_regular_payments,
    run_due_jobs,
    send_closing_acknowledgement_reminders,
    send_regular_payment_reminders,
)
from subsmarket.models import import_models
from subsmarket.notifications.models import NotificationJob


@pytest.fixture()
def db() -> Iterator[Session]:
    import_models()
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with session_factory() as session:
        yield session
    Base.metadata.drop_all(engine)
    engine.dispose()


def make_user(db: Session, index: int) -> User:
    user = User(
        telegram_user_id=800000 + index,
        username=f"jobs_user_{index}",
        first_name=f"Jobs User {index}",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def make_service(db: Session) -> FamilyService:
    service = FamilyService(
        slug="jobs-service",
        name="Jobs Service",
        variant="Family",
        family_type="subscription",
        category="tests",
        subcategory=None,
        max_members=6,
        supported_periods=["monthly", "yearly"],
        status="active",
        service_metadata={},
    )
    db.add(service)
    db.commit()
    db.refresh(service)
    return service


def make_family(
    db: Session,
    owner: User,
    service: FamilyService,
    *,
    period: str = "monthly",
    next_payment_date: date | None = None,
) -> Family:
    return create_family(
        db,
        owner,
        FamilyCreate(
            service_id=service.id,
            period=period,
            max_members=4,
            total_price_kzt=4000,
            payment_day=15,
            next_payment_date=next_payment_date or date.today() + timedelta(days=30),
            description="Jobs test family",
            payment_bank="kaspi",
            payment_phone="+77001234567",
        ),
    )


def add_member(
    db: Session,
    family: Family,
    user: User,
    *,
    status: str,
) -> FamilyMember:
    member = FamilyMember(
        family_id=family.id,
        user_id=user.id,
        role="member",
        status=status,
        access_provided_at=utcnow(),
        access_confirmed_at=utcnow(),
    )
    family.active_members_count += 1
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


def test_expired_request_notifies_both_sides_and_can_be_retried(db: Session) -> None:
    service = make_service(db)
    owner = make_user(db, 1)
    candidate = make_user(db, 2)
    family = make_family(db, owner, service)
    request = create_join_request(db, candidate, family.id)
    request.expires_at = utcnow() - timedelta(minutes=1)
    db.commit()

    expired_count, notification_count = expire_family_requests(db)
    db.flush()
    repeated_count, repeated_notifications = expire_family_requests(db)

    assert expired_count == 1
    assert notification_count == 2
    assert request.status == "expired"
    assert repeated_count == 0
    assert repeated_notifications == 0
    assert (
        db.scalar(
            select(NotificationJob).where(
                NotificationJob.event_type == "family_request_expired_candidate"
            )
        )
        is not None
    )

    retried_request = create_join_request(db, candidate, family.id)
    assert retried_request.status == "pending"


def test_run_due_jobs_commits_successful_steps_when_later_step_fails(
    db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    service = make_service(db)
    owner = make_user(db, 21)
    candidate = make_user(db, 22)
    family = make_family(db, owner, service)
    request = create_join_request(db, candidate, family.id)
    request.expires_at = utcnow() - timedelta(minutes=1)
    db.commit()

    def fail_access_reminders(_: Session) -> int:
        raise RuntimeError("forced failure")

    monkeypatch.setattr(
        "subsmarket.jobs.service.send_access_confirmation_reminders",
        fail_access_reminders,
    )

    result = run_due_jobs(db)

    assert result.expired_family_requests == 1
    assert result.notification_jobs_created == 2
    assert len(result.job_errors) == 1
    assert result.job_errors[0].step == "send_access_confirmation_reminders"
    assert result.job_errors[0].error_type == "RuntimeError"
    db.expire_all()
    persisted_request = db.get(FamilyRequest, request.id)
    assert persisted_request is not None
    assert persisted_request.status == "expired"


def test_first_payment_overdue_does_not_remove_member(db: Session) -> None:
    service = make_service(db)
    owner = make_user(db, 3)
    candidate = make_user(db, 4)
    family = make_family(db, owner, service)
    member = add_member(db, family, candidate, status="payment_due")
    payment = FamilyPayment(
        family_id=family.id,
        member_id=member.id,
        kind="first",
        status="due",
        amount_kzt=family.member_share_kzt,
        period=family.period,
        period_start=date.today(),
        period_end=family.next_payment_date,
        due_at=utcnow() - timedelta(minutes=1),
        requisites_opened_at=utcnow() - timedelta(minutes=31),
    )
    db.add(payment)
    db.commit()

    overdue_count, notification_count = mark_overdue_first_payments(db)
    db.flush()

    assert overdue_count == 1
    assert notification_count == 2
    assert payment.status == "overdue"
    assert member.status == "payment_due"
    assert family.active_members_count == 2


def test_regular_payment_moves_through_schedule_due_and_overdue(db: Session) -> None:
    service = make_service(db)
    owner = make_user(db, 5)
    candidate = make_user(db, 6)
    family = make_family(
        db,
        owner,
        service,
        next_payment_date=date.today() + timedelta(days=3),
    )
    member = add_member(db, family, candidate, status="active")

    assert create_regular_payments(db) == 1
    db.flush()
    payment = db.scalar(
        select(FamilyPayment).where(
            FamilyPayment.member_id == member.id,
            FamilyPayment.kind == "regular",
        )
    )
    assert payment is not None
    assert payment.status == "scheduled"
    assert send_regular_payment_reminders(db) == 1
    db.flush()
    assert send_regular_payment_reminders(db) == 0

    payment.period_start = date.today()
    payment.due_at = utcnow() - timedelta(hours=1)
    db.commit()
    activated_count, due_notifications = activate_regular_payments(db)
    db.flush()

    assert activated_count == 1
    assert due_notifications == 1
    assert payment.status == "due"
    assert member.status == "payment_due"

    payment.due_at = utcnow() - timedelta(hours=25)
    db.commit()
    overdue_count, overdue_notifications = mark_overdue_regular_payments(db)
    db.flush()

    assert overdue_count == 1
    assert overdue_notifications == 2
    assert payment.status == "overdue"
    assert member.status == "payment_due"


def test_month_end_fallback_is_calendar_safe() -> None:
    assert add_months(date(2025, 1, 31), 1) == date(2025, 2, 28)
    assert add_months(date(2024, 1, 31), 1) == date(2024, 2, 29)
    assert add_months(date(2025, 12, 31), 1) == date(2026, 1, 31)


def test_closed_family_does_not_send_future_payment_reminders(db: Session) -> None:
    service = make_service(db)
    owner = make_user(db, 7)
    candidate = make_user(db, 8)
    family = make_family(db, owner, service)
    member = add_member(db, family, candidate, status="active")
    payment = FamilyPayment(
        family_id=family.id,
        member_id=member.id,
        kind="regular",
        status="scheduled",
        amount_kzt=family.member_share_kzt,
        period=family.period,
        period_start=date.today() + timedelta(days=3),
        period_end=date.today() + timedelta(days=33),
        due_at=utcnow() + timedelta(days=3),
    )
    family.status = "closing"
    family.closes_at = utcnow() - timedelta(minutes=1)
    db.add(payment)
    db.commit()

    closed_count, _ = close_due_families(db)
    db.flush()

    assert closed_count == 1
    assert family.status == "closed"
    assert payment.status == "cancelled"
    assert payment.cancel_reason == "family_closed"
    assert send_regular_payment_reminders(db) == 0


def test_closing_reminder_repeats_daily_until_member_acknowledges(
    db: Session,
) -> None:
    service = make_service(db)
    owner = make_user(db, 9)
    candidate = make_user(db, 10)
    family = make_family(db, owner, service)
    member = add_member(db, family, candidate, status="active")
    close_family(db, owner, family.id)
    family.closing_started_at = utcnow() - timedelta(hours=25)
    family.closes_at = utcnow() + timedelta(hours=47)
    db.commit()

    assert send_closing_acknowledgement_reminders(db) == 1
    assert send_closing_acknowledgement_reminders(db) == 0

    acknowledge_family_closing(db, candidate, family.id)
    db.refresh(member)

    assert member.closing_acknowledged_at is not None
    assert send_closing_acknowledgement_reminders(db) == 0
