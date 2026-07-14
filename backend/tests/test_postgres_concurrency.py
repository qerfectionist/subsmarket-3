from __future__ import annotations

import os
import threading
import uuid
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, delete, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from subsmarket.catalog.models import FamilyService
from subsmarket.core.database import utcnow
from subsmarket.families.models import (
    Family,
    FamilyInvite,
    FamilyMember,
    FamilyRequest,
)
from subsmarket.families.schemas import FamilyCreate
from subsmarket.families.service import (
    approve_join_request,
    close_family,
    create_family,
    create_family_invite,
    create_join_request,
    leave_family,
    mark_access_provided,
    remove_member,
)
from subsmarket.identity.models import User
from subsmarket.identity.schemas import TelegramUserData
from subsmarket.identity.service import upsert_user
from subsmarket.marketplace.models import (
    MarketplaceListing,
    MarketplaceListingRequest,
    MarketplaceOperator,
)
from subsmarket.marketplace.schemas import (
    MarketplaceListingCreate,
    MarketplaceRequestCreate,
)
from subsmarket.marketplace.service import (
    accept_marketplace_request,
    create_marketplace_listing,
    create_marketplace_request,
    get_marketplace_price_insight,
    reject_marketplace_request,
)
from subsmarket.notifications.models import NotificationJob

POSTGRES_TEST_DATABASE_URL = os.getenv("POSTGRES_TEST_DATABASE_URL")

pytestmark = pytest.mark.skipif(
    not POSTGRES_TEST_DATABASE_URL,
    reason="POSTGRES_TEST_DATABASE_URL is required for lock tests",
)


def test_marketplace_price_insight_uses_postgres_percentiles() -> None:
    assert POSTGRES_TEST_DATABASE_URL is not None
    engine = create_engine(POSTGRES_TEST_DATABASE_URL, pool_size=2, max_overflow=0)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    suffix = uuid.uuid4().hex[:10]
    user_ids: list[uuid.UUID] = []
    operator_id: uuid.UUID | None = None

    try:
        with session_factory() as db:
            operator = MarketplaceOperator(
                slug=f"price-insight-{suffix}",
                name="Price Insight",
                is_active=True,
                min_lot_gb=Decimal("1.00"),
                max_lot_gb=Decimal("50.00"),
                amount_step_gb=Decimal("1.00"),
                validity_days=7,
            )
            users = [
                User(
                    telegram_user_id=970000000 + int(suffix[:6], 16) + index,
                    username=f"price_user_{index}_{suffix}",
                    first_name=f"User {index}",
                )
                for index in range(6)
            ]
            db.add_all([operator, *users])
            db.flush()
            db.add_all(
                [
                    MarketplaceListing(
                        seller_user_id=seller.id,
                        listing_type="mobile_data",
                        operator_id=operator.id,
                        price_per_gb_kzt=price,
                        status="active",
                        expires_at=utcnow() + timedelta(days=7),
                        published_at=utcnow(),
                    )
                    for seller, price in zip(
                        users[1:],
                        (100, 120, 140, 160, 180),
                        strict=True,
                    )
                ]
            )
            db.commit()
            operator_id = operator.id
            user_ids = [user.id for user in users]

            insight = get_marketplace_price_insight(
                db,
                users[0],
                operator_slug=operator.slug,
            )
            assert insight.sample_size == 5
            assert insight.median_price_per_gb_kzt == 140
            assert insight.typical_min_price_per_gb_kzt == 120
            assert insight.typical_max_price_per_gb_kzt == 160
    finally:
        with session_factory() as db:
            if operator_id is not None:
                db.execute(
                    delete(MarketplaceListing).where(
                        MarketplaceListing.operator_id == operator_id
                    )
                )
                db.execute(
                    delete(MarketplaceOperator).where(
                        MarketplaceOperator.id == operator_id
                    )
                )
            if user_ids:
                db.execute(delete(User).where(User.id.in_(user_ids)))
            db.commit()
        engine.dispose()


