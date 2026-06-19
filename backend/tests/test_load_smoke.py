from __future__ import annotations

import pytest

from subsmarket.ops.load_smoke import (
    RequestResult,
    summarize_results,
    summarize_results_by_path,
    validate_summary,
)


def test_load_summary_calculates_percentiles_and_throughput() -> None:
    results = [
        RequestResult(path="/health", status=200, elapsed_ms=float(value))
        for value in range(1, 101)
    ]

    summary = summarize_results(
        results,
        concurrency=10,
        duration_seconds=2,
    )

    assert summary.requests == 100
    assert summary.errors == 0
    assert summary.error_rate == 0
    assert summary.requests_per_second == 50
    assert summary.latency_ms_p50 == 50
    assert summary.latency_ms_p95 == 95
    assert summary.latency_ms_p99 == 99


def test_load_summary_reports_errors_and_threshold_failures() -> None:
    results = [
        RequestResult(path="/ready", status=200, elapsed_ms=100),
        RequestResult(
            path="/ready",
            status=503,
            elapsed_ms=2500,
            error="HTTP_503",
        ),
    ]

    summary = summarize_results(
        results,
        concurrency=2,
        duration_seconds=1,
    )

    assert validate_summary(
        summary,
        max_error_rate=0,
        max_p95_ms=2000,
    ) == [
        "error rate 50.00% exceeds 0.00%",
        "p95 latency 2500.0ms exceeds 2000.0ms",
    ]


def test_load_summary_groups_metrics_by_path() -> None:
    results = [
        RequestResult(path="/health", status=200, elapsed_ms=10),
        RequestResult(path="/health", status=200, elapsed_ms=20),
        RequestResult(path="/ready", status=200, elapsed_ms=100),
    ]

    summaries = summarize_results_by_path(
        results,
        concurrency=10,
        duration_seconds=1,
    )

    assert summaries["/health"].requests == 2
    assert summaries["/health"].concurrency == 2
    assert summaries["/health"].latency_ms_p95 == 20
    assert summaries["/ready"].requests == 1


def test_load_summary_requires_results() -> None:
    with pytest.raises(ValueError, match="At least one"):
        summarize_results([], concurrency=1, duration_seconds=1)
