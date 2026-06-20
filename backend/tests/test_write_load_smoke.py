from __future__ import annotations

import pytest

from subsmarket.ops.write_load_smoke import (
    MAX_WRITE_LOAD_FAMILIES,
    OperationResult,
    summarize_phase,
    validate_database_target,
)


def test_write_load_allows_local_postgres_and_normalizes_driver() -> None:
    result = validate_database_target(
        "postgresql://user:secret@localhost:5432/test",
        allow_remote=False,
    )

    assert result.startswith("postgresql+psycopg://")


def test_write_load_blocks_remote_database_by_default() -> None:
    with pytest.raises(ValueError, match="Remote write load is blocked"):
        validate_database_target(
            "postgresql://user:secret@db.example.com/test",
            allow_remote=False,
        )


def test_write_load_rejects_non_postgres_database() -> None:
    with pytest.raises(ValueError, match="must use PostgreSQL"):
        validate_database_target("sqlite:///test.db", allow_remote=False)


def test_write_load_phase_summary_reports_latency_and_errors() -> None:
    summary = summarize_phase(
        [
            OperationResult(resource_id=None, elapsed_ms=10, error="failed"),
            OperationResult(resource_id=None, elapsed_ms=20),
            OperationResult(resource_id=None, elapsed_ms=30),
            OperationResult(resource_id=None, elapsed_ms=40),
        ],
        duration_seconds=2,
    )

    assert summary.operations == 4
    assert summary.errors == 1
    assert summary.operations_per_second == 2
    assert summary.latency_ms_p50 == 20
    assert summary.latency_ms_p95 == 40


def test_write_load_default_ceiling_matches_launch_burst_target() -> None:
    assert MAX_WRITE_LOAD_FAMILIES == 2500