def test_two_approvals_cannot_take_the_same_last_place() -> None:
    assert POSTGRES_TEST_DATABASE_URL is not None
    engine = create_engine(POSTGRES_TEST_DATABASE_URL, pool_size=4, max_overflow=0)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    suffix = uuid.uuid4().hex[:10]

    with session_factory() as db:
        service = FamilyService(
            slug=f"concurrency-{suffix}",
            name="Concurrency Service",
            variant=None,
            family_type="subscription",
            category="tests",
            subcategory=None,
            max_members=2,
            supported_periods=["monthly"],
            status="active",
            service_metadata={},
        )
        owner = User(
            telegram_user_id=710000000 + int(suffix[:6], 16),
            username=f"owner_{suffix}",
            first_name="Owner",
        )
        first_candidate = User(
            telegram_user_id=720000000 + int(suffix[:6], 16),
            username=f"first_{suffix}",
            first_name="First",
        )
        second_candidate = User(
            telegram_user_id=730000000 + int(suffix[:6], 16),
            username=f"second_{suffix}",
            first_name="Second",
        )
        db.add_all([service, owner, first_candidate, second_candidate])
        db.commit()
        family = create_family(
            db,
            owner,
            FamilyCreate(
                service_id=service.id,
                period="monthly",
                max_members=2,
                total_price_kzt=2000,
                payment_day=15,
                next_payment_date=date.today() + timedelta(days=30),
                payment_bank="kaspi",
                payment_phone="+77001234567",
            ),
        )
        first_request = create_join_request(db, first_candidate, family.id)
        second_request = create_join_request(db, second_candidate, family.id)
        owner_id = owner.id
        family_id = family.id
        request_ids = [first_request.id, second_request.id]
        user_ids = [owner.id, first_candidate.id, second_candidate.id]
        service_id = service.id
        db.commit()

    barrier = threading.Barrier(2)
    results: list[str] = []

    def approve(request_id: uuid.UUID) -> None:
        with session_factory() as db:
            owner = db.get(User, owner_id)
            assert owner is not None
            barrier.wait(timeout=10)
            try:
                approve_join_request(db, owner, request_id)
                db.commit()
                results.append("approved")
            except HTTPException as exc:
                db.rollback()
                results.append(str(exc.detail))
            except Exception as exc:  # pragma: no cover - reports exact DB error
                db.rollback()
                results.append(f"database-error:{type(exc).__name__}:{exc}")

    threads = [
        threading.Thread(target=approve, args=(request_id,), daemon=True)
        for request_id in request_ids
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=15)

    try:
        assert all(not thread.is_alive() for thread in threads)
        assert results.count("approved") == 1
        assert not any(result.startswith("database-error") for result in results)

        with session_factory() as db:
            family = db.get(Family, family_id)
            assert family is not None
            request_statuses = set(
                db.scalars(
                    select(FamilyRequest.status).where(
                        FamilyRequest.id.in_(request_ids)
                    )
                ).all()
            )
            assert family.status == "full"
            assert family.active_members_count == 2
            assert request_statuses == {"approved", "cancelled"}
    finally:
        with session_factory() as db:
            db.execute(
                delete(NotificationJob).where(
                    NotificationJob.recipient_user_id.in_(user_ids)
                )
            )
            db.execute(delete(Family).where(Family.id == family_id))
            db.execute(delete(User).where(User.id.in_(user_ids)))
            db.execute(delete(FamilyService).where(FamilyService.id == service_id))
            db.commit()
        engine.dispose()


def test_parallel_family_creation_cannot_exceed_owner_limit() -> None:
    assert POSTGRES_TEST_DATABASE_URL is not None
    engine = create_engine(POSTGRES_TEST_DATABASE_URL, pool_size=4, max_overflow=0)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    suffix = uuid.uuid4().hex[:10]

    with session_factory() as db:
        service = FamilyService(
            slug=f"owner-limit-{suffix}",
            name="Owner Limit Service",
            variant=None,
            family_type="subscription",
            category="tests",
            subcategory=None,
            max_members=4,
            supported_periods=["monthly"],
            status="active",
            service_metadata={},
        )
        owner = User(
            telegram_user_id=740000000 + int(suffix[:6], 16),
            username=f"limit_owner_{suffix}",
            first_name="Owner",
        )
        db.add_all([service, owner])
        db.commit()
        create_family(
            db,
            owner,
            _family_create_payload(service.id, total_price_kzt=3000),
        )
        owner_id = owner.id
        service_id = service.id
        db.commit()

    barrier = threading.Barrier(2)
    results: list[str] = []

    def create(total_price_kzt: int) -> None:
        with session_factory() as db:
            owner = db.get(User, owner_id)
            assert owner is not None
            barrier.wait(timeout=10)
            try:
                family = create_family(
                    db,
                    owner,
                    _family_create_payload(
                        service_id,
                        total_price_kzt=total_price_kzt,
                    ),
                )
                family_id = str(family.id)
                db.commit()
                results.append(family_id)
            except HTTPException as exc:
                db.rollback()
                results.append(str(exc.detail))

    threads = [
        threading.Thread(target=create, args=(3100,), daemon=True),
        threading.Thread(target=create, args=(3200,), daemon=True),
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=15)

    try:
        assert all(not thread.is_alive() for thread in threads)
        assert results.count("OWNER_ACTIVE_FAMILY_LIMIT_REACHED") == 1
        with session_factory() as db:
            families = list(
                db.scalars(select(Family).where(Family.owner_user_id == owner_id)).all()
            )
            assert len(families) == 2
    finally:
        _cleanup_owner_case(session_factory, owner_id, service_id)
        engine.dispose()


