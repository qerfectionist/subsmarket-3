from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass

from sqlalchemy.orm import Session

from subsmarket.core.config import settings
from subsmarket.core.idempotency import cleanup_expired_idempotency_records
from subsmarket.jobs.common import (
    CLOSING_ACK_MEMBER_STATUSES,
    OPEN_PAYMENT_STATUSES,
    REGULAR_PAYMENT_MEMBER_STATUSES,
    _job_scan_limit,
)
from subsmarket.jobs.family_lifecycle_jobs import (
    _enqueue_member_notification_once,
    close_due_families,
    expire_family_requests,
    send_access_confirmation_reminders,
    send_closing_acknowledgement_reminders,
)
from subsmarket.jobs.payment_lifecycle_jobs import (
    _regular_payment_exists,
    activate_regular_payments,
    create_regular_payments,
    mark_overdue_first_payments,
    mark_overdue_regular_payments,
)
from subsmarket.jobs.payment_reminders_jobs import (
    _enqueue_payment_notification_once,
    _payment_notification_exists,
    send_owner_payment_confirmation_reminders,
    send_regular_payment_reminders,
)
from subsmarket.jobs.schemas import RunDueJobError, RunDueJobsResult
from subsmarket.marketplace.jobs import (
    expire_marketplace_listings,
    send_marketplace_listing_expiry_reminders,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class DueJobStep:
    name: str
    run: Callable[[Session], int | tuple[int, int]]
    apply: Callable[[RunDueJobsResult, int | tuple[int, int]], None]
    drain_batches: bool = False


def run_due_jobs(db: Session) -> RunDueJobsResult:
    logger.info("Due job run started")
    result = RunDueJobsResult(
        expired_family_requests=0,
        access_confirmation_reminders_sent=0,
        overdue_first_payments=0,
        created_regular_payments=0,
        activated_regular_payments=0,
        overdue_regular_payments=0,
        regular_payment_reminders_sent=0,
        owner_payment_confirmation_reminders_sent=0,
        closing_acknowledgement_reminders_sent=0,
        closed_families=0,
        marketplace_listing_expiry_reminders_sent=0,
        expired_marketplace_listings=0,
        idempotency_records_deleted=0,
        notification_jobs_created=0,
    )
    for step in _due_job_steps():
        _run_due_job_step(db, result, step)
    logger.info(
        "Due job run completed",
        extra={
            "expired_family_requests": result.expired_family_requests,
            "overdue_first_payments": result.overdue_first_payments,
            "created_regular_payments": result.created_regular_payments,
            "notification_jobs_created": result.notification_jobs_created,
            "job_errors": len(result.job_errors),
        },
    )
    return result


def _run_due_job_step(
    db: Session,
    result: RunDueJobsResult,
    step: DueJobStep,
) -> None:
    max_batches = settings.job_max_batches_per_step if step.drain_batches else 1
    for batch_number in range(1, max_batches + 1):
        try:
            step_result = step.run(db)
            db.commit()
        except Exception as exc:
            db.rollback()
            logger.exception(
                "Due job step failed",
                extra={"job_step": step.name, "job_batch": batch_number},
            )
            result.job_errors.append(
                RunDueJobError(
                    step=step.name,
                    error_type=type(exc).__name__,
                    message=str(exc),
                )
            )
            return
        step.apply(result, step_result)
        processed_count = _step_processed_count(step_result)
        logger.info(
            "Due job step batch completed",
            extra={
                "job_step": step.name,
                "job_batch": batch_number,
                "job_step_result": str(step_result),
            },
        )
        if not step.drain_batches or processed_count < settings.job_batch_size:
            break


def _step_processed_count(step_result: int | tuple[int, int]) -> int:
    return step_result if isinstance(step_result, int) else step_result[0]


def _due_job_steps() -> tuple[DueJobStep, ...]:
    return (
        DueJobStep(
            name="expire_family_requests",
            run=expire_family_requests,
            apply=lambda result, step_result: _apply_count_and_notifications(
                result,
                step_result,
                count_field="expired_family_requests",
            ),
            drain_batches=True,
        ),
        DueJobStep(
            name="send_access_confirmation_reminders",
            run=send_access_confirmation_reminders,
            apply=lambda result, step_result: _apply_notification_count(
                result,
                step_result,
                count_field="access_confirmation_reminders_sent",
            ),
        ),
        DueJobStep(
            name="mark_overdue_first_payments",
            run=mark_overdue_first_payments,
            apply=lambda result, step_result: _apply_count_and_notifications(
                result,
                step_result,
                count_field="overdue_first_payments",
            ),
            drain_batches=True,
        ),
        DueJobStep(
            name="create_regular_payments",
            run=create_regular_payments,
            apply=lambda result, step_result: _apply_count(
                result,
                step_result,
                count_field="created_regular_payments",
            ),
        ),
        DueJobStep(
            name="activate_regular_payments",
            run=activate_regular_payments,
            apply=lambda result, step_result: _apply_count_and_notifications(
                result,
                step_result,
                count_field="activated_regular_payments",
            ),
            drain_batches=True,
        ),
        DueJobStep(
            name="mark_overdue_regular_payments",
            run=mark_overdue_regular_payments,
            apply=lambda result, step_result: _apply_count_and_notifications(
                result,
                step_result,
                count_field="overdue_regular_payments",
            ),
            drain_batches=True,
        ),
        DueJobStep(
            name="send_regular_payment_reminders",
            run=send_regular_payment_reminders,
            apply=lambda result, step_result: _apply_notification_count(
                result,
                step_result,
                count_field="regular_payment_reminders_sent",
            ),
        ),
        DueJobStep(
            name="send_owner_payment_confirmation_reminders",
            run=send_owner_payment_confirmation_reminders,
            apply=lambda result, step_result: _apply_notification_count(
                result,
                step_result,
                count_field="owner_payment_confirmation_reminders_sent",
            ),
        ),
        DueJobStep(
            name="send_closing_acknowledgement_reminders",
            run=send_closing_acknowledgement_reminders,
            apply=lambda result, step_result: _apply_notification_count(
                result,
                step_result,
                count_field="closing_acknowledgement_reminders_sent",
            ),
        ),
        DueJobStep(
            name="close_due_families",
            run=close_due_families,
            apply=lambda result, step_result: _apply_count_and_notifications(
                result,
                step_result,
                count_field="closed_families",
            ),
            drain_batches=True,
        ),
        DueJobStep(
            name="send_marketplace_listing_expiry_reminders",
            run=send_marketplace_listing_expiry_reminders,
            apply=lambda result, step_result: _apply_notification_count(
                result,
                step_result,
                count_field="marketplace_listing_expiry_reminders_sent",
            ),
            drain_batches=True,
        ),
        DueJobStep(
            name="expire_marketplace_listings",
            run=expire_marketplace_listings,
            apply=lambda result, step_result: _apply_count_and_notifications(
                result,
                step_result,
                count_field="expired_marketplace_listings",
            ),
            drain_batches=True,
        ),
        DueJobStep(
            name="cleanup_expired_idempotency_records",
            run=cleanup_expired_idempotency_records,
            apply=lambda result, step_result: _apply_count(
                result,
                step_result,
                count_field="idempotency_records_deleted",
            ),
            drain_batches=True,
        ),
    )


def _apply_count(
    result: RunDueJobsResult,
    step_result: int | tuple[int, int],
    *,
    count_field: str,
) -> None:
    if not isinstance(step_result, int):
        raise TypeError(f"{count_field} expected integer result")
    setattr(result, count_field, getattr(result, count_field) + step_result)


def _apply_notification_count(
    result: RunDueJobsResult,
    step_result: int | tuple[int, int],
    *,
    count_field: str,
) -> None:
    if not isinstance(step_result, int):
        raise TypeError(f"{count_field} expected integer result")
    setattr(result, count_field, getattr(result, count_field) + step_result)
    result.notification_jobs_created += step_result


def _apply_count_and_notifications(
    result: RunDueJobsResult,
    step_result: int | tuple[int, int],
    *,
    count_field: str,
) -> None:
    if not isinstance(step_result, tuple):
        raise TypeError(f"{count_field} expected count and notifications")
    count, notifications = step_result
    setattr(result, count_field, getattr(result, count_field) + count)
    result.notification_jobs_created += notifications


__all__ = [
    "CLOSING_ACK_MEMBER_STATUSES",
    "DueJobStep",
    "OPEN_PAYMENT_STATUSES",
    "REGULAR_PAYMENT_MEMBER_STATUSES",
    "_apply_count",
    "_apply_count_and_notifications",
    "_apply_notification_count",
    "_due_job_steps",
    "_enqueue_member_notification_once",
    "_enqueue_payment_notification_once",
    "_job_scan_limit",
    "_payment_notification_exists",
    "_regular_payment_exists",
    "_run_due_job_step",
    "_step_processed_count",
    "activate_regular_payments",
    "close_due_families",
    "create_regular_payments",
    "expire_family_requests",
    "mark_overdue_first_payments",
    "mark_overdue_regular_payments",
    "run_due_jobs",
    "send_access_confirmation_reminders",
    "send_closing_acknowledgement_reminders",
    "send_owner_payment_confirmation_reminders",
    "send_regular_payment_reminders",
]
