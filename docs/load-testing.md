# Load Testing

## What the local smoke test proves

`backend/src/subsmarket/ops/write_load_smoke.py` uses a temporary local
PostgreSQL dataset and runs the core Family Engine write path in parallel:

1. create a family;
2. send one join request;
3. approve the request.

Every run checks that the expected number of families is full, requests are
approved, and members are in `awaiting_access`. It cleans up its temporary
users, families, notifications, and catalog service afterwards.

The command refuses remote databases unless explicitly overridden. It must not
be pointed at Supabase production.

## Latest local result

Date: 2026-06-26

Environment: Docker Desktop, local PostgreSQL 16, 50 concurrent workers.

| Phase | Operations | Errors | Throughput | p95 latency |
| --- | ---: | ---: | ---: | ---: |
| Create families | 2,500 | 0 | 12.3 ops/s | 4.83 s |
| Create requests | 2,500 | 0 | 63.9 ops/s | 0.90 s |
| Approve requests | 2,500 | 0 | 82.6 ops/s | 0.70 s |

Validation result: all 2,500 families became full, all 2,500 requests became
approved, and all 2,500 participants reached `awaiting_access`.

## Interpretation

This proves the current database transactions preserve the Family Engine state
under a 2,500-family local burst. It does not predict the exact speed of a
Render Pro and Supabase Pro deployment: the test bypasses HTTP, Telegram auth,
network latency, and the production connection pool.

The next production-readiness step is a separate HTTP load test against a
disposable staging deployment on the paid infrastructure. It should keep the
same correctness checks and use a bounded connection pool rather than opening
thousands of database connections at once.

## HTTP smoke test

`backend/src/subsmarket/ops/http_load_smoke.py` runs the same family flow
through FastAPI, the development auth adapter, rate limiting, and PostgreSQL.
It only accepts localhost by default and deletes all run-specific users and
families afterwards.

Latest local result: 50 families at 10 concurrent HTTP workers completed with
zero errors. Create p95 was 1.17 seconds; request p95 was 0.29 seconds;
approval p95 was 0.25 seconds; final state validation p95 was 0.15 seconds.

During implementation, the test found and fixed a connection-pool starvation
case: the auth session was keeping its connection while the business session
needed another one. The auth connection is now released before the business
operation begins. Development rate limits also now identify development users
by their development Telegram ID, while production continues to trust only
signed Telegram init data.

## Re-run locally

```powershell
docker compose up -d
cd backend
.\.venv\Scripts\python.exe -m alembic -c alembic.ini upgrade head
$env:WRITE_LOAD_FAMILIES='2500'
$env:WRITE_LOAD_CONCURRENCY='50'
.\.venv\Scripts\python.exe -m subsmarket.ops.write_load_smoke
```

For the HTTP smoke test, start a local development backend first and run:

```powershell
$env:HTTP_LOAD_BASE_URL='http://127.0.0.1:8002'
$env:HTTP_LOAD_FAMILIES='50'
$env:HTTP_LOAD_CONCURRENCY='10'
cd backend
.\.venv\Scripts\python.exe -m subsmarket.ops.http_load_smoke
```
