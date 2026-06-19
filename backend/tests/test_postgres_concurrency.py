from __future__ import annotations

import os
import threading
import uuid
from datetime import date, timedelta

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, delete, select
from sqlalchemy.orm import sessionmaker

from subsmarket.catalog.models import FamilyService
from subsmarket.families.models import Family, FamilyInvite, FamilyRequest
from subsmarket.families.schemas import FamilyCreate
from subsmarket.families.service import (
    approve_join_request,
    create_family,
    create_family_invite,
    create_join_request,
)
from subsmarket.identity.models import User
from subsmarket.identity.schemas import TelegramUserData
from subsmarket.identity.service import upsert_user
from subsmarket.notifications.models import NotificationJob

POSTGRES_TEST_DATABASE_URL = os.getenv("POSTGRES_TEST_DATABASE_URL")

pytestmark = pytest.mark.skipif(
    not POSTGRES_TEST_DATABASE_URL,
    reason="POSTGRES_TEST_DATABASE_URL is required for lock tests",
)


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

    barrier = threading.Barrier(2)
    results: list[str] = []

    def approve(request_id: uuid.UUID) -> None:
        with session_factory() as db:
            owner = db.get(User, owner_id)
            assert owner is not None
            barrier.wait(timeout=10)
            try:
                approve_join_request(db, owner, request_id)
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
                results.append(str(family.id))
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
                db.scalars(
                    select(Family).where(Family.owner_user_id == owner_id)
                ).all()
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
            results.append(str(family.id))

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

    barrier = threading.Barrier(2)
    results: list[str] = []

    def create_invite() -> None:
        with session_factory() as db:
            owner = db.get(User, owner_id)
            assert owner is not None
            barrier.wait(timeout=10)
            invite = create_family_invite(db, owner, family_id)
            results.append(invite.code)

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