def test_parallel_idempotent_family_creation_returns_one_family() -> None:
    assert POSTGRES_TEST_DATABASE_URL is not None
    engine = create_engine(POSTGRES_TEST_DATABASE_URL, pool_size=4, max_overflow=0)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    suffix = uuid.uuid4().hex[:10]

    with session_factory() as db:
        service = FamilyService(
            slug=f"idempotency-{suffix}",
            name="Idempotency Service",
            variant=None,
            family_type="subscription",
            category="tests",
            subcategory=None,
            max_members=4,
            supported_periods=["monthly"],
            status="active",
            service_metadata={},
        )
        owner = User(
            telegram_user_id=750000000 + int(suffix[:6], 16),
            username=f"idempotent_owner_{suffix}",
            first_name="Owner",
        )
        db.add_all([service, owner])
        db.commit()
        owner_id = owner.id
        service_id = service.id

    barrier = threading.Barrier(2)
    results: list[str] = []

    def create() -> None:
        with session_factory() as db:
            owner = db.get(User, owner_id)
            assert owner is not None
            barrier.wait(timeout=10)
            family = create_family(
                db,
                owner,
                _family_create_payload(service_id, total_price_kzt=4000),
                idempotency_key=f"parallel-family-{suffix}",
            )
            family_id = str(family.id)
            db.commit()
            results.append(family_id)

    threads = [threading.Thread(target=create, daemon=True) for _ in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=15)

    try:
        assert all(not thread.is_alive() for thread in threads)
        assert len(results) == 2
        assert len(set(results)) == 1
        with session_factory() as db:
            family_ids = list(
                db.scalars(
                    select(Family.id).where(Family.owner_user_id == owner_id)
                ).all()
            )
            assert len(family_ids) == 1
    finally:
        _cleanup_owner_case(session_factory, owner_id, service_id)
        engine.dispose()


def test_parallel_family_invite_creation_returns_one_active_code() -> None:
    assert POSTGRES_TEST_DATABASE_URL is not None
    engine = create_engine(POSTGRES_TEST_DATABASE_URL, pool_size=4, max_overflow=0)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    suffix = uuid.uuid4().hex[:10]

    with session_factory() as db:
        service = FamilyService(
            slug=f"invite-{suffix}",
            name="Invite Service",
            variant=None,
            family_type="subscription",
            category="tests",
            subcategory=None,
            max_members=4,
            supported_periods=["monthly"],
            status="active",
            service_metadata={},
        )
        owner = User(
            telegram_user_id=770000000 + int(suffix[:6], 16),
            username=f"invite_owner_{suffix}",
            first_name="Owner",
        )
        db.add_all([service, owner])
        db.commit()
        family = create_family(
            db,
            owner,
            _family_create_payload(service.id, total_price_kzt=4000),
        )
        owner_id = owner.id
        family_id = family.id
        service_id = service.id
        db.commit()

    barrier = threading.Barrier(2)
    results: list[str] = []

    def create_invite() -> None:
        with session_factory() as db:
            owner = db.get(User, owner_id)
            assert owner is not None
            barrier.wait(timeout=10)
            invite = create_family_invite(db, owner, family_id)
            code = invite.code
            db.commit()
            results.append(code)

    threads = [threading.Thread(target=create_invite, daemon=True) for _ in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=15)

    try:
        assert all(not thread.is_alive() for thread in threads)
        assert len(results) == 2
        assert len(set(results)) == 1
        with session_factory() as db:
            active_invites = list(
                db.scalars(
                    select(FamilyInvite)
                    .where(FamilyInvite.family_id == family_id)
                    .where(FamilyInvite.status == "active")
                ).all()
            )
            assert len(active_invites) == 1
            assert active_invites[0].code == results[0]
    finally:
        _cleanup_owner_case(session_factory, owner_id, service_id)
        engine.dispose()


