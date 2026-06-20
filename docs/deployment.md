# Deployment decision

## Final choice for MVP

SubsMarket 3.0 uses a backend-first architecture:

```text
Telegram Mini App
  -> Vercel frontend
  -> FastAPI backend on Render
  -> Managed PostgreSQL
```

Render is the default production backend target. Supabase is the production
PostgreSQL provider for the current setup, but only through `DATABASE_URL`.

Current production endpoints:

```text
Mini App: https://subsmarket-3.vercel.app
Backend: https://subsmarket-api.onrender.com
Health: https://subsmarket-api.onrender.com/health
Readiness: https://subsmarket-api.onrender.com/ready
```

The current Render instance uses the Free plan. It can sleep after inactivity,
so the first request may be delayed. Upgrade to an always-on plan before a
traffic-sensitive public launch.

## What Vercel is used for

Vercel hosts only the Mini App frontend:

- static Vite build;
- HTTPS URL for Telegram Mini App;
- preview deployments;
- public assets.

Vercel must not own the product state machine. The frontend calls the FastAPI
backend through `VITE_API_BASE_URL`.

## What Render is used for

Render hosts the long-running backend:

- FastAPI API;
- Telegram webhook/bot endpoints;
- migrations through Alembic;
- catalog seed on deploy;
- production env validation before deploy.

This is intentionally different from SubsMarket 2.0, where a Vercel serverless
entrypoint existed while backend code also needed long-running background work.
For SubsMarket 3.0, deadline checks, notifications, and payment reminders run
through protected backend endpoints triggered by GitHub Actions.

## Telegram bot webhook

Production bot updates are received by the backend endpoint:

```text
POST /api/telegram/webhook
X-Telegram-Bot-Api-Secret-Token: <TELEGRAM_WEBHOOK_SECRET>
```

Telegram adds this header when `secret_token` is passed to `setWebhook`.
SubsMarket rejects webhook requests with a missing or wrong secret in
production.

The backend also applies an in-process rate limit to the Telegram webhook,
identity refresh, family creation, join request, invite lookup, and internal job
endpoints. This is a baseline abuse guard for the MVP deployment. For higher
traffic, keep it and add an edge layer such as Cloudflare/WAF in front of Render.
Authenticated identity, family creation, and join-request limits use the
Telegram user ID from `initData` so unrelated users behind one mobile carrier IP
do not consume the same bucket. Public endpoints fall back to the client IP.

For one backend instance, the limiter works in process memory. Before scaling
Render to two or more instances, provision a Redis-compatible service and set:

```text
RATE_LIMIT_REDIS_URL=rediss://<user>:<password>@<host>:<port>
```

With this variable set, all backend instances use one atomic Redis counter.
Redis keys contain a SHA-256 digest instead of a raw Telegram user ID or IP. If
Redis is temporarily unavailable, the backend stays online and falls back to a
per-process limiter until Redis recovers.

Configure webhook env values on the backend service:

```text
TELEGRAM_BOT_TOKEN=<bot token from BotFather>
TELEGRAM_MINI_APP_URL=https://<vercel-mini-app-domain>
TELEGRAM_WEBHOOK_URL=https://<backend-domain>/api/telegram/webhook
TELEGRAM_WEBHOOK_SECRET=<random A-Z a-z 0-9 _ - secret>
TELEGRAM_WEBHOOK_DROP_PENDING_UPDATES=false
```

After backend deploy, set the webhook from the backend environment:

```powershell
cd backend
python -m subsmarket.bot.set_webhook
```

The production webhook currently points to:

```text
https://subsmarket-api.onrender.com/api/telegram/webhook
```

The bot's Main Mini App URL in BotFather must also point to
`https://subsmarket-3.vercel.app`. This setting is separate from the webhook
and may override the default chat menu button configured through Bot API.

Current bot behavior is intentionally thin:

- `/start` in a private chat sends a short SubsMarket intro;
- the message includes an inline button that opens the Mini App when
  `TELEGRAM_MINI_APP_URL` is configured;
- group chat updates are ignored;
- product state remains inside the Mini App and FastAPI Family Engine.

## Health and readiness

The backend exposes two system endpoints:

```text
GET /health
GET /ready
```

`/health` is a lightweight process check. `/ready` also verifies database
connectivity and reports the active rate-limit backend without exposing its
URL: `local`, `redis`, or `fallback`. Render uses `/ready` as its health check;
Redis fallback does not restart an otherwise working API, but production smoke
reports it as a deployment problem.

Due jobs process state-changing records in bounded batches. The defaults allow
up to five batches of 200 records per step. Notification dispatch sends up to
five batches of 100 jobs per cron call. These values can be tuned with:

