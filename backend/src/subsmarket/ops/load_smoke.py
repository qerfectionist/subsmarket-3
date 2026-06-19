from __future__ import annotations

import json
import math
import os
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

DEFAULT_PATHS = (
    "/health",
    "/ready",
    "/api/catalog/family-services?status=active",
)


@dataclass(frozen=True)
class RequestResult:
    path: str
    status: int | None
    elapsed_ms: float
    error: str | None = None


@dataclass(frozen=True)
class LoadSummary:
    requests: int
    concurrency: int
    errors: int
    error_rate: float
    duration_seconds: float
    requests_per_second: float
    latency_ms_min: float
    latency_ms_mean: float
    latency_ms_p50: float
    latency_ms_p95: float
    latency_ms_p99: float
    latency_ms_max: float


def run_request(base_url: str, path: str, timeout_seconds: float) -> RequestResult:
    return run_request_with_headers(
        base_url,
        path,
        timeout_seconds,
        headers={},
    )


def run_request_with_headers(
    base_url: str,
    path: str,
    timeout_seconds: float,
    *,
    headers: dict[str, str],
) -> RequestResult:
    started = time.perf_counter()
    try:
        request = Request(f"{base_url.rstrip('/')}{path}", headers=headers)
        with urlopen(
            request,
            timeout=timeout_seconds,
        ) as response:
            response.read()
            status = response.status
            error = None if status == 200 else f"HTTP_{status}"
    except HTTPError as exc:
        status = exc.code
        error = f"HTTP_{exc.code}"
    except (TimeoutError, URLError, OSError) as exc:
        status = None
        error = type(exc).__name__
    elapsed_ms = (time.perf_counter() - started) * 1000
    return RequestResult(
        path=path,
        status=status,
        elapsed_ms=elapsed_ms,
        error=error,
    )


def summarize_results(
    results: list[RequestResult],
    *,
    concurrency: int,
    duration_seconds: float,
) -> LoadSummary:
    if not results:
        raise ValueError("At least one request result is required")
    latencies = sorted(result.elapsed_ms for result in results)
    errors = sum(result.error is not None for result in results)
    request_count = len(results)
    return LoadSummary(
        requests=request_count,
        concurrency=concurrency,
        errors=errors,
        error_rate=errors / request_count,
        duration_seconds=duration_seconds,
        requests_per_second=request_count / max(duration_seconds, 0.001),
        latency_ms_min=latencies[0],
        latency_ms_mean=sum(latencies) / request_count,
        latency_ms_p50=_percentile(latencies, 0.50),
        latency_ms_p95=_percentile(latencies, 0.95),
        latency_ms_p99=_percentile(latencies, 0.99),
        latency_ms_max=latencies[-1],
    )


def validate_summary(
    summary: LoadSummary,
    *,
    max_error_rate: float,
    max_p95_ms: float,
) -> list[str]:
    problems: list[str] = []
    if summary.error_rate > max_error_rate:
        problems.append(
            f"error rate {summary.error_rate:.2%} exceeds {max_error_rate:.2%}"
        )
    if summary.latency_ms_p95 > max_p95_ms:
        problems.append(
            f"p95 latency {summary.latency_ms_p95:.1f}ms exceeds {max_p95_ms:.1f}ms"
        )
    return problems


def summarize_results_by_path(
    results: list[RequestResult],
    *,
    concurrency: int,
    duration_seconds: float,
) -> dict[str, LoadSummary]:
    grouped: dict[str, list[RequestResult]] = {}
    for result in results:
        grouped.setdefault(result.path, []).append(result)
    return {
        path: summarize_results(
            path_results,
            concurrency=min(concurrency, len(path_results)),
            duration_seconds=duration_seconds,
        )
        for path, path_results in sorted(grouped.items())
    }


def _percentile(sorted_values: list[float], percentile: float) -> float:
    index = max(0, math.ceil(len(sorted_values) * percentile) - 1)
    return sorted_values[index]


def _positive_int(name: str, default: int) -> int:
    value = int(os.getenv(name, str(default)))
    if value <= 0:
        raise SystemExit(f"{name} must be positive")
    return value


def _positive_float(name: str, default: float) -> float:
    value = float(os.getenv(name, str(default)))
    if value <= 0:
        raise SystemExit(f"{name} must be positive")
    return value


def main() -> None:
    base_url = os.getenv("LOAD_SMOKE_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
    requests = _positive_int("LOAD_SMOKE_REQUESTS", 100)
    concurrency = _positive_int("LOAD_SMOKE_CONCURRENCY", 10)
    warmup_requests = int(os.getenv("LOAD_SMOKE_WARMUP_REQUESTS", "0"))
    timeout_seconds = _positive_float("LOAD_SMOKE_TIMEOUT_SECONDS", 15)
    max_error_rate = float(os.getenv("LOAD_SMOKE_MAX_ERROR_RATE", "0"))
    max_p95_ms = _positive_float("LOAD_SMOKE_MAX_P95_MS", 2000)
    paths = tuple(
        path.strip()
        for path in os.getenv("LOAD_SMOKE_PATHS", ",".join(DEFAULT_PATHS)).split(",")
        if path.strip()
    )
    if not paths:
        raise SystemExit("LOAD_SMOKE_PATHS must contain at least one path")
    if not 0 <= max_error_rate <= 1:
        raise SystemExit("LOAD_SMOKE_MAX_ERROR_RATE must be between 0 and 1")
    if warmup_requests < 0:
        raise SystemExit("LOAD_SMOKE_WARMUP_REQUESTS must be non-negative")

    headers: dict[str, str] = {}
    init_data = os.getenv("LOAD_SMOKE_TELEGRAM_INIT_DATA", "").strip()
    if init_data:
        headers["X-Telegram-Init-Data"] = init_data

    for index in range(warmup_requests):
        run_request_with_headers(
            base_url,
            paths[index % len(paths)],
            timeout_seconds,
            headers=headers,
        )

    started = time.perf_counter()
    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [
            executor.submit(
                run_request_with_headers,
                base_url,
                paths[index % len(paths)],
                timeout_seconds,
                headers=headers,
            )
            for index in range(requests)
        ]
        results = [future.result() for future in futures]
    duration_seconds = time.perf_counter() - started

    summary = summarize_results(
        results,
        concurrency=concurrency,
        duration_seconds=duration_seconds,
    )
    problems = validate_summary(
        summary,
        max_error_rate=max_error_rate,
        max_p95_ms=max_p95_ms,
    )
    errors_by_type: dict[str, int] = {}
    status_counts: dict[str, int] = {}
    for result in results:
        status_counts[str(result.status or "network_error")] = (
            status_counts.get(str(result.status or "network_error"), 0) + 1
        )
        if result.error:
            errors_by_type[result.error] = errors_by_type.get(result.error, 0) + 1
    summaries_by_path = summarize_results_by_path(
        results,
        concurrency=concurrency,
        duration_seconds=duration_seconds,
    )

    payload = {
        "ok": not problems,
        "base_url": base_url,
        "paths": list(paths),
        "summary": asdict(summary),
        "summaries_by_path": {
            path: asdict(path_summary)
            for path, path_summary in summaries_by_path.items()
        },
        "status_counts": status_counts,
        "errors_by_type": errors_by_type,
        "problems": problems,
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    if problems:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