def test_parallel_first_identity_requests_return_one_user() -> None:
    assert POSTGRES_TEST_DATABASE_URL is not None
    engine = create_engine(POSTGRES_TEST_DATABASE_URL, pool_size=4, max_overflow=0)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    suffix = uuid.uuid4().hex[:10]
    telegram_user_id = 760000000 + int(suffix[:6], 16)
    telegram_user = TelegramUserData(
        telegram_user_id=telegram_user_id,
        username=f"identity_{suffix}",
        first_name="Identity",
        last_name=None,
        photo_url=None,
    )
    barrier = threading.Barrier(2)
    results: list[str] = []

    def create() -> None:
        with session_factory() as db:
            barrier.wait(timeout=10)
            user = upsert_user(db, telegram_user)
            results.append(str(user.id))

    threads = [threading.Thread(target=create, daemon=True) for _ in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=15)

    try:
        assert all(not thread.is_alive() for thread in threads)
        assert len(results) == 2
        assert len(set(results)) == 1
        with session_factory() as db:
            users = list(
                db.scalars(
                    select(User).where(User.telegram_user_id == telegram_user_id)
                ).all()
            )
            assert len(users) == 1
    finally:
        with session_factory() as db:
            db.execute(delete(User).where(User.telegram_user_id == telegram_user_id))
            db.commit()
        engine.dispose()


def test_parallel_removals_in_one_family_release_each_slot_once() -> None:
    case = _create_joined_members_case(member_count=2)
    barrier = threading.Barrier(2)
    results: list[str] = []

    def remove(member_id: uuid.UUID) -> None:
        with case.session_factory() as db:
            owner = db.get(User, case.owner_id)
            assert owner is not None
            barrier.wait(timeout=10)
            try:
                member = remove_member(
                    db,
                    owner,
                    member_id,
                    reason="no_response",
                )
                status = member.status
                db.commit()
                results.append(status)
            except Exception as exc:  # pragma: no cover - reports exact DB error
                db.rollback()
                results.append(f"database-error:{type(exc).__name__}:{exc}")

    threads = [
        threading.Thread(target=remove, args=(member_id,), daemon=True)
        for member_id in case.member_ids
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=15)

    try:
        assert all(not thread.is_alive() for thread in threads)
        assert results == ["removed", "removed"]
        with case.session_factory() as db:
            family = db.get(Family, case.family_id)
            assert family is not None
            statuses = list(
                db.scalars(
                    select(FamilyMember.status).where(
                        FamilyMember.id.in_(case.member_ids)
                    )
                ).all()
            )
            assert statuses == ["removed", "removed"]
            assert family.active_members_count == 1
    finally:
        case.cleanup()


def test_parallel_remove_and_leave_change_membership_once() -> None:
    case = _create_joined_members_case(member_count=1)
    member_id = case.member_ids[0]
    candidate_id = case.candidate_ids[0]
    barrier = threading.Barrier(2)
    results: list[str] = []

    def remove() -> None:
        with case.session_factory() as db:
            owner = db.get(User, case.owner_id)
            assert owner is not None
            barrier.wait(timeout=10)
            try:
                member = remove_member(db, owner, member_id, reason="other")
                status = member.status
                db.commit()
                results.append(status)
            except HTTPException as exc:
                db.rollback()
                results.append(str(exc.detail))

    def leave() -> None:
        with case.session_factory() as db:
            candidate = db.get(User, candidate_id)
            assert candidate is not None
            barrier.wait(timeout=10)
            try:
                member = leave_family(db, candidate, member_id)
                status = member.status
                db.commit()
                results.append(status)
            except HTTPException as exc:
                db.rollback()
                results.append(str(exc.detail))

    threads = [
        threading.Thread(target=remove, daemon=True),
        threading.Thread(target=leave, daemon=True),
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=15)

    try:
        assert all(not thread.is_alive() for thread in threads)
        assert len(set(results) & {"removed", "left"}) == 1
        assert len(set(results) & {"MEMBER_NOT_REMOVABLE", "MEMBER_NOT_ACTIVE"}) == 1
        with case.session_factory() as db:
            family = db.get(Family, case.family_id)
            member = db.get(FamilyMember, member_id)
            assert family is not None
            assert member is not None
            assert member.status in {"removed", "left"}
            assert family.active_members_count == 1
    finally:
        case.cleanup()