```text
JOB_BATCH_SIZE=200
JOB_MAX_BATCHES_PER_STEP=5
NOTIFICATION_DISPATCH_BATCH_SIZE=100
NOTIFICATION_DISPATCH_MAX_BATCHES=5
```

## Production config check

Before production deploy, the backend validates required environment variables
without printing secrets:

```powershell
cd backend
python -m subsmarket.ops.check_deploy_config
```

The Render blueprint uses `preDeployCommand` on plans that support it. The
current Free service runs the config check, Alembic migrations, and catalog
seed at the end of its build command because Pre-Deploy Command is unavailable
on Free. It fails fast when critical production values are missing, still using
development defaults, or using non-HTTPS Telegram URLs.

Runtime startup also fails outside development when `CORS_ALLOWED_ORIGINS`
contains `*` or `TELEGRAM_WEBHOOK_SECRET` is missing.

Payment phone requisites are encrypted before storage. New requisites use a
versioned PBKDF2-derived Fernet key. Legacy SHA-256-derived Fernet tokens remain
readable so existing data does not require a forced migration.

## Error monitoring

Sentry is optional but recommended before a public launch. The backend only
enables it when `SENTRY_DSN` is set, so local development and test deployments
can run without a Sentry account.

Render env values:

```text
SENTRY_DSN=https://<public-key>@<org>.ingest.sentry.io/<project-id>
SENTRY_TRACES_SAMPLE_RATE=0
SENTRY_SEND_DEFAULT_PII=false
SENTRY_RELEASE=<optional-release-name-or-commit>
```

With `SENTRY_DSN` configured, unhandled FastAPI and SQLAlchemy exceptions are
reported to Sentry with the current `APP_ENV` as the environment. Keep
`SENTRY_SEND_DEFAULT_PII=false`; SubsMarket should not send Telegram user
personal data or payment requisites into external error logs. Increase
`SENTRY_TRACES_SAMPLE_RATE` later only if performance tracing is needed.

## Due jobs and notifications

The first production cron runs:

```text
python -m subsmarket.jobs.run_due
```

It performs domain state changes only:

- pending family requests with `expires_at <= now()` become `expired`;
- first payments with `status = due` and `due_at <= now()` become `overdue`;
- regular payments are created when the family payment date enters the reminder window;
- scheduled regular payments become `due` on the payment date;
- regular payments become `overdue` 24 hours after the payment date;
- regular payment reminders are inserted for 3-day, due-day, and overdue states;
- access confirmation and family-closing acknowledgements are reminded without
  automatic membership removal;
- owner payment confirmations are reminded after 10, 20, 40 minutes and daily;
- due member removals and family closures are completed;
- notification rows are inserted into `notification_jobs`.

The same logic is available as an internal API endpoint:

```text
POST /api/internal/jobs/run-due
X-Internal-Job-Token: <INTERNAL_JOB_TOKEN>
```

The endpoint is called by GitHub Actions every 5 minutes. Each due-job step is
committed separately. If one step fails, the backend rolls back only that step,
continues the remaining steps, logs the exception, and returns the failed step
inside `job_errors`.

Due-job logs include step names, aggregate counts, and error metadata. They do
not include payment requisites or Telegram message text.

Each due-job query processes at most `JOB_BATCH_SIZE` rows, oldest first. The
default is 200. This keeps locks and transactions bounded when many requests or
payments become due together. The next scheduled run continues the backlog;
`skip_locked` also allows multiple workers to avoid selecting the same rows.

`notification_jobs` is an outbox. A second production cron sends pending
Telegram messages:

```text
python -m subsmarket.jobs.dispatch_notifications
```

It reads pending `notification_jobs`, calls Telegram Bot API through
`TELEGRAM_BOT_TOKEN`, and marks each row as `sent`, `pending` for retry, or
`failed`.
One dispatcher run can process multiple batches of due notifications and commits
after each batch, so a backlog can drain faster without keeping one very large
transaction open.

If `TELEGRAM_MINI_APP_URL` is configured, outgoing Telegram notifications include
an inline button that opens the Mini App.

Every notification job must contain a non-empty human-facing `payload.message`.
The application normalizes that text when a job is created. The dispatcher does
not fall back to raw event names because those names are internal implementation
details. If an old or manually inserted row is missing a message, the dispatcher
marks it as a permanent failure with `NOTIFICATION_MESSAGE_MISSING`.

Notification retry rules:

- transient network errors, missing token in a misconfigured environment, and
  Telegram rate limits stay `pending`;
- `available_at` moves forward using exponential backoff;
- Telegram `400` and `403` errors are treated as permanent delivery failures;
- after `NOTIFICATION_MAX_ATTEMPTS`, the job becomes `failed`.

