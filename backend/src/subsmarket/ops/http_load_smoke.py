"""Exercise the Family Engine through a local FastAPI development server.

This smoke test intentionally accepts only localhost targets. It uses the
development Telegram headers, verifies create -> request -> approve over HTTP,
and removes all rows created for its run directly from the local test database.
"""

from __future__ import annotations

import json
import os
import time
import uuid
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass
from datetime import timedelta
from urllib.parse import urlparse
from uuid import UUID

import httpx
from sqlalchemy import create_engine, delete, select
from sqlalchemy.orm import Session, sessionmaker

from subsmarket.core.database import kz_today
from subsmarket.families.models import Family
from subsmarket.identity.models import User
from subsmarket.notifications.models import NotificationJob
from subsmarket.ops.write_load_smoke import (
    MAX_WRITE_LOAD_FAMILIES,
    OperationResult,
    summarize_phase,
    validate_database_target,
)

LOCAL_HTTP_HOSTS = {"localhost", "127.0.0.1", "::1"}


@dataclass(frozen=True)
class HttpLoadItem:
    owner_telegram_id: int
    candidate_telegram_id: int
    family_id: UUID | None = None
    request_id: UUID | None = None


def validate_http_target(base_url: str, *, allow_remote: bool) -> str:
    parsed = urlparse(base_url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("HTTP_LOAD_BASE_URL must be an absolute HTTP URL")
    if not allow_remote and parsed.hostname not in LOCAL_HTTP_HOSTS:
        raise ValueError("Remote HTTP load is blocked; use a local development server")
    return base_url.rstrip("/")


def run_http_load(
    base_url: str,
    database_url: str,
    *,
    family_count: int,
    concurrency: int,
    allow_remote: bool = False,
) -> dict[str, object]:
    if not 1 <= family_count <= MAX_WRITE_LOAD_FAMILIES:
        raise ValueError(
            f"family_count must be between 1 and {MAX_WRITE_LOAD_FAMILIES}"
        )
    if not 1 <= concurrency <= 100:
        raise ValueError("concurrency must be between 1 and 100")

    safe_base_url = validate_http_target(base_url, allow_remote=allow_remote)
    safe_database_url = validate_database_target(
        database_url, allow_remote=allow_remote
    )
    engine = create_engine(
        safe_database_url,
        pool_size=min(concurrency, 20),
        max_overflow=0,
        pool_pre_ping=True,
    )
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    run_id = uuid.uuid4().hex[:12]
    base_telegram_id = 6_000_000_000 + int(run_id[:8], 16) * (family_count * 2 + 100)
    items = [
        HttpLoadItem(
            owner_telegram_id=base_telegram_id + index,
            candidate_telegram_id=base_telegram_id + family_count + index,
        )
        for index in range(family_count)
    ]
    created_telegram_ids = [
        item.owner_telegram_id for item in items
    ] + [item.candidate_telegram_id for item in items]
    summaries: dict[str, object] = {}
    errors: dict[str, list[str]] = {}

    limits = httpx.Limits(
        max_connections=concurrency,
        max_keepalive_connections=concurrency,
    )
    with httpx.Client(base_url=safe_base_url, timeout=30, limits=limits) as client:
        try:
            client.post("/api/catalog/import-family-services").raise_for_status()
            services = client.get(
                "/api/catalog/family-services",
                params={"family_type": "subscription"},
            )
            services.raise_for_status()
            service = next(
                (
                    item
                    for item in services.json()
                    if item["status"] == "active" and item["max_members"] >= 2
                ),
                None,
            )
            if service is None:
                raise RuntimeError("No active subscription service is available")

            def create(item: HttpLoadItem) -> UUID:
                response = client.post(
                    "/api/families",
                    headers={
                        **_dev_headers(item.owner_telegram_id, run_id, "owner"),
                        "Idempotency-Key": (
                            f"http-load-family-{run_id}-{item.owner_telegram_id}"
                        ),
                    },
                    json={
                        "service_id": service["id"],
                        "period": "monthly",
                        "max_members": 2,
                        "total_price_kzt": 2000,
                        "payment_day": 15,
                        "next_payment_date": (
                            kz_today() + timedelta(days=30)
                        ).isoformat(),
                        "payment_bank": "kaspi",
                        "payment_phone": "+77001234567",
                    },
                )
                return UUID(_response_json(response)["family"]["id"])

            created, summaries["create_families"] = _run_phase(
                items, concurrency, create
            )
            _collect_errors(errors, "create_families", created)
            items = [
                HttpLoadItem(
                    owner_telegram_id=item.owner_telegram_id,
                    candidate_telegram_id=item.candidate_telegram_id,
                    family_id=result.resource_id,
                )
                for item, result in zip(items, created, strict=True)
                if result.resource_id is not None
            ]
            _require_complete_phase("create_families", items, family_count, errors)

            def request(item: HttpLoadItem) -> UUID:
                assert item.family_id is not None
                response = client.post(
                    f"/api/families/{item.family_id}/requests",
                    headers={
                        **_dev_headers(item.candidate_telegram_id, run_id, "member"),
                        "Idempotency-Key": (
                            f"http-load-request-{run_id}-{item.candidate_telegram_id}"
                        ),
                    },
                )
                return UUID(_response_json(response)["id"])

            requested, summaries["create_requests"] = _run_phase(
                items, concurrency, request
            )
            _collect_errors(errors, "create_requests", requested)
            items = [
                HttpLoadItem(
                    owner_telegram_id=item.owner_telegram_id,
                    candidate_telegram_id=item.candidate_telegram_id,
                    family_id=item.family_id,
                    request_id=result.resource_id,
                )
                for item, result in zip(items, requested, strict=True)
                if result.resource_id is not None
            ]
            _require_complete_phase("create_requests", items, family_count, errors)

            def approve(item: HttpLoadItem) -> UUID:
                assert item.request_id is not None
                response = client.post(
                    f"/api/families/requests/{item.request_id}/approve",
                    headers=_dev_headers(item.owner_telegram_id, run_id, "owner"),
                )
                return UUID(_response_json(response)["id"])

            approved, summaries["approve_requests"] = _run_phase(
                items, concurrency, approve
            )
            _collect_errors(errors, "approve_requests", approved)
            _require_complete_phase("approve_requests", items, family_count, errors)

            def validate(item: HttpLoadItem) -> UUID:
                assert item.family_id is not None
                response = client.get(
                    f"/api/families/{item.family_id}/view",
                    headers=_dev_headers(item.owner_telegram_id, run_id, "owner"),
                )
                family = _response_json(response)["family"]
                if family["status"] != "full" or family["active_members_count"] != 2:
                    raise RuntimeError("Family state is not full after approval")
                return item.family_id

            validated, summaries["validate_families"] = _run_phase(
                items, concurrency, validate
            )
            _collect_errors(errors, "validate_families", validated)
            _require_complete_phase("validate_families", items, family_count, errors)
            return {
                "ok": not errors,
                "run_id": run_id,
                "family_count": family_count,
                "concurrency": concurrency,
                "phases": {
                    name: asdict(summary) for name, summary in summaries.items()
                },
                "errors": errors,
            }
        finally:
            _cleanup(session_factory, created_telegram_ids)
            engine.dispose()


def _dev_headers(telegram_id: int, run_id: str, role: str) -> dict[str, str]:
    return {
        "X-Dev-Telegram-User-Id": str(telegram_id),
        "X-Dev-Telegram-Username": f"http_load_{role}_{run_id}_{telegram_id}",
        "X-Dev-Telegram-First-Name": "HTTP Load",
    }


def _response_json(response: httpx.Response) -> dict[str, object]:
    if response.is_error:
        raise RuntimeError(f"HTTP {response.status_code}: {response.text[:300]}")
    return response.json()


def _run_phase(
    items: list[HttpLoadItem],
    concurrency: int,
    operation: Callable[[HttpLoadItem], UUID],
) -> tuple[list[OperationResult], object]:
    def run(item: HttpLoadItem) -> OperationResult:
        started = time.perf_counter()
        try:
            resource_id = operation(item)
            error = None
        except Exception as exc:  # pragma: no cover - reported by the command
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
    return results, summarize_phase(
        results, duration_seconds=time.perf_counter() - started
    )


def _collect_errors(
    target: dict[str, list[str]],
    phase: str,
    results: list[OperationResult],
) -> None:
    phase_errors = [result.error for result in results if result.error is not None]
    if phase_errors:
        target[phase] = phase_errors[:20]


def _require_complete_phase(
    phase: str,
    items: list[HttpLoadItem],
    expected: int,
    errors: dict[str, list[str]],
) -> None:
    if len(items) != expected:
        errors.setdefault(phase, []).append(
            f"Only {len(items)} of {expected} operations completed"
        )
        raise RuntimeError(f"{phase} failed: {errors[phase]}")


def _cleanup(session_factory: sessionmaker[Session], telegram_ids: list[int]) -> None:
    with session_factory() as db:
        users = list(
            db.scalars(
                select(User).where(User.telegram_user_id.in_(telegram_ids))
            ).all()
        )
        user_ids = [user.id for user in users]
        if user_ids:
            db.execute(
                delete(NotificationJob).where(
                    NotificationJob.recipient_user_id.in_(user_ids)
                )
            )
            db.execute(delete(Family).where(Family.owner_user_id.in_(user_ids)))
            db.execute(delete(User).where(User.id.in_(user_ids)))
        db.commit()


def _positive_int(name: str, default: int) -> int:
    value = int(os.getenv(name, str(default)))
    if value <= 0:
        raise SystemExit(f"{name} must be positive")
    return value


def main() -> None:
    base_url = os.getenv("HTTP_LOAD_BASE_URL", "http://127.0.0.1:8000")
    database_url = os.getenv(
        "HTTP_LOAD_DATABASE_URL",
        "postgresql+psycopg://subsmarket:subsmarket@localhost:5432/subsmarket",
    )
    family_count = _positive_int("HTTP_LOAD_FAMILIES", 100)
    concurrency = _positive_int("HTTP_LOAD_CONCURRENCY", 20)
    allow_remote = os.getenv("HTTP_LOAD_ALLOW_REMOTE") == "true"
    try:
        payload = run_http_load(
            base_url,
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