def test_parallel_close_and_remove_finish_without_deadlock() -> None:
    case = _create_joined_members_case(member_count=1)
    member_id = case.member_ids[0]
    barrier = threading.Barrier(2)
    results: list[str] = []

    def close() -> None:
        with case.session_factory() as db:
            owner = db.get(User, case.owner_id)
            assert owner is not None
            barrier.wait(timeout=10)
            try:
                family = close_family(
                    db,
                    owner,
                    case.family_id,
                    closes_on=date.today() + timedelta(days=10),
                )
                status = family.status
                db.commit()
                results.append(f"close:{status}")
            except Exception as exc:  # pragma: no cover - reports exact DB error
                db.rollback()
                results.append(f"database-error:{type(exc).__name__}:{exc}")

    def remove() -> None:
        with case.session_factory() as db:
            owner = db.get(User, case.owner_id)
            assert owner is not None
            barrier.wait(timeout=10)
            try:
                member = remove_member(db, owner, member_id, reason="other")
                status = member.status
                db.commit()
                results.append(f"remove:{status}")
            except HTTPException as exc:
                db.rollback()
                results.append(str(exc.detail))
            except Exception as exc:  # pragma: no cover - reports exact DB error
                db.rollback()
                results.append(f"database-error:{type(exc).__name__}:{exc}")

    threads = [
        threading.Thread(target=close, daemon=True),
        threading.Thread(target=remove, daemon=True),
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=15)

    try:
        assert all(not thread.is_alive() for thread in threads)
        assert "close:closing" in results
        assert not any(result.startswith("database-error") for result in results)
        assert set(results) & {"remove:removed", "FAMILY_NOT_MUTABLE"}
        with case.session_factory() as db:
            family = db.get(Family, case.family_id)
            member = db.get(FamilyMember, member_id)
            assert family is not None
            assert member is not None
            assert family.status == "closing"
            if member.status == "removed":
                assert family.active_members_count == 1
            else:
                assert member.status == "awaiting_confirmation"
                assert family.active_members_count == 2
    finally:
        case.cleanup()


@dataclass
class _JoinedMembersCase:
    engine: Engine
    session_factory: sessionmaker[Session]
    service_id: uuid.UUID
    owner_id: uuid.UUID
    candidate_ids: list[uuid.UUID]
    family_id: uuid.UUID
    member_ids: list[uuid.UUID]

    def cleanup(self) -> None:
        user_ids = [self.owner_id, *self.candidate_ids]
        with self.session_factory() as db:
            db.execute(
                delete(NotificationJob).where(
                    NotificationJob.recipient_user_id.in_(user_ids)
                )
            )
            db.execute(delete(Family).where(Family.id == self.family_id))
            db.execute(delete(User).where(User.id.in_(user_ids)))
            db.execute(delete(FamilyService).where(FamilyService.id == self.service_id))
            db.commit()
        self.engine.dispose()