Notification dispatcher logs include selected/sent/retried/failed counts,
notification job ids, event types, attempts, and error classes. They do not log
Telegram bot tokens or outgoing message text.

The same notification dispatcher is available as an internal API endpoint:

```text
POST /api/internal/jobs/dispatch-notifications
X-Internal-Job-Token: <INTERNAL_JOB_TOKEN>
```

After the due-job and notification-dispatch calls, the protected status endpoint
can be used to inspect background health without exposing personal data:

```text
GET /api/internal/jobs/status
X-Internal-Job-Token: <INTERNAL_JOB_TOKEN>
```

It reports notification queue counts, stale due notifications, failed
notifications from the last 24 hours, due Family Engine backlog counts, and up
to 10 recent notification failure samples. It does not include payment
requisites, Telegram message text, or user profiles.

GitHub Actions workflow:

```text
.github/workflows/subsmarket-jobs.yml
```

Required GitHub repository secrets:

```text
SUBSMARKET_API_BASE_URL=https://<backend-domain>
INTERNAL_JOB_TOKEN=<same value as Render INTERNAL_JOB_TOKEN>
```

Local smoke commands:

```powershell
cd backend
.\.venv\Scripts\python -m subsmarket.jobs.run_due
.\.venv\Scripts\python -m subsmarket.jobs.dispatch_notifications
```

The first command is safe to run repeatedly because it checks existing request,
payment, and notification rows before creating new work. The second command will
try to call Telegram Bot API for pending messages, so production needs
`TELEGRAM_BOT_TOKEN`.

## Role of Supabase

Supabase is allowed only as infrastructure:

- managed PostgreSQL;
- backups;
- SQL dashboard;
- future storage for receipts if needed.

Current production project:

```text
Project name: subsmarket-3
Project ref: oulwqlysozrdhlhheflk
Region: eu-central-1
Alembic version: 20260619_0011
Catalog: 26 subscription services, 5 tariff services
```

Supabase is not the application backend for MVP:

- no direct `supabase-js` access from Mini App;
- no Supabase Auth for Telegram users;
- no exposed public tables;
- no RLS as the main business-logic layer;
- no Edge Functions replacing the FastAPI domain layer.

The application logic stays in FastAPI.

Use Supabase's **Session pooler** connection string for Render. Render is an
IPv4 environment, and Supabase direct database endpoints are IPv6 unless the
paid IPv4 add-on is enabled. The expected value is the SQLAlchemy/Postgres URL
from Supabase Dashboard -> Connect -> Session pooler.

The backend keeps its own SQLAlchemy pool small because every Render process can
hold database connections. Default production values are:

```text
DB_POOL_SIZE=5
DB_MAX_OVERFLOW=5
DB_POOL_TIMEOUT_SECONDS=30
DB_POOL_RECYCLE_SECONDS=1800
DB_CONNECT_TIMEOUT_SECONDS=10
```

That means one backend process can use at most 10 database connections. Keep the
per-process total low and scale it only after checking Supabase connection
charts or `pg_stat_activity`. The production config check rejects
`DB_POOL_SIZE + DB_MAX_OVERFLOW > 20` to prevent accidental connection
exhaustion while the project is small.

Supabase's 2026 default-privileges change for new `public` tables does not
change the MVP app path because the Mini App never talks to Supabase Data API
directly. Keep it that way unless a future feature explicitly needs public Data
API access, and then add grants and RLS together.

## Why this fits future accounts and GB sales

Future account and mobile-data sales use a separate `Marketplace Engine` in the
same backend and database.

Do not create a universal entity that mixes family subscriptions and listings.

Keep the module boundaries:

- `Identity` - Telegram user, mandatory username, profile safety;
- `Catalog` - service catalogs for each engine;
- `Families` - family subscriptions and family tariffs;
- `Marketplace` - account listings and mobile-data listings;
- `Notifications` - Telegram notifications for all engines;
- `Audit` - critical history, first for Families, later for Marketplace.

This lets SubsMarket add account and GB sales without rewriting hosting or
splitting into microservices too early.

## Production environment variables

Backend:

```text
APP_ENV=production
DATABASE_URL=postgresql://...
DB_POOL_SIZE=5
DB_MAX_OVERFLOW=5
DB_POOL_TIMEOUT_SECONDS=30
DB_POOL_RECYCLE_SECONDS=1800
DB_CONNECT_TIMEOUT_SECONDS=10
TELEGRAM_BOT_TOKEN=...
TELEGRAM_MINI_APP_URL=https://<vercel-mini-app-domain>
TELEGRAM_WEBHOOK_URL=https://<backend-domain>/api/telegram/webhook
TELEGRAM_WEBHOOK_SECRET=...
TELEGRAM_WEBHOOK_DROP_PENDING_UPDATES=false
PAYMENT_REQUISITE_SECRET=...
INTERNAL_JOB_TOKEN=...
RATE_LIMIT_REDIS_URL=rediss://...
SENTRY_DSN=
SENTRY_TRACES_SAMPLE_RATE=0
SENTRY_SEND_DEFAULT_PII=false
SENTRY_RELEASE=
CORS_ALLOWED_ORIGINS=https://<vercel-mini-app-domain>
NOTIFICATION_MAX_ATTEMPTS=5
NOTIFICATION_RETRY_BASE_SECONDS=60
NOTIFICATION_RETRY_MAX_SECONDS=3600
ACCESS_REMINDER_COOLDOWN_SECONDS=600
JOB_BATCH_SIZE=200
DEMO_ACTIVATE_CATALOG=true
```

Do not use Supabase anon or service-role keys in the Mini App. They are not
needed for this architecture.

After deployment, run the credential-free production smoke check:

```powershell
$env:PRODUCTION_API_URL='https://<backend-domain>'
cd backend
.\.venv\Scripts\python -m subsmarket.ops.production_smoke
```

It verifies health, database readiness, required OpenAPI routes, and that the
development reset endpoint is not exposed.

For a read-only parallel load smoke:

```powershell
$env:LOAD_SMOKE_BASE_URL='https://subsmarket-api.onrender.com'
$env:LOAD_SMOKE_REQUESTS='100'
$env:LOAD_SMOKE_CONCURRENCY='10'
$env:LOAD_SMOKE_WARMUP_REQUESTS='5'
cd backend
.\.venv\Scripts\python -m subsmarket.ops.load_smoke
```

It calls only `/health`, `/ready`, and the public catalog, then reports error
rate, requests per second, status counts, per-path summaries, and p50/p95/p99
latency. It fails if any request fails or p95 exceeds 2000ms. On Render Free,
use warmup requests before the measured run; otherwise the cold start dominates
the result. Increase load gradually and do not run aggressive tests against the
shared Free environment.

For a write-heavy lifecycle smoke, use only a local disposable PostgreSQL
database. The command creates temporary owners, candidates, families, requests,
and memberships; validates the final counts; and deletes all generated data in
a `finally` cleanup block:

```powershell
$env:WRITE_LOAD_DATABASE_URL='postgresql+psycopg://subsmarket:subsmarket@localhost:5432/subsmarket'
$env:WRITE_LOAD_FAMILIES='250'
$env:WRITE_LOAD_CONCURRENCY='25'
cd backend
.\.venv\Scripts\python -m subsmarket.ops.write_load_smoke
```

For a launch-burst rehearsal on a local machine, raise `WRITE_LOAD_FAMILIES` up
to `2500` and increase concurrency gradually, for example `50`, while watching
PostgreSQL CPU, memory, and active connections. This scenario exercises family
creation, join requests, approvals, and cleanup; it is not safe for production
or shared staging data.

Remote databases are rejected by default. Do not set
`WRITE_LOAD_ALLOW_REMOTE=true` for production or shared staging databases.

To test authenticated read-only endpoints, pass a real Telegram WebApp initData
header from a test user:

```powershell
$env:LOAD_SMOKE_TELEGRAM_INIT_DATA='<telegram-init-data>'
$env:LOAD_SMOKE_PATHS='/api/families?limit=20,/api/families/me?limit=20'
```

After setting the Telegram webhook and Main Mini App URL, run the read-only
Telegram production smoke check:

```powershell
$env:TELEGRAM_WEBHOOK_URL='https://subsmarket-api.onrender.com/api/telegram/webhook'
$env:TELEGRAM_MINI_APP_URL='https://subsmarket-3.vercel.app'
cd backend
.\.venv\Scripts\python -m subsmarket.ops.telegram_production_smoke
```

It verifies bot identity, webhook URL and delivery state, accepted update
types, the default menu button URL, and Mini App availability. It never prints
the bot token.

The backend accepts both `postgresql://...` and `postgresql+psycopg://...`.

Frontend:

```text
VITE_API_BASE_URL=https://subsmarket-api.onrender.com
```

## Scaling path

For up to roughly 10k registered users:

- one FastAPI web service;
- one managed PostgreSQL database;
- one cron job for deadlines/reminders;
- one cron job for Telegram notification dispatch;
- no Redis queue until notification volume requires it.

When load grows:

1. Move reminders/Telegram sends into a separate worker.
2. Add Redis or a managed queue.
3. Add database indexes based on real slow queries.
4. Consider moving backend to VPS/Kubernetes only after managed hosting cost or
   limits become a real problem.
