# Monitoring, security, and load testing

This document describes the external services prepared for SubsMarket and the
small amount of account setup that cannot be completed from the repository.

## Already implemented

### Agent and tool safety

SubsMarket should not install broad third-party AI-agent bundles directly into
the repository or the global Codex/Claude configuration during release work.
This includes hooks, MCP configs, global `AGENTS.md` replacements, and hidden
auto-run scripts.

Rules:

- run dry-run first for any external installer;
- prefer project-local docs and checklists over global AI-agent config changes;
- do not commit generated secrets, `.env` files, Render/Vercel/Supabase tokens,
  Redis URLs, Telegram bot tokens, or Sentry auth tokens;
- revoke temporary platform API tokens after use;
- do not add external hooks that can run shell commands automatically without a
  separate security review.

The current ECC analysis is documented in
[ecc-adoption-plan.md](ecc-adoption-plan.md).

### Gitleaks

Workflow: `.github/workflows/security.yml`.

It scans the full Git history:

- on every push to `main`;
- on pull requests;
- once per day;
- on manual dispatch.

The repository belongs to a personal GitHub account, so Gitleaks Action does
not require a license key. Third-party actions are pinned to immutable commit
SHAs.

### Independent scheduler and heartbeat

Workflow: `.github/workflows/subsmarket-jobs.yml`.

After due jobs, Telegram dispatch, `/api/internal/jobs/status`, and the strict
`/api/internal/jobs/health` check all succeed, the workflow calls the URL stored
in the GitHub secret:

```text
JOBS_HEARTBEAT_URL
```

If any earlier step fails, or if background jobs report `attention`, no
heartbeat is sent and the monitor eventually alerts. The URL is optional locally
and must never be committed.

The GitHub workflow is only a fallback. Repository history has shown multi-hour
gaps between scheduled runs, so it must not be the only production scheduler.
The production implementation is in
`ops/cloudflare-jobs-scheduler`. Before public launch deploy it as a Cloudflare
Worker Cron Trigger with this order every 5 minutes:

1. `POST /api/internal/jobs/run-due`;
2. `POST /api/internal/jobs/dispatch-notifications`;
3. `GET /api/internal/jobs/health`;
4. require `run-due.job_errors` and dispatch failures to both equal zero;
5. send the success heartbeat only when all checks pass.

All protected calls require the `X-Internal-Job-Token` header. The scheduler
must use the same secret as Render and must never put it in a query string.

Recommended production monitor settings:

- expected period: 5 minutes;
- grace period: 10 minutes;
- alert when no successful heartbeat is received for 15 minutes;
- alert channel: Telegram and email.

The Worker also supports an authenticated `simulate_failure=true` manual run.
The scheduler is not accepted as production-ready until this path produces a
real Telegram/email alert. Setup and verification commands are documented in
`ops/cloudflare-jobs-scheduler/README.md`.

The repository secret `JOBS_HEARTBEAT_URL` is mandatory before launch. If it is
absent, the fallback workflow logs that fact but cannot alert on a silent
scheduler failure.

Official scheduler references:

- [QStash schedules](https://upstash.com/docs/qstash/features/schedules)
- [Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)

### GitHub uptime check

Workflow: `.github/workflows/uptime-check.yml`.

This is a no-secret fallback monitor. It runs every 10 minutes and checks:

- `https://api.subsmarket.xyz/health`;
- `https://api.subsmarket.xyz/ready`.

It fails if the API is down or database readiness is not `ok`. It prints the
current rate-limit backend (`local`, `redis`, or `fallback`) for visibility but
does not fail on `local`, because the current test deployment uses one backend
instance.

GitHub scheduled workflows can be delayed, so this workflow is useful as a
basic safety net. It should not replace a real external uptime monitor with
Telegram/email alerts.

Create a separate uptime monitor for:

```text
https://api.subsmarket.xyz/health
```

Recommended interval: 3 minutes. Add `/ready` as a second monitor after Render
is upgraded to an always-on plan.

### Grafana k6

Script: `tools/k6/subsmarket-api.js`.

Manual workflow: `.github/workflows/load-test.yml`.

The default run checks:

- `/health`;
- `/ready`;
- active family-service catalog;
- authenticated family search when
  `LOAD_TEST_TELEGRAM_INIT_DATA` is configured.

Default thresholds:

- error rate below 1%;
- p95 response time below 2 seconds;
- successful checks above 99%.

The workflow is manual so an accidental push cannot create production load.
Without Grafana Cloud it runs entirely on the GitHub runner. Cloud execution
requires:

```text
K6_CLOUD_TOKEN
K6_CLOUD_PROJECT_ID
```

Start with 10 virtual users for 30 seconds. Increase gradually only after
Render and Supabase paid plans are active.

### Sentry

The FastAPI integration is already present and disabled when `SENTRY_DSN` is
empty. It keeps `send_default_pii=false` and does not intentionally send
Telegram profile data or payment requisites.

After adding the DSN to Render, verify delivery with:

```powershell
npm run sentry:smoke
```

The command sends one controlled informational event and prints only its event
ID, not the DSN.

### Production check command

Use this before and after larger deploys:

```powershell
npm run production:check
```

It performs:

- API smoke: `/health`, `/ready`, required OpenAPI routes, and no exposed
  development reset route;
- small read-only load smoke against `https://api.subsmarket.xyz`;
- Telegram smoke: bot, webhook, menu button, and Mini App availability;
- Sentry smoke: one controlled informational event.

Default load settings are intentionally small (`30` requests, concurrency `5`,
p95 threshold `5000ms`) so the command is safe for the current test deployment
with free Redis. For paid staging or production rehearsals, increase gradually
and tighten the latency threshold with:

```powershell
$env:LOAD_SMOKE_REQUESTS='100'
$env:LOAD_SMOKE_CONCURRENCY='10'
$env:LOAD_SMOKE_MAX_P95_MS='3000'
npm run production:check
```

The command is still read-only by default. Do not run write-heavy load tests
against production data.

## External account values still required

### Sentry

Create a Python/FastAPI project and provide its public DSN. Required Render
values:

```text
SENTRY_DSN=<project DSN>
SENTRY_TRACES_SAMPLE_RATE=0
SENTRY_SEND_DEFAULT_PII=false
```

No Sentry auth token is required for the backend integration.

### Better Stack

Create one heartbeat monitor and provide its unique ping URL. It will be stored
as the GitHub Actions secret `JOBS_HEARTBEAT_URL`.

This account step is not optional for production. A successful API uptime check
does not prove that reminders, expirations, and payment-state jobs are running.

Create one uptime monitor for:

```text
https://api.subsmarket.xyz/health
```

Recommended interval: 3 minutes while on the test deployment. Add a second
monitor for `/ready` after the backend is on an always-on plan, because `/ready`
checks database connectivity and can be noisier during cold starts.

Optional repository variable:

```text
SUBSMARKET_API_BASE_URL=https://api.subsmarket.xyz
```

If the variable is not set, the GitHub uptime workflow uses the production API
domain above.

### Grafana Cloud

Cloud execution is optional. Create a k6 project only before production load
testing and provide:

- project ID;
- access token limited to k6 test execution.

These values will be stored in GitHub Actions secrets and must not be committed
or added to frontend environment variables.

## Scaling note

`/ready` reports rate limit backend as `local`, `redis`, or `fallback`.
`local` is acceptable for a single test instance. Before multiple Render
instances or a public launch burst, configure `RATE_LIMIT_REDIS_URL` with a
shared Redis-compatible service such as Upstash. Without this, each backend
instance would count limits separately.

## Backend hot-path monitoring

During the first public traffic burst, watch these backend signals more closely
than frontend UI polish:

- `/ready` must continue reporting `database=ok` and `rate_limit=redis`;
- `/api/internal/jobs/health` must stay `ok`;
- Sentry should not show new errors from family creation, join requests,
  payments, reminders, or notification dispatch;
- Render logs should not show connection-pool exhaustion or repeated database
  timeouts;
- GitHub background jobs should keep sending the heartbeat after successful
  due-job and notification runs.
