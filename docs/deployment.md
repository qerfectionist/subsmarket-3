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
connectivity with a simple query and is used as the Render health check.

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

The endpoint is called by GitHub Actions every 5 minutes.

`notification_jobs` is an outbox. A second production cron sends pending
Telegram messages:

```text
python -m subsmarket.jobs.dispatch_notifications
```

It reads pending `notification_jobs`, calls Telegram Bot API through
`TELEGRAM_BOT_TOKEN`, and marks each row as `sent`, `pending` for retry, or
`failed`.

If `TELEGRAM_MINI_APP_URL` is configured, outgoing Telegram notifications include
an inline button that opens the Mini App.

Every dispatchable notification must contain a non-empty human-facing
`payload.message`. The dispatcher does not fall back to raw event names because
those names are internal implementation details. If a row is missing a message,
the dispatcher marks it as a permanent failure with
`NOTIFICATION_MESSAGE_MISSING`.

Notification retry rules:

- transient network errors, missing token in a misconfigured environment, and
  Telegram rate limits stay `pending`;
- `available_at` moves forward using exponential backoff;
- Telegram `400` and `403` errors are treated as permanent delivery failures;
- after `NOTIFICATION_MAX_ATTEMPTS`, the job becomes `failed`.

The same notification dispatcher is available as an internal API endpoint:

```text
POST /api/internal/jobs/dispatch-notifications
X-Internal-Job-Token: <INTERNAL_JOB_TOKEN>
```

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
TELEGRAM_BOT_TOKEN=...
TELEGRAM_MINI_APP_URL=https://<vercel-mini-app-domain>
TELEGRAM_WEBHOOK_URL=https://<backend-domain>/api/telegram/webhook
TELEGRAM_WEBHOOK_SECRET=...
TELEGRAM_WEBHOOK_DROP_PENDING_UPDATES=false
PAYMENT_REQUISITE_SECRET=...
INTERNAL_JOB_TOKEN=...
CORS_ALLOWED_ORIGINS=https://<vercel-mini-app-domain>
NOTIFICATION_MAX_ATTEMPTS=5
NOTIFICATION_RETRY_BASE_SECONDS=60
NOTIFICATION_RETRY_MAX_SECONDS=3600
ACCESS_REMINDER_COOLDOWN_SECONDS=600
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