def _create_joined_members_case(*, member_count: int) -> _JoinedMembersCase:
    assert POSTGRES_TEST_DATABASE_URL is not None
    engine = create_engine(POSTGRES_TEST_DATABASE_URL, pool_size=4, max_overflow=0)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    suffix = uuid.uuid4().hex[:10]
    telegram_suffix = int(suffix[:6], 16)

    with session_factory() as db:
        service = FamilyService(
            slug=f"member-race-{suffix}",
            name="Member Race Service",
            variant=None,
            family_type="subscription",
            category="tests",
            subcategory=None,
            max_members=max(4, member_count + 1),
            supported_periods=["monthly"],
            status="active",
            service_metadata={},
        )
        owner = User(
            telegram_user_id=780000000 + telegram_suffix,
            username=f"race_owner_{suffix}",
            first_name="Owner",
        )
        candidates = [
            User(
                telegram_user_id=800000000 + telegram_suffix + index,
                username=f"race_member_{index}_{suffix}",
                first_name=f"Member {index}",
            )
            for index in range(member_count)
        ]
        db.add_all([service, owner, *candidates])
        db.commit()
        family = create_family(
            db,
            owner,
            FamilyCreate(
                service_id=service.id,
                period="monthly",
                max_members=max(4, member_count + 1),
                total_price_kzt=4000,
                payment_day=15,
                next_payment_date=date.today() + timedelta(days=30),
                payment_bank="kaspi",
                payment_phone="+77001234567",
            ),
        )
        member_ids: list[uuid.UUID] = []
        for candidate in candidates:
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
            member_ids.append(member.id)

        db.commit()
        return _JoinedMembersCase(
            engine=engine,
            session_factory=session_factory,
            service_id=service.id,
            owner_id=owner.id,
            candidate_ids=[candidate.id for candidate in candidates],
            family_id=family.id,
            member_ids=member_ids,
        )


def test_parallel_marketplace_requests_create_only_one_active_request() -> None:
    assert POSTGRES_TEST_DATABASE_URL is not None
    engine = create_engine(POSTGRES_TEST_DATABASE_URL, pool_size=4, max_overflow=0)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    suffix = uuid.uuid4().hex[:10]
    user_ids: list[uuid.UUID] = []
    operator_id: uuid.UUID | None = None
    listing_id: uuid.UUID | None = None

    with session_factory() as db:
        operator = MarketplaceOperator(
            slug=f"tele2-race-{suffix}",
            name="Tele2",
            is_active=True,
            min_lot_gb=Decimal("1.00"),
            max_lot_gb=Decimal("50.00"),
            amount_step_gb=Decimal("1.00"),
            validity_days=7,
        )
        seller = User(
            telegram_user_id=910000000 + int(suffix[:6], 16),
            username=f"market_seller_{suffix}",
            first_name="Seller",
        )
        buyer = User(
            telegram_user_id=920000000 + int(suffix[:6], 16),
            username=f"market_buyer_{suffix}",
            first_name="Buyer",
        )
        db.add_all([operator, seller, buyer])
        db.commit()
        listing = create_marketplace_listing(
            db,
            seller,
            MarketplaceListingCreate(
                operator_slug=operator.slug,
                price_per_gb_kzt=100,
            ),
        )
        db.commit()
        listing_id = listing.id
        operator_id = operator.id
        seller_id = seller.id
        buyer_id = buyer.id
        user_ids = [seller_id, buyer_id]

    barrier = threading.Barrier(2)
    results: list[str] = []

    def create_request() -> None:
        with session_factory() as db:
            buyer = db.get(User, buyer_id)
            assert buyer is not None
            barrier.wait(timeout=10)
            try:
                created = create_marketplace_request(
                    db,
                    buyer,
                    listing_id,
                    MarketplaceRequestCreate(amount_gb=Decimal("5.00")),
                )
                db.commit()
                results.append(f"created:{created.id}")
            except HTTPException as exc:
                db.rollback()
                results.append(str(exc.detail))
            except Exception as exc:  # pragma: no cover - exact database failure
                db.rollback()
                results.append(f"database-error:{type(exc).__name__}:{exc}")

    threads = [threading.Thread(target=create_request, daemon=True) for _ in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=15)

    try:
        assert all(not thread.is_alive() for thread in threads)
        assert sum(result.startswith("created:") for result in results) == 1
        assert results.count("MARKETPLACE_ACTIVE_REQUEST_EXISTS") == 1
        assert not any(result.startswith("database-error") for result in results)
        with session_factory() as db:
            active_count = len(
                db.scalars(
                    select(MarketplaceListingRequest.id)
                    .where(MarketplaceListingRequest.listing_id == listing_id)
                    .where(
                        MarketplaceListingRequest.status.in_({"pending", "accepted"})
                    )
                ).all()
            )
            assert active_count == 1
    finally:
        with session_factory() as db:
            db.execute(
                delete(NotificationJob).where(
                    NotificationJob.recipient_user_id.in_(user_ids)
                )
            )
            db.execute(
                delete(MarketplaceListingRequest).where(
                    MarketplaceListingRequest.listing_id == listing_id
                )
            )
            db.execute(
                delete(MarketplaceListing).where(MarketplaceListing.id == listing_id)
            )
            db.execute(
                delete(MarketplaceOperator).where(MarketplaceOperator.id == operator_id)
            )
            db.execute(delete(User).where(User.id.in_(user_ids)))
            db.commit()
        engine.dispose()


