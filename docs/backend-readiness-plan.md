# Backend Readiness Plan

Last updated: 2026-07-14.

The Family Engine backend covers subscriptions and family tariffs. The first
Marketplace vertical, mobile-data listings, is now implemented separately.
Account listings remain out of scope until the GB flow is stable.

## Current State

Backend checks completed:

- Family Engine service tests pass for jobs, requests, access, payments,
  removals, closing, prepayments, and reminders.
- Critical concurrency fixes are already present: family locks on access
  confirmation, last-slot approval protection, owner-family limit protection,
  and legacy removal locks.
- List APIs have bounded `limit` values and cursor page endpoints for high
  volume screens.
- Search cursor pagination handles both confirmed-availability families and
  unconfirmed families without dropping items between pages.
- Shared rate limiting is wired through Redis and checked by `/ready`.
- Production domains are live:
  - Mini App: `https://subsmarket.xyz`
  - API: `https://api.subsmarket.xyz`
- Read-only production check passes with `npm run production:check`.
- Mobile-data Marketplace has seven-day listings, bounded catalogs, request
  snapshots, idempotent mutations, rate limits, notifications, and expiry jobs.

## Hardening Pass: 2026-06-27

Changes completed after reviewing ECC practices:

- fixed search cursor pagination for families without
  `availability_confirmed_at`;
- fixed "my payments" cursor pagination so pages follow `due_at`, not only
  `created_at`;
- moved access-reminder and closing-reminder notification dedup checks from
  Python payload filtering to SQL JSON filters;
- changed daily owner-payment and family-closing reminder dedup dates to use
  Kazakhstan business date through `kz_today()`;
- sanitized Telegram HTTP errors so bot tokens are not stored in notification
  errors or printed by webhook setup failures;
- added regression tests for both cursor issues and Telegram token-safe error
  handling.

## Before Public Launch

### 1. Real Telegram Flow

Use real Telegram accounts, not only dev users:

1. owner opens the bot menu button;
2. owner creates a test family;
3. candidate opens the Mini App from Telegram;
4. candidate sends a request;
5. owner accepts;
6. owner marks access as provided;
7. candidate confirms access;
8. candidate marks payment as paid;
9. owner confirms payment;
10. owner removes the test member or closes the test family.

Pass condition: no backend error in Render logs and no unexpected Sentry error.

### 2. External Monitoring

Create monitors outside the app:

- uptime monitor: `https://api.subsmarket.xyz/health` (configured in
  UptimeRobot);
- GitHub fallback uptime workflow: `.github/workflows/uptime-check.yml`;
- heartbeat monitor for background jobs using GitHub secret
  `JOBS_HEARTBEAT_URL`;
- Sentry project alert for new backend errors.

Do this before inviting many users, because Render logs alone are too slow for
launch support.

### 3. Shared Rate Limiting

Current `/ready` reports `rate_limit=redis` after connecting Upstash Redis Free.

Production config check now requires shared Redis:

```text
RATE_LIMIT_REDIS_URL=rediss://...
```

Pass condition: `https://api.subsmarket.xyz/ready` reports `rate_limit=redis`.

### 4. Paid-Plan Load Rehearsal

After Render Pro and the paid database plan are active, run a staging rehearsal:

1. read-only smoke: `npm run production:check`;
2. local write smoke against disposable local Postgres;
3. HTTP write smoke against disposable staging data, not production data.

Start small, then increase:

```powershell
$env:LOAD_SMOKE_REQUESTS='100'
$env:LOAD_SMOKE_CONCURRENCY='10'
npm run production:check
```

Do not run write-heavy load tests against production user data.

### 5. Backend Hot Path Review

Before a public burst, re-check the paths most likely to fail under load:

- family creation by many owners at once;
- many candidates applying to the same almost-full family;
- approval, rejection, candidate cancel, and request expiration running close
  together;
- first payment creation after access confirmation;
- regular payment generation around the monthly/yearly payment date;
- notification deduplication for repeated reminders;
- invite-code lookup for full, hidden, closing, and closed families;
- paginated search, my families, requests, payments, members, and audit logs.

Pass condition: targeted tests exist for any changed behavior, and the full
backend test suite passes.

### 6. Production Env Cleanup

Verify Render production env values:

- `APP_ENV=production`;
- `SENTRY_DSN` is set;
- `SENTRY_SEND_DEFAULT_PII=false`;
- `SENTRY_TRACES_SAMPLE_RATE=0`;
- `RATE_LIMIT_REDIS_URL` is set;
- `CORS_ALLOWED_ORIGINS=https://subsmarket.xyz,https://www.subsmarket.xyz`;
- `TELEGRAM_MINI_APP_URL=https://subsmarket.xyz`;
- `TELEGRAM_WEBHOOK_URL=https://api.subsmarket.xyz/api/telegram/webhook`.

## Later, Not Blocking Current Release

- Public rating.
- Internal disputes.
- Payment receipt upload and manual moderation.
- Marketplace Engine for accounts.
- Complex operator tariff slot types.
- Queue system beyond GitHub Actions and notification outbox.
- Project-local Codex skills derived from the ECC analysis, if they become more
  useful than the current docs/checklists.

## Useful Commands

```powershell
npm run backend:lint
npm run backend:compile
node scripts/run-python.mjs -m pytest backend/tests/test_jobs_service.py backend/tests/test_family_service.py -q
npm run production:check
```

Related release docs:

- [release-checklist.md](release-checklist.md)
- [mvp-known-limitations.md](mvp-known-limitations.md)
