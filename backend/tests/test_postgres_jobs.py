from __future__ import annotations

import os
from collections.abc import Callable

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from subsmarket.core.config import normalize_sqlalchemy_database_url
from subsmarket.core.idempotency import cleanup_expired_idempotency_records
from subsmarket.jobs.service import (
    activate_regular_payments,
    execute_member_removals,
    expire_family_requests,
    mark_overdue_first_payments,
    mark_overdue_regular_payments,
    send_access_confirmation_reminders,
    send_closing_acknowledgement_reminders,
    send_owner_payment_confirmation_reminders,
    send_regular_payment_reminders,
)

POSTGRES_TEST_DATABASE_URL = os.getenv("POSTGRES_TEST_DATABASE_URL")

pytestmark = pytest.mark.skipif(
    not POSTGRES_TEST_DATABASE_URL,
    reason="POSTGRES_TEST_DATABASE_URL is required for PostgreSQL job tests",
)


POSTGRES_LOCKING_JOBS: tuple[
    Callable[[Session], int | tuple[int, int]], ...
] = (
    cleanup_expired_idempotency_records,
    expire_family_requests,
    send_access_confirmation_reminders,
    mark_overdue_first_payments,
    activate_regular_payments,
    mark_overdue_regular_payments,
    send_regular_payment_reminders,
    send_owner_payment_confirmation_reminders,
    send_closing_acknowledgement_reminders,
    execute_member_removals,
)


@pytest.mark.parametrize("job", POSTGRES_LOCKING_JOBS, ids=lambda job: job.__name__)
def test_postgres_job_locking_queries_are_supported(
    job: Callable[[Session], int | tuple[int, int]],
) -> None:
    assert POSTGRES_TEST_DATABASE_URL is not None
    engine = create_engine(
        normalize_sqlalchemy_database_url(POSTGRES_TEST_DATABASE_URL)
    )
    try:
        with Session(engine) as db:
            result = job(db)
            assert isinstance(result, (int, tuple))
            db.rollback()
    finally:
        engine.dispose()
