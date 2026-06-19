from __future__ import annotations

from collections.abc import Iterator
from datetime import date, timedelta

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from subsmarket.catalog.models import FamilyService
from subsmarket.core.database import Base, utcnow
from subsmarket.families.models import (
    Family,
    FamilyAuditLog,
    FamilyMember,
    FamilyPayment,
    FamilyRequest,
    FamilyRequestRestriction,
)
from subsmarket.families.schemas import (
    FamilyCreate,
    FamilyPaymentDayUpdate,
    FamilyPriceUpdate,
    PrepaymentPeriodsCreate,
)
from subsmarket.families.service import (
    acknowledge_member_removal,
    approve_join_request,
    calculate_member_share,
    cancel_join_request,
    close_family,
    confirm_access_received,
    confirm_payment_received,
    create_family,
    create_join_request,
    create_member_prepayment,
    get_family_view,
    get_open_payment_requisite,
    leave_family,
    list_searchable_families,
    mark_access_provided,
    normalize_payment_phone,
    record_owner_prepaid_periods,
    reject_join_request,
    remind_access_confirmation,
    report_payment_paid,
    request_member_removal_cancellation,
    revoke_member_removal,
    schedule_member_removal,
    to_family_out,
    to_family_request_out,
    update_family_payment_day,
    update_family_price,
)
from subsmarket.identity.models import User
from subsmarket.jobs.service import (
    create_regular_payments,
    execute_member_removals,
    send_access_confirmation_reminders,
    send_owner_payment_confirmation_reminders,
)
from subsmarket.models import import_models
from subsmarket.notifications.models import NotificationJob
from subsmarket.notifications.service import enqueue_notification


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


@pytest.fixture()
def subscription_service(db: Session) -> FamilyService:
    service = FamilyService(
        slug="youtube-premium",
        name="YouTube Premium",
        variant="Family",
        family_type="subscription",
        category="streaming",
        subcategory="video",
        max_members=6,
        supported_periods=["monthly", "yearly"],
        status="active",
        service_metadata={},
    )
    db.add(service)
    db.commit()
    db.refresh(service)
    return service


