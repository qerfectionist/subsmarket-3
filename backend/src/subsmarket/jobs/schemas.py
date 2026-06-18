from __future__ import annotations

from pydantic import BaseModel


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
