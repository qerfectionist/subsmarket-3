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
from subsmarket.families.models import Family, FamilyRequest
from subsmarket.families.schemas import FamilyCreate
from subsmarket.families.service import (
    approve_join_request,
    create_family,
    create_join_request,
)
from subsmarket.identity.models import User
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
