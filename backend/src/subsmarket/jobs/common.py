from __future__ import annotations

from subsmarket.core.config import settings

REGULAR_PAYMENT_MEMBER_STATUSES = {"active"}
OPEN_PAYMENT_STATUSES = {"due", "overdue", "payment_reported"}
CLOSING_ACK_MEMBER_STATUSES = {
    "awaiting_access",
    "awaiting_confirmation",
    "payment_due",
    "active",
}


def _job_scan_limit() -> int:
    return settings.job_batch_size * settings.job_max_batches_per_step
