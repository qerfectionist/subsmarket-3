from __future__ import annotations

from pydantic import BaseModel


class DispatchNotificationsResult(BaseModel):
    selected: int
    sent: int
    retried: int
    failed: int
