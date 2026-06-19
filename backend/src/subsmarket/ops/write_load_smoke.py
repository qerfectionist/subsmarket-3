from __future__ import annotations

import json
import math
import os
import time
import uuid
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass
from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import create_engine, delete, func, select
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker

from subsmarket.catalog.models import FamilyService
from subsmarket.core.config import normalize_sqlalchemy_database_url
from subsmarket.families.models import Family, FamilyMember, FamilyRequest
from subsmarket.families.schemas import FamilyCreate
from subsmarket.families.service import (
    approve_join_request,
    create_family,
    create_join_request,
)
from subsmarket.identity.models import User
from subsmarket.notifications.models import NotificationJob

LOCAL_DATABASE_HOSTS = {"localhost", "127.0.0.1", "::1"}


@dataclass(frozen=True)
class PhaseSummary:
    operations: int
    errors: int
    duration_seconds: float
    operations_per_second: float
    latency_ms_p50: float
    latency_ms_p95: float
    latency_ms_max: float


@dataclass(frozen=True)
class OperationResult:
    resource_id: UUID | None
    elapsed_ms: float
    error: str | None = None


def validate_database_target(database_url: str, *, allow_remote: bool) -> str:
    normalized = normalize_sqlalchemy_database_url(database_url)
    parsed = make_url(normalized)
    if parsed.get_backend_name() != "postgresql":
        raise ValueError("WRITE_LOAD_DATABASE_URL must use PostgreSQL")
    if not allow_remote and parsed.host not in LOCAL_DATABASE_HOSTS:
        raise ValueError(
            "Remote write load is blocked; use a local PostgreSQL database"
        )
    return normalized


def summarize_phase(
    results: list[OperationResult],
    *,
    duration_seconds: float,
) -> PhaseSummary:
    if not results:
        raise ValueError("At least one operation result is required")
    latencies = sorted(result.elapsed_ms for result in results)
    operations = len(results)
    return PhaseSummary(
        operations=operations,
        errors=sum(result.error is not None for result in results),
        duration_seconds=duration_seconds,
        operations_per_second=operations / max(duration_seconds, 0.001),
        latency_ms_p50=_percentile(latencies, 0.50),
        latency_ms_p95=_percentile(latencies, 0.95),
        latency_ms_max=latencies[-1],
    )


def _percentile(sorted_values: list[float], percentile: float) -> float:
    index = max(0, math.ceil(len(sorted_values) * percentile) - 1)
    return sorted_values[index]


def _run_phase(
    items: list[tuple[UUID, UUID]],
    *,
    concurrency: int,
    operation: Callable[[UUID, UUID], UUID],
) -> tuple[list[OperationResult], PhaseSummary]:
    def run(item: tuple[UUID, UUID]) -> OperationResult:
        started = time.perf_counter()
        try:
            resource_id = operation(*item)
            error = None
        except Exception as exc:  # pragma: no cover - reported in command output
            resource_id = None
            error = f"{type(exc).__name__}: {exc}"
        return OperationResult(
            resource_id=resource_id,
            elapsed_ms=(time.perf_counter() - started) * 1000,
            error=error,
        )

    started = time.perf_counter()
    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        results = list(executor.map(run, items))
    duration = time.perf_counter() - started
    return results, summarize_phase(results, duration_seconds=duration)