def make_user(db: Session, index: int) -> User:
    user = User(
        telegram_user_id=900000 + index,
        username=f"user_{index}",
        first_name=f"User {index}",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def make_family(
    db: Session,
    owner: User,
    service: FamilyService,
    *,
    max_members: int = 3,
    owner_rules: str | None = None,
) -> Family:
    family = create_family(
        db,
        owner,
        FamilyCreate(
            service_id=service.id,
            period="monthly",
            max_members=max_members,
            total_price_kzt=3800,
            payment_day=15,
            next_payment_date=date.today() + timedelta(days=30),
            description="Test family",
            owner_rules=owner_rules,
            payment_bank="kaspi",
            payment_phone="+77001234567",
        ),
    )
    return family


def make_active_member(
    db: Session,
    owner: User,
    candidate: User,
    family: Family,
) -> tuple[FamilyMember, FamilyPayment]:
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
    access_result = confirm_access_received(db, candidate, member.id)
    first_payment = db.get(FamilyPayment, access_result.payment.id)
    assert first_payment is not None
    report_payment_paid(db, candidate, first_payment.id)
    confirm_payment_received(db, owner, first_payment.id)
    db.refresh(member)
    return member, first_payment


def make_scheduled_payment(
    db: Session,
    family: Family,
    member: FamilyMember,
) -> FamilyPayment:
    payment = FamilyPayment(
        family_id=family.id,
        member_id=member.id,
        kind="regular",
        status="scheduled",
        amount_kzt=family.member_share_kzt,
        period=family.period,
        period_start=family.next_payment_date,
        period_end=family.next_payment_date + timedelta(days=30),
        due_at=utcnow() + timedelta(days=30),
    )
    db.add(payment)
    db.flush()
    enqueue_notification(
        db,
        recipient_user_id=member.user_id,
        event_type="regular_payment_reminder_3d_member",
        payload={
            "family_id": str(family.id),
            "member_id": str(member.id),
            "payment_id": str(payment.id),
            "message": "Upcoming payment",
        },
    )
    db.commit()
    db.refresh(payment)
    return payment


def test_price_share_is_rounded_to_nearest_50_kzt() -> None:
    share, delta = calculate_member_share(total_price_kzt=3800, max_members=6)

    assert share == 650
    assert delta == 100


def test_payment_phone_rejects_card_like_values() -> None:
    with pytest.raises(HTTPException) as exc:
        normalize_payment_phone("4400 4300 1200 9999")

    assert exc.value.status_code == 400
    assert exc.value.detail == "PAYMENT_PHONE_ONLY_NO_CARD_OR_IBAN"


def test_rejected_request_blocks_same_family(
    db: Session, subscription_service: FamilyService
) -> None:
    owner = make_user(db, 1)
    candidate = make_user(db, 2)
    family = make_family(db, owner, subscription_service)
    request = create_join_request(db, candidate, family.id)

    reject_join_request(db, owner, request.id)

    restriction = db.get(
        FamilyRequestRestriction,
        {"family_id": family.id, "user_id": candidate.id},
    )
    assert restriction is not None
    assert restriction.reason == "rejected"

    with pytest.raises(HTTPException) as exc:
        create_join_request(db, candidate, family.id)

    assert exc.value.status_code == 409
    assert exc.value.detail == "FAMILY_REQUEST_FORBIDDEN"


def test_search_hides_own_pending_member_and_restricted_families(
    db: Session, subscription_service: FamilyService
) -> None:
    candidate = make_user(db, 5)
    own_family = make_family(db, candidate, subscription_service)
    pending_family = make_family(db, make_user(db, 6), subscription_service)
    member_owner = make_user(db, 7)
    member_family = make_family(db, member_owner, subscription_service)
    rejected_owner = make_user(db, 8)
    rejected_family = make_family(db, rejected_owner, subscription_service)
    visible_family = make_family(db, make_user(db, 9), subscription_service)

    create_join_request(db, candidate, pending_family.id)
    member_request = create_join_request(db, candidate, member_family.id)
    approve_join_request(db, member_owner, member_request.id)
    rejected_request = create_join_request(db, candidate, rejected_family.id)
    reject_join_request(db, rejected_owner, rejected_request.id)

    family_ids = {
        family.id for family in list_searchable_families(db, candidate)
    }

    assert visible_family.id in family_ids
    assert own_family.id not in family_ids
    assert pending_family.id not in family_ids
    assert member_family.id not in family_ids
    assert rejected_family.id not in family_ids


def test_owner_username_is_visible_only_while_request_is_active(
    db: Session, subscription_service: FamilyService
) -> None:
    owner = make_user(db, 13)
    candidate = make_user(db, 14)
    family = make_family(db, owner, subscription_service)

    assert get_family_view(db, candidate, family.id).owner_username is None

    request = create_join_request(db, candidate, family.id)

    assert get_family_view(db, candidate, family.id).owner_username == owner.username

    cancel_join_request(db, candidate, request.id)

    assert get_family_view(db, candidate, family.id).owner_username is None


def test_family_request_response_contains_family_summary(
    db: Session, subscription_service: FamilyService
) -> None:
    owner = make_user(db, 3)
    candidate = make_user(db, 4)
    family = make_family(db, owner, subscription_service)
    request = create_join_request(db, candidate, family.id)

    response = to_family_request_out(request)

    assert response.family_type == "subscription"
    assert response.service_name == "YouTube Premium"
    assert response.service_variant == "Family"


def test_family_full_auto_cancels_other_pending_requests_without_restriction(
    db: Session, subscription_service: FamilyService
) -> None:
    owner = make_user(db, 10)
    accepted_candidate = make_user(db, 11)
    waiting_candidate = make_user(db, 12)
    family = make_family(db, owner, subscription_service, max_members=2)
    accepted_request = create_join_request(db, accepted_candidate, family.id)
    waiting_request = create_join_request(db, waiting_candidate, family.id)

    approve_join_request(db, owner, accepted_request.id)

    db.refresh(family)
    cancelled_request = db.get(FamilyRequest, waiting_request.id)
    restriction = db.get(
        FamilyRequestRestriction,
        {"family_id": family.id, "user_id": waiting_candidate.id},
    )

    assert family.status == "full"
    assert family.active_members_count == 2
    assert cancelled_request is not None
    assert cancelled_request.status == "cancelled"
    assert cancelled_request.cancel_reason == "family_full"
    assert restriction is None


def test_active_request_limit_is_three_per_service(
    db: Session, subscription_service: FamilyService
) -> None:
    candidate = make_user(db, 20)
    families = [
        make_family(db, make_user(db, 30 + index), subscription_service)
        for index in range(4)
    ]
    for family in families[:3]:
        create_join_request(db, candidate, family.id)

    with pytest.raises(HTTPException) as exc:
        create_join_request(db, candidate, families[3].id)

    assert exc.value.status_code == 409
    assert "3 активные заявки" in str(exc.value.detail)


def test_owner_can_create_only_two_active_families(
    db: Session, subscription_service: FamilyService
) -> None:
    owner = make_user(db, 40)
    make_family(db, owner, subscription_service)
    make_family(db, owner, subscription_service)

    with pytest.raises(HTTPException) as exc:
        make_family(db, owner, subscription_service)

    assert exc.value.status_code == 409
    assert exc.value.detail == "OWNER_ACTIVE_FAMILY_LIMIT_REACHED"


def test_owner_can_update_price_once_per_month(
    db: Session, subscription_service: FamilyService
) -> None:
    owner = make_user(db, 45)
    family = make_family(db, owner, subscription_service, max_members=4)

    updated = update_family_price(
        db,
        owner,
        family.id,
        FamilyPriceUpdate(total_price_kzt=4200),
    )

    assert updated.total_price_kzt == 4200
    assert updated.member_share_kzt == 1050
    assert updated.rounding_delta_kzt == 0
    assert updated.price_updated_at is not None

    with pytest.raises(HTTPException) as exc:
        update_family_price(
            db,
            owner,
            family.id,
            FamilyPriceUpdate(total_price_kzt=4300),
        )

    assert exc.value.status_code == 409
    assert exc.value.detail == "FAMILY_PRICE_ALREADY_UPDATED"


def test_owner_can_update_payment_day_before_family_was_full(
    db: Session, subscription_service: FamilyService
) -> None:
    owner = make_user(db, 46)
    family = make_family(db, owner, subscription_service)
    next_payment_date = date.today() + timedelta(days=45)

    updated = update_family_payment_day(
        db,
        owner,
        family.id,
        FamilyPaymentDayUpdate(payment_day=18, next_payment_date=next_payment_date),
    )

    assert updated.payment_day == 18
    assert updated.next_payment_date == next_payment_date


def test_payment_day_is_locked_after_family_was_full(
    db: Session, subscription_service: FamilyService
) -> None:
    owner = make_user(db, 47)
    candidate = make_user(db, 48)
    family = make_family(db, owner, subscription_service, max_members=2)
    request = create_join_request(db, candidate, family.id)
    approve_join_request(db, owner, request.id)
    db.refresh(family)
    assert family.has_been_full is True

    with pytest.raises(HTTPException) as exc:
        update_family_payment_day(
            db,
            owner,
            family.id,
            FamilyPaymentDayUpdate(
                payment_day=18,
                next_payment_date=date.today() + timedelta(days=45),
            ),
        )

    assert exc.value.status_code == 409
    assert exc.value.detail == "FAMILY_PAYMENT_DAY_LOCKED"


def test_two_self_cancels_block_third_request_to_same_family(
    db: Session, subscription_service: FamilyService
) -> None:
    owner = make_user(db, 50)
    candidate = make_user(db, 51)
    family = make_family(db, owner, subscription_service)

    first = create_join_request(db, candidate, family.id)
    cancel_join_request(db, candidate, first.id)
    second = create_join_request(db, candidate, family.id)
    cancel_join_request(db, candidate, second.id)

    with pytest.raises(HTTPException) as exc:
        create_join_request(db, candidate, family.id)

    assert exc.value.status_code == 409
    assert exc.value.detail == "SELF_CANCEL_LIMIT_REACHED"


def test_audit_log_is_written_for_family_creation(
    db: Session, subscription_service: FamilyService
) -> None:
    owner = make_user(db, 60)
    family = make_family(db, owner, subscription_service)

    actions = list(
        db.scalars(
            select(FamilyAuditLog.action).where(
                FamilyAuditLog.family_id == family.id
            )
        ).all()
    )

    assert "family_created" in actions


def test_owner_rules_are_exposed_in_family_response(
    db: Session, subscription_service: FamilyService
) -> None:
    owner = make_user(db, 65)
    family = make_family(
        db,
        owner,
        subscription_service,
        owner_rules="Access first, payment after check.",
    )

    response = to_family_out(family)

    assert response.owner_rules == "Access first, payment after check."


def test_payment_requisite_is_hidden_before_access_confirmation(
    db: Session, subscription_service: FamilyService
) -> None:
    owner = make_user(db, 70)
    candidate = make_user(db, 71)
    family = make_family(db, owner, subscription_service)
    request = create_join_request(db, candidate, family.id)
    approve_join_request(db, owner, request.id)
    member = db.scalar(
        select(FamilyMember).where(
            FamilyMember.family_id == family.id,
            FamilyMember.user_id == candidate.id,
        )
    )
    assert member is not None

    with pytest.raises(HTTPException) as exc:
        get_open_payment_requisite(db, candidate, member.id)

    assert exc.value.status_code == 409
    assert exc.value.detail == "ACCESS_NOT_CONFIRMED"

    mark_access_provided(db, owner, member.id)
    result = confirm_access_received(db, candidate, member.id)

    assert result.payment_requisite.phone == "+77001234567"


def test_owner_can_remind_member_to_confirm_access(
    db: Session, subscription_service: FamilyService
) -> None:
    owner = make_user(db, 72)
    candidate = make_user(db, 73)
    family = make_family(db, owner, subscription_service)
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

    reminded_member = remind_access_confirmation(db, owner, member.id)

    notification = db.scalar(
        select(NotificationJob).where(
            NotificationJob.recipient_user_id == candidate.id,
            NotificationJob.event_type == "family_access_confirmation_reminder_member",
        )
    )
    audit = db.scalar(
        select(FamilyAuditLog).where(
            FamilyAuditLog.family_id == family.id,
            FamilyAuditLog.action == "family_access_confirmation_reminded",
        )
    )
    assert reminded_member.status == "awaiting_confirmation"
    assert notification is not None
    assert notification.payload["member_id"] == str(member.id)
    assert audit is not None

    with pytest.raises(HTTPException) as exc:
        remind_access_confirmation(db, owner, member.id)

    assert exc.value.status_code == 429
    assert exc.value.detail == "ACCESS_REMINDER_COOLDOWN"


def test_access_confirmation_reminder_after_day_does_not_remove_member(
    db: Session, subscription_service: FamilyService
) -> None:
    owner = make_user(db, 74)
    candidate = make_user(db, 75)
    family = make_family(db, owner, subscription_service)
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
    member.access_provided_at = utcnow() - timedelta(hours=25)
    db.commit()

    first_notification_count = send_access_confirmation_reminders(db)
    second_notification_count = send_access_confirmation_reminders(db)

    db.refresh(member)
    db.refresh(family)
    event_types = set(
        db.scalars(
            select(NotificationJob.event_type).where(
                NotificationJob.event_type.in_(
                    {
                        "access_confirmation_overdue_member",
                        "access_confirmation_overdue_owner",
                    }
                )
            )
        ).all()
    )
    assert first_notification_count == 2
    assert second_notification_count == 0
    assert member.status == "awaiting_confirmation"
    assert family.active_members_count == 2
    assert event_types == {
        "access_confirmation_overdue_member",
        "access_confirmation_overdue_owner",
    }


def test_owner_payment_confirmation_reminders_follow_schedule_and_stop(
    db: Session, subscription_service: FamilyService
) -> None:
    owner = make_user(db, 76)
    candidate = make_user(db, 77)
    family = make_family(db, owner, subscription_service)
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
    access_result = confirm_access_received(db, candidate, member.id)
    payment = db.get(FamilyPayment, access_result.payment.id)
    assert payment is not None
    report_payment_paid(db, candidate, payment.id)

    expected_events = [
        (11, "payment_confirmation_reminder_10m_owner"),
        (21, "payment_confirmation_reminder_20m_owner"),
        (41, "payment_confirmation_reminder_40m_owner"),
    ]
    for minutes, event_type in expected_events:
        payment.reported_paid_at = utcnow() - timedelta(minutes=minutes)
        db.commit()

        assert send_owner_payment_confirmation_reminders(db) == 1
        assert send_owner_payment_confirmation_reminders(db) == 0
        assert (
            db.scalar(
                select(NotificationJob).where(
                    NotificationJob.recipient_user_id == owner.id,
                    NotificationJob.event_type == event_type,
                )
            )
            is not None
        )

    payment.reported_paid_at = utcnow() - timedelta(hours=25)
    db.commit()
    assert send_owner_payment_confirmation_reminders(db) == 1
    assert send_owner_payment_confirmation_reminders(db) == 0
    assert (
        db.scalar(
            select(NotificationJob).where(
                NotificationJob.recipient_user_id == owner.id,
                NotificationJob.event_type
                == "payment_confirmation_daily_reminder_owner",
            )
        )
        is not None
    )

    confirm_payment_received(db, owner, payment.id)

    assert send_owner_payment_confirmation_reminders(db) == 0


def test_member_can_prepay_only_the_next_single_period(
    db: Session, subscription_service: FamilyService
) -> None:
    owner = make_user(db, 78)
    candidate = make_user(db, 79)
    family = make_family(db, owner, subscription_service)
    member, _ = make_active_member(db, owner, candidate, family)

    prepayment = create_member_prepayment(db, candidate, member.id)

    assert prepayment.kind == "prepaid"
    assert prepayment.status == "due"
    assert prepayment.period_start == family.next_payment_date
    assert prepayment.amount_kzt == family.member_share_kzt

    with pytest.raises(HTTPException) as exc:
        create_member_prepayment(db, candidate, member.id)

    assert exc.value.status_code == 409
    assert exc.value.detail == "MEMBER_PREPAYMENT_LIMIT_REACHED"


def test_owner_can_record_multiple_prepaid_periods_and_calendar_advances(
    db: Session, subscription_service: FamilyService
) -> None:
    owner = make_user(db, 83)
    candidate = make_user(db, 84)
    family = make_family(db, owner, subscription_service)
    member, _ = make_active_member(db, owner, candidate, family)
    family.next_payment_date = date.today() + timedelta(days=3)
    db.commit()
    original_next_payment_date = family.next_payment_date

    prepayments = record_owner_prepaid_periods(
        db,
        owner,
        member.id,
        PrepaymentPeriodsCreate(periods=3),
    )

    assert len(prepayments) == 3
    assert all(payment.kind == "prepaid" for payment in prepayments)
    assert all(payment.status == "paid" for payment in prepayments)
    assert prepayments[0].period_start == original_next_payment_date
    assert prepayments[0].period_end == prepayments[1].period_start
    assert prepayments[1].period_end == prepayments[2].period_start

    assert create_regular_payments(db) == 0
    db.flush()
    db.refresh(family)
    assert family.next_payment_date == prepayments[0].period_end


def test_owner_cannot_leave_family_like_member(
    db: Session, subscription_service: FamilyService
) -> None:
    owner = make_user(db, 80)
    family = make_family(db, owner, subscription_service)
    owner_member = db.scalar(
        select(FamilyMember).where(
            FamilyMember.family_id == family.id,
            FamilyMember.user_id == owner.id,
        )
    )
    assert owner_member is not None

    with pytest.raises(HTTPException) as exc:
        leave_family(db, owner, owner_member.id)

    assert exc.value.status_code == 400
    assert exc.value.detail == "OWNER_MUST_CLOSE_FAMILY"


def test_member_leave_frees_family_slot(
    db: Session, subscription_service: FamilyService
) -> None:
    owner = make_user(db, 90)
    candidate = make_user(db, 91)
    family = make_family(db, owner, subscription_service, max_members=2)
    request = create_join_request(db, candidate, family.id)
    approve_join_request(db, owner, request.id)
    member = db.scalar(
        select(FamilyMember).where(
            FamilyMember.family_id == family.id,
            FamilyMember.user_id == candidate.id,
        )
    )
    assert member is not None
    db.refresh(family)
    assert family.status == "full"
    assert family.active_members_count == 2

    leave_family(db, candidate, member.id)

    db.refresh(family)
    assert family.status == "active"
    assert family.active_members_count == 1


def test_member_leave_cancels_future_payment_and_pending_reminder(
    db: Session, subscription_service: FamilyService
) -> None:
    owner = make_user(db, 92)
    candidate = make_user(db, 93)
    family = make_family(db, owner, subscription_service)
    member, _ = make_active_member(db, owner, candidate, family)
    scheduled_payment = make_scheduled_payment(db, family, member)

    leave_family(db, candidate, member.id)

    db.refresh(scheduled_payment)
    reminder = db.scalar(
        select(NotificationJob).where(
            NotificationJob.event_type == "regular_payment_reminder_3d_member",
            NotificationJob.recipient_user_id == candidate.id,
        )
    )
    assert scheduled_payment.status == "cancelled"
    assert scheduled_payment.cancel_reason == "member_left"
    assert scheduled_payment.cancelled_at is not None
    assert reminder is not None
    assert reminder.status == "cancelled"


def test_family_close_starts_three_day_warning(
    db: Session, subscription_service: FamilyService
) -> None:
    owner = make_user(db, 100)
    family = make_family(db, owner, subscription_service)

    closing_family = close_family(db, owner, family.id)

    assert closing_family.status == "closing"
    assert closing_family.closing_started_at is not None
    assert closing_family.closes_at is not None
    assert closing_family.closes_at - closing_family.closing_started_at == timedelta(
        days=3
    )


def test_family_closing_cancels_future_payments(
    db: Session, subscription_service: FamilyService
) -> None:
    owner = make_user(db, 101)
    candidate = make_user(db, 102)
    family = make_family(db, owner, subscription_service)
    member, _ = make_active_member(db, owner, candidate, family)
    scheduled_payment = make_scheduled_payment(db, family, member)

    close_family(db, owner, family.id)

    db.refresh(scheduled_payment)
    assert scheduled_payment.status == "cancelled"
    assert scheduled_payment.cancel_reason == "family_closing"


def test_member_removal_warning_lasts_twelve_hours(
    db: Session, subscription_service: FamilyService
) -> None:
    owner = make_user(db, 110)
    candidate = make_user(db, 111)
    family = make_family(db, owner, subscription_service)
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

    scheduled_member = schedule_member_removal(db, owner, member.id)

    assert scheduled_member.status == "removal_pending"
    assert scheduled_member.updated_at is not None
    assert scheduled_member.removal_scheduled_at is not None
    delay = scheduled_member.removal_scheduled_at - scheduled_member.updated_at
    assert timedelta(hours=11, minutes=59) <= delay <= timedelta(hours=12, minutes=1)


def test_member_removal_timeout_cancels_future_payments(
    db: Session, subscription_service: FamilyService
) -> None:
    owner = make_user(db, 112)
    candidate = make_user(db, 113)
    family = make_family(db, owner, subscription_service)
    member, _ = make_active_member(db, owner, candidate, family)
    scheduled_payment = make_scheduled_payment(db, family, member)
    schedule_member_removal(db, owner, member.id)
    request_member_removal_cancellation(db, candidate, member.id)
    member.removal_scheduled_at = utcnow() - timedelta(minutes=1)
    db.commit()

    removed_count, _ = execute_member_removals(db)

    db.refresh(member)
    db.refresh(scheduled_payment)
    assert removed_count == 1
    assert member.status == "removed"
    assert scheduled_payment.status == "cancelled"
    assert scheduled_payment.cancel_reason == "member_removed"


def test_member_acknowledgement_keeps_slot_and_payments_active(
    db: Session, subscription_service: FamilyService
) -> None:
    owner = make_user(db, 114)
    candidate = make_user(db, 115)
    family = make_family(db, owner, subscription_service)
    member, _ = make_active_member(db, owner, candidate, family)
    scheduled_payment = make_scheduled_payment(db, family, member)
    scheduled_member = schedule_member_removal(db, owner, member.id)
    removal_deadline = scheduled_member.removal_scheduled_at
    occupied_slots = family.active_members_count

    acknowledged_member = acknowledge_member_removal(db, candidate, member.id)

    db.refresh(family)
    db.refresh(scheduled_payment)
    assert acknowledged_member.status == "removal_pending"
    assert acknowledged_member.removal_acknowledged_at is not None
    assert acknowledged_member.removal_scheduled_at == removal_deadline
    assert acknowledged_member.removed_at is None
    assert family.active_members_count == occupied_slots
    assert scheduled_payment.status == "scheduled"


def test_member_can_request_cancellation_without_stopping_removal_timer(
    db: Session, subscription_service: FamilyService
) -> None:
    owner = make_user(db, 116)
    candidate = make_user(db, 117)
    family = make_family(db, owner, subscription_service)
    member, _ = make_active_member(db, owner, candidate, family)
    scheduled_member = schedule_member_removal(db, owner, member.id)
    removal_deadline = scheduled_member.removal_scheduled_at

    requested_member = request_member_removal_cancellation(db, candidate, member.id)

    assert requested_member.status == "removal_pending"
    assert requested_member.removal_cancel_requested_at is not None
    assert requested_member.removal_scheduled_at == removal_deadline
    owner_notification = db.scalar(
        select(NotificationJob).where(
            NotificationJob.recipient_user_id == owner.id,
            NotificationJob.event_type
            == "family_member_removal_cancellation_requested",
        )
    )
    assert owner_notification is not None


def test_owner_revoke_clears_member_removal_responses(
    db: Session, subscription_service: FamilyService
) -> None:
    owner = make_user(db, 118)
    candidate = make_user(db, 119)
    family = make_family(db, owner, subscription_service)
    member, _ = make_active_member(db, owner, candidate, family)
    schedule_member_removal(db, owner, member.id)
    acknowledge_member_removal(db, candidate, member.id)
    request_member_removal_cancellation(db, candidate, member.id)

    restored_member = revoke_member_removal(db, owner, member.id)

    assert restored_member.status == "active"
    assert restored_member.removal_scheduled_at is None
    assert restored_member.removal_acknowledged_at is None
    assert restored_member.removal_cancel_requested_at is None