def test_parallel_marketplace_accept_and_reject_have_one_winner() -> None:
    assert POSTGRES_TEST_DATABASE_URL is not None
    engine = create_engine(POSTGRES_TEST_DATABASE_URL, pool_size=4, max_overflow=0)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    suffix = uuid.uuid4().hex[:10]

    with session_factory() as db:
        operator = MarketplaceOperator(
            slug=f"decision-race-{suffix}",
            name="Tele2",
            is_active=True,
            min_lot_gb=Decimal("1.00"),
            max_lot_gb=Decimal("50.00"),
            amount_step_gb=Decimal("1.00"),
            validity_days=7,
        )
        seller = User(
            telegram_user_id=930000000 + int(suffix[:6], 16),
            username=f"decision_seller_{suffix}",
            first_name="Seller",
        )
        buyer = User(
            telegram_user_id=940000000 + int(suffix[:6], 16),
            username=f"decision_buyer_{suffix}",
            first_name="Buyer",
        )
        db.add_all([operator, seller, buyer])
        db.commit()
        listing = create_marketplace_listing(
            db,
            seller,
            MarketplaceListingCreate(
                operator_slug=operator.slug,
                price_per_gb_kzt=120,
            ),
        )
        request = create_marketplace_request(
            db,
            buyer,
            listing.id,
            MarketplaceRequestCreate(amount_gb=Decimal("5.00")),
        )
        db.commit()
        request_id = request.id
        listing_id = listing.id
        operator_id = operator.id
        seller_id = seller.id
        user_ids = [seller.id, buyer.id]

    barrier = threading.Barrier(2)
    results: list[str] = []

    def decide(target: str) -> None:
        with session_factory() as db:
            seller = db.get(User, seller_id)
            assert seller is not None
            barrier.wait(timeout=10)
            try:
                if target == "accepted":
                    result = accept_marketplace_request(db, seller, request_id)
                else:
                    result = reject_marketplace_request(
                        db,
                        seller,
                        request_id,
                        reason=None,
                    )
                db.commit()
                results.append(result.status)
            except HTTPException as exc:
                db.rollback()
                results.append(str(exc.detail))
            except Exception as exc:  # pragma: no cover - exact database failure
                db.rollback()
                results.append(f"database-error:{type(exc).__name__}:{exc}")

    threads = [
        threading.Thread(target=decide, args=(target,), daemon=True)
        for target in ("accepted", "rejected")
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=15)

    try:
        assert all(not thread.is_alive() for thread in threads)
        winner_count = sum(
            result in {"accepted", "rejected"} for result in results
        )
        assert winner_count == 1, results
        assert results.count("MARKETPLACE_REQUEST_STATUS_CONFLICT") == 1
        assert not any(result.startswith("database-error") for result in results)
        with session_factory() as db:
            stored = db.get(MarketplaceListingRequest, request_id)
            assert stored is not None
            assert stored.status in {"accepted", "rejected"}
            decision_jobs = list(
                db.scalars(
                    select(NotificationJob).where(
                        NotificationJob.recipient_user_id.in_(user_ids),
                        NotificationJob.event_type.in_(
                            {
                                "marketplace_request_accepted",
                                "marketplace_request_rejected",
                            }
                        ),
                    )
                ).all()
            )
            assert len(decision_jobs) == 1
    finally:
        with session_factory() as db:
            db.execute(
                delete(NotificationJob).where(
                    NotificationJob.recipient_user_id.in_(user_ids)
                )
            )
            db.execute(
                delete(MarketplaceListingRequest).where(
                    MarketplaceListingRequest.listing_id == listing_id
                )
            )
            db.execute(
                delete(MarketplaceListing).where(MarketplaceListing.id == listing_id)
            )
            db.execute(
                delete(MarketplaceOperator).where(MarketplaceOperator.id == operator_id)
            )
            db.execute(delete(User).where(User.id.in_(user_ids)))
            db.commit()
        engine.dispose()


