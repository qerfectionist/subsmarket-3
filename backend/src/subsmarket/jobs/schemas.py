from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class RunDueJobError(BaseModel):
    step: str
    error_type: str
    message: str


class RunDueJobsResult(BaseModel):
    expired_family_requests: int
    access_confirmation_reminders_sent: int
    overdue_first_payments: int
    created_regular_payments: int
    activated_regular_payments: int
    overdue_regular_payments: int
    regular_payment_reminders_sent: int
    owner_payment_confirmation_reminders_sent: int
    closing_acknowledgement_reminders_sent: int
    executed_member_removals: int
    closed_families: int
    notification_jobs_created: int
    job_errors: list[RunDueJobError] = Field(default_factory=list)


class NotificationQueueStatus(BaseModel):
    pending_total: int
    pending_due: int
    pending_future: int
    sent_total: int
    failed_total: int
    cancelled_total: int
    stale_due: int
    failed_last_24h: int
    oldest_due_at: datetime | None = None
    oldest_pending_at: datetime | None = None
    dispatch_capacity_per_run: int


class NotificationFailureSample(BaseModel):
    id: str
    event_type: str
    attempts: int
    failed_at: datetime | None = None
    error: str | None = None


class DueBacklogStatus(BaseModel):
    expired_family_requests: int
    access_confirmations_overdue: int
    first_payments_overdue: int
    regular_payment_creation_due: int
    regular_payments_to_activate: int
    regular_payments_overdue: int
    owner_payment_confirmations_waiting: int
    closing_acknowledgements_due: int
    member_removals_due: int
    family_closures_due: int
    per_step_capacity: int


class JobsStatusResult(BaseModel):
    status: str
    checked_at: datetime
    warnings: list[str] = Field(default_factory=list)
    notification_queue: NotificationQueueStatus
    due_backlog: DueBacklogStatus
    recent_notification_failures: list[NotificationFailureSample] = Field(
        default_factory=list
    )
