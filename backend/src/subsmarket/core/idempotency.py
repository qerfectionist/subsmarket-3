from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from datetime import timedelta
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from subsmarket.core.config import settings
from subsmarket.core.database import utcnow
from subsmarket.core.models import IdempotencyRecord

IDEMPOTENCY_KEY_RE = re.compile(r"^[A-Za-z0-9._:-]{8,128}$")


@dataclass(frozen=True)
class IdempotencyClaim:
    record: IdempotencyRecord | None
    resource_id: UUID | None = None

    @property
    def is_replay(self) -> bool:
        return self.resource_id is not None


def claim_idempotency(
    db: Session,
    *,
    user_id: UUID,
    operation: str,
    idempotency_key: str | None,
    payload: Any,
    resource_type: str,
) -> IdempotencyClaim:
    if idempotency_key is None:
        return IdempotencyClaim(record=None)
    if not IDEMPOTENCY_KEY_RE.fullmatch(idempotency_key):
        raise HTTPException(status_code=400, detail="INVALID_IDEMPOTENCY_KEY")

    request_hash = _request_hash(payload)
    existing = _get_record(
        db,
        user_id=user_id,
        operation=operation,
        idempotency_key=idempotency_key,
    )
    if existing is not None:
        return _validate_existing(existing, request_hash, resource_type)

    record = IdempotencyRecord(
        user_id=user_id,
        operation=operation,
        idempotency_key=idempotency_key,
        request_hash=request_hash,
    )
    db.add(record)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        existing = _get_record(
            db,
            user_id=user_id,
            operation=operation,
            idempotency_key=idempotency_key,
        )
        if existing is None:
            raise
        return _validate_existing(existing, request_hash, resource_type)
    return IdempotencyClaim(record=record)


def complete_idempotency(
    claim: IdempotencyClaim,
    *,
    resource_type: str,
    resource_id: UUID,
) -> None:
    if claim.record is None:
        return
    claim.record.resource_type = resource_type
    claim.record.resource_id = resource_id


def cleanup_expired_idempotency_records(db: Session) -> int:
    cutoff = utcnow() - timedelta(days=settings.idempotency_retention_days)
    record_ids = list(
        db.scalars(
            select(IdempotencyRecord.id)
            .where(IdempotencyRecord.created_at < cutoff)
            .order_by(IdempotencyRecord.created_at.asc())
            .limit(settings.job_batch_size)
            .with_for_update(skip_locked=True)
        )
    )
    if not record_ids:
        return 0
    db.execute(
        delete(IdempotencyRecord).where(IdempotencyRecord.id.in_(record_ids)),
        execution_options={"synchronize_session": False},
    )
    db.flush()
    return len(record_ids)


def _get_record(
    db: Session,
    *,
    user_id: UUID,
    operation: str,
    idempotency_key: str,
) -> IdempotencyRecord | None:
    return db.scalar(
        select(IdempotencyRecord)
        .where(IdempotencyRecord.user_id == user_id)
        .where(IdempotencyRecord.operation == operation)
        .where(IdempotencyRecord.idempotency_key == idempotency_key)
    )


def _validate_existing(
    record: IdempotencyRecord,
    request_hash: str,
    resource_type: str,
) -> IdempotencyClaim:
    if record.request_hash != request_hash:
        raise HTTPException(status_code=409, detail="IDEMPOTENCY_KEY_REUSED")
    if record.resource_type != resource_type or record.resource_id is None:
        raise HTTPException(status_code=409, detail="IDEMPOTENCY_REQUEST_IN_PROGRESS")
    return IdempotencyClaim(record=record, resource_id=record.resource_id)


def _request_hash(payload: Any) -> str:
    serialized = json.dumps(
        payload,
        ensure_ascii=True,
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()