def test_parallel_marketplace_accepts_are_independent_without_inventory() -> None:
    assert POSTGRES_TEST_DATABASE_URL is not None
    engine = create_engine(POSTGRES_TEST_DATABASE_URL, pool_size=4, max_overflow=0)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    suffix = uuid.uuid4().hex[:10]

    with session_factory() as db:
        operator = MarketplaceOperator(
            slug=f"inventory-race-{suffix}",
            name="Tele2",
            is_active=True,
            min_lot_gb=Decimal("1.00"),
            max_lot_gb=Decimal("50.00"),
            amount_step_gb=Decimal("1.00"),
            validity_days=7,
        )
        seller = User(
            telegram_user_id=950000000 + int(suffix[:6], 16),
            username=f"inventory_seller_{suffix}",
            first_name="Seller",
        )
        buyers = [
            User(
                telegram_user_id=960000000 + int(suffix[:6], 16) + index,
                username=f"inventory_buyer_{index}_{suffix}",
                first_name=f"Buyer {index}",
            )
            for index in range(2)
        ]
        db.add_all([operator, seller, *buyers])
        db.commit()
        listing = create_marketplace_listing(
            db,
            seller,
            MarketplaceListingCreate(
                operator_slug=operator.slug,
                price_per_gb_kzt=120,
            ),
        )
        requests = [
            create_marketplace_request(
                db,
                buyer,
                listing.id,
                MarketplaceRequestCreate(amount_gb=Decimal("5.00")),
            )
            for buyer in buyers
        ]
        db.commit()
        request_ids = [request.id for request in requests]
        listing_id = listing.id
        operator_id = operator.id
        seller_id = seller.id
        user_ids = [seller.id, *(buyer.id for buyer in buyers)]

    barrier = threading.Barrier(2)
    results: list[str] = []

    def accept(request_id: uuid.UUID) -> None:
        with session_factory() as db:
            seller = db.get(User, seller_id)
            assert seller is not None
            barrier.wait(timeout=10)
            try:
                result = accept_marketplace_request(db, seller, request_id)
                db.commit()
                results.append(result.status)
            except HTTPException as exc:
                db.rollback()
                results.append(str(exc.detail))
            except Exception as exc:  # pragma: no cover - exact database failure
                db.rollback()
                results.append(f"database-error:{type(exc).__name__}:{exc}")

    threads = [
        threading.Thread(target=accept, args=(request_id,), daemon=True)
        for request_id in request_ids
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=15)

    try:
        assert all(not thread.is_alive() for thread in threads)
        assert results.count("accepted") == 2, results
        assert not any(result.startswith("database-error") for result in results)
        with session_factory() as db:
            stored = db.get(MarketplaceListing, listing_id)
            assert stored is not None
    finally:
        with session_factory() as db:
            db.execute(
                delete(NotificationJob).where(
                    NotificationJob.recipient_user_id.in_(user_ids)
                )
            )
            db.execute(
                delete(MarketplaceListingRequest).where(
                    MarketplaceListingRequest.listing_id == listing_id
                )
            )
            db.execute(
                delete(MarketplaceListing).where(MarketplaceListing.id == listing_id)
            )
            db.execute(
                delete(MarketplaceOperator).where(MarketplaceOperator.id == operator_id)
            )
            db.execute(delete(User).where(User.id.in_(user_ids)))
            db.commit()
        engine.dispose()


def _family_create_payload(
    service_id: uuid.UUID,
    *,
    total_price_kzt: int,
) -> FamilyCreate:
    return FamilyCreate(
        service_id=service_id,
        period="monthly",
        max_members=4,
        total_price_kzt=total_price_kzt,
        payment_day=15,
        next_payment_date=date.today() + timedelta(days=30),
        payment_bank="kaspi",
        payment_phone="+77001234567",
    )


def _cleanup_owner_case(
    session_factory: sessionmaker,
    owner_id: uuid.UUID,
    service_id: uuid.UUID,
) -> None:
    with session_factory() as db:
        db.execute(
            delete(NotificationJob).where(NotificationJob.recipient_user_id == owner_id)
        )
        db.execute(delete(Family).where(Family.owner_user_id == owner_id))
        db.execute(delete(User).where(User.id == owner_id))
        db.execute(delete(FamilyService).where(FamilyService.id == service_id))
        db.commit()
