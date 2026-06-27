from __future__ import annotations

import json
import os
from typing import Any
from urllib.error import HTTPError
from urllib.request import Request, urlopen


def build_jobs_health_request(base_url: str, token: str) -> Request:
    return Request(
        f"{base_url.rstrip('/')}/api/internal/jobs/health",
        headers={
            "Accept": "application/json",
            "User-Agent": "SubsMarket jobs health smoke",
            "X-Internal-Job-Token": token,
        },
    )


def fetch_jobs_health(base_url: str, token: str) -> tuple[int, dict[str, Any]]:
    request = build_jobs_health_request(base_url, token)
    try:
        with urlopen(request, timeout=15) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        body = exc.read().decode("utf-8")
        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            payload = {"detail": body}
        return exc.code, payload


def validate_jobs_health(status_code: int, payload: dict[str, Any]) -> list[str]:
    problems: list[str] = []
    if status_code != 200:
        problems.append(f"jobs health returned HTTP {status_code}")
    if payload.get("status") != "ok":
        problems.append("background jobs status is not ok")
    warnings = payload.get("warnings")
    if warnings:
        problems.append(f"background jobs warnings: {warnings}")
    return problems


def main() -> None:
    base_url = os.getenv("PRODUCTION_API_URL", "").rstrip("/")
    token = os.getenv("PRODUCTION_INTERNAL_JOB_TOKEN") or os.getenv(
        "INTERNAL_JOB_TOKEN"
    )
    allow_http = os.getenv("PRODUCTION_SMOKE_ALLOW_HTTP") == "true"
    if not base_url:
        raise SystemExit("PRODUCTION_API_URL is required")
    if not token:
        raise SystemExit(
            "PRODUCTION_INTERNAL_JOB_TOKEN or INTERNAL_JOB_TOKEN is required"
        )
    if not allow_http and not base_url.startswith("https://"):
        raise SystemExit("PRODUCTION_API_URL must use HTTPS")

    status_code, health = fetch_jobs_health(base_url, token)
    problems = validate_jobs_health(status_code, health)
    payload = {
        "ok": not problems,
        "base_url": base_url,
        "status_code": status_code,
        "jobs_status": health.get("status"),
        "warnings": health.get("warnings", []),
        "notification_queue": health.get("notification_queue"),
        "due_backlog": health.get("due_backlog"),
        "problems": problems,
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    if problems:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
