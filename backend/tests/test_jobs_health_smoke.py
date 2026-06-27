from __future__ import annotations

from subsmarket.ops.jobs_health_smoke import (
    build_jobs_health_request,
    validate_jobs_health,
)


def test_jobs_health_smoke_builds_protected_request() -> None:
    request = build_jobs_health_request("https://api.example.com/", "job-secret")

    assert request.full_url == "https://api.example.com/api/internal/jobs/health"
    assert request.get_header("X-internal-job-token") == "job-secret"


def test_jobs_health_smoke_accepts_ok_status() -> None:
    problems = validate_jobs_health(
        200,
        {
            "status": "ok",
            "warnings": [],
        },
    )

    assert problems == []


def test_jobs_health_smoke_reports_attention_status() -> None:
    problems = validate_jobs_health(
        503,
        {
            "status": "attention",
            "warnings": ["notification_failures_last_24h"],
        },
    )

    assert problems == [
        "jobs health returned HTTP 503",
        "background jobs status is not ok",
        "background jobs warnings: ['notification_failures_last_24h']",
    ]