def run_write_load(
    database_url: str,
    *,
    family_count: int,
    concurrency: int,
    allow_remote: bool = False,
) -> dict[str, object]:
    if not 1 <= family_count <= 1000:
        raise ValueError("family_count must be between 1 and 1000")
    if not 1 <= concurrency <= 100:
        raise ValueError("concurrency must be between 1 and 100")

    safe_url = validate_database_target(database_url, allow_remote=allow_remote)
    engine = create_engine(
        safe_url,
        pool_size=concurrency,
        max_overflow=0,
        pool_pre_ping=True,
    )
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    run_id = uuid.uuid4().hex[:12]
    service_id: UUID | None = None
    user_ids: list[UUID] = []
    summaries: dict[str, PhaseSummary] = {}
    errors: dict[str, list[str]] = {}

    try:
        with session_factory() as db:
            service = FamilyService(
                slug=f"write-load-{run_id}",
                name="Write Load Smoke",
                variant=run_id,
                family_type="subscription",
                category="load-test",
                subcategory=None,
                max_members=2,
                supported_periods=["monthly"],
                status="active",
                service_metadata={"temporary": True, "run_id": run_id},
            )
            base_telegram_id = 8_000_000_000 + int(run_id[:8], 16) * 3000
            owners = [
                User(
                    telegram_user_id=base_telegram_id + index,
                    username=f"load_owner_{run_id}_{index}",
                    first_name="Load Owner",
                )
                for index in range(family_count)
            ]
            candidates = [
                User(
                    telegram_user_id=base_telegram_id + family_count + index,
                    username=f"load_member_{run_id}_{index}",
                    first_name="Load Member",
                )
                for index in range(family_count)
            ]
            db.add(service)
            db.add_all([*owners, *candidates])
            db.commit()
            service_id = service.id
            owner_ids = [owner.id for owner in owners]
            candidate_ids = [candidate.id for candidate in candidates]
            user_ids = [*owner_ids, *candidate_ids]

        def create_family_operation(owner_id: UUID, _: UUID) -> UUID:
            with session_factory() as db:
                owner = db.get(User, owner_id)
                if owner is None or service_id is None:
                    raise RuntimeError("Load owner or service disappeared")
                family = create_family(
                    db,
                    owner,
                    FamilyCreate(
                        service_id=service_id,
                        period="monthly",
                        max_members=2,
                        total_price_kzt=2000,
                        payment_day=15,
                        next_payment_date=date.today() + timedelta(days=30),
                        description="Temporary write load family",
                        payment_bank="kaspi",
                        payment_phone="+77001234567",
                    ),
                    idempotency_key=f"load-family-{run_id}-{owner_id}",
                )
                return family.id

        create_items = list(zip(owner_ids, candidate_ids, strict=True))
        create_results, summaries["create_families"] = _run_phase(
            create_items,
            concurrency=concurrency,
            operation=create_family_operation,
        )
        _collect_errors(errors, "create_families", create_results)
        family_ids = _require_resource_ids("create_families", create_results)

        def create_request_operation(candidate_id: UUID, family_id: UUID) -> UUID:
            with session_factory() as db:
                candidate = db.get(User, candidate_id)
                if candidate is None:
                    raise RuntimeError("Load candidate disappeared")
                request = create_join_request(
                    db,
                    candidate,
                    family_id,
                    idempotency_key=f"load-request-{run_id}-{candidate_id}",
                )
                return request.id

        request_items = list(zip(candidate_ids, family_ids, strict=True))
        request_results, summaries["create_requests"] = _run_phase(
            request_items,
            concurrency=concurrency,
            operation=create_request_operation,
        )
        _collect_errors(errors, "create_requests", request_results)
        request_ids = _require_resource_ids("create_requests", request_results)

        def approve_request_operation(owner_id: UUID, request_id: UUID) -> UUID:
            with session_factory() as db:
                owner = db.get(User, owner_id)
                if owner is None:
                    raise RuntimeError("Load owner disappeared")
                request = approve_join_request(db, owner, request_id)
                return request.id

        approve_items = list(zip(owner_ids, request_ids, strict=True))
        approve_results, summaries["approve_requests"] = _run_phase(
            approve_items,
            concurrency=concurrency,
            operation=approve_request_operation,
        )
        _collect_errors(errors, "approve_requests", approve_results)
        _require_resource_ids("approve_requests", approve_results)

        with session_factory() as db:
            full_families = db.scalar(
                select(func.count(Family.id)).where(
                    Family.service_id == service_id,
                    Family.status == "full",
                    Family.active_members_count == 2,
                )
            )
            approved_requests = db.scalar(
                select(func.count(FamilyRequest.id))
                .join(Family, Family.id == FamilyRequest.family_id)
                .where(
                    Family.service_id == service_id,
                    FamilyRequest.status == "approved",
                )
            )
            joined_members = db.scalar(
                select(func.count(FamilyMember.id))
                .join(Family, Family.id == FamilyMember.family_id)
                .where(
                    Family.service_id == service_id,
                    FamilyMember.role == "member",
                    FamilyMember.status == "awaiting_access",
                )
            )
        expected = family_count
        validation = {
            "full_families": int(full_families or 0),
            "approved_requests": int(approved_requests or 0),
            "joined_members": int(joined_members or 0),
            "expected_each": expected,
        }
        ok = not errors and all(
            validation[key] == expected
            for key in ("full_families", "approved_requests", "joined_members")
        )
        return {
            "ok": ok,
            "run_id": run_id,
            "family_count": family_count,
            "concurrency": concurrency,
            "phases": {name: asdict(summary) for name, summary in summaries.items()},
            "validation": validation,
            "errors": errors,
        }
    finally:
        _cleanup(session_factory, service_id=service_id, user_ids=user_ids)
        engine.dispose()


def _collect_errors(
    target: dict[str, list[str]],
    phase: str,
    results: list[OperationResult],
) -> None:
    phase_errors = [result.error for result in results if result.error is not None]
    if phase_errors:
        target[phase] = phase_errors[:20]


def _require_resource_ids(
    phase: str,
    results: list[OperationResult],
) -> list[UUID]:
    if any(result.resource_id is None for result in results):
        raise RuntimeError(f"{phase} failed; see phase errors")
    return [result.resource_id for result in results if result.resource_id is not None]


def _cleanup(
    session_factory: sessionmaker[Session],
    *,
    service_id: UUID | None,
    user_ids: list[UUID],
) -> None:
    if service_id is None and not user_ids:
        return
    with session_factory() as db:
        if user_ids:
            db.execute(
                delete(NotificationJob).where(
                    NotificationJob.recipient_user_id.in_(user_ids)
                )
            )
        if service_id is not None:
            db.execute(delete(Family).where(Family.service_id == service_id))
        if user_ids:
            db.execute(delete(User).where(User.id.in_(user_ids)))
        if service_id is not None:
            db.execute(delete(FamilyService).where(FamilyService.id == service_id))
        db.commit()


def _positive_int(name: str, default: int) -> int:
    value = int(os.getenv(name, str(default)))
    if value <= 0:
        raise SystemExit(f"{name} must be positive")
    return value


def main() -> None:
    database_url = os.getenv(
        "WRITE_LOAD_DATABASE_URL",
        "postgresql+psycopg://subsmarket:subsmarket@localhost:5432/subsmarket",
    )
    family_count = _positive_int("WRITE_LOAD_FAMILIES", 100)
    concurrency = _positive_int("WRITE_LOAD_CONCURRENCY", 20)
    allow_remote = os.getenv("WRITE_LOAD_ALLOW_REMOTE") == "true"
    try:
        payload = run_write_load(
            database_url,
            family_count=family_count,
            concurrency=concurrency,
            allow_remote=allow_remote,
        )
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    if not payload["ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
