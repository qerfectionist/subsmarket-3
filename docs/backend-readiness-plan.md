# Backend Readiness Plan

Last updated: 2026-06-27.

This plan is focused on finishing the Family Engine backend for subscriptions
and family tariffs. Marketplace accounts and mobile-data listings stay out of
scope until the family flow is stable.

## Current State

Backend checks completed:

- Family Engine service tests pass for jobs, requests, access, payments,
  removals, closing, prepayments, and reminders.
- Critical concurrency fixes are already present: family locks on access
  confirmation, last-slot approval protection, owner-family limit protection,
  and legacy removal locks.
- List APIs have bounded `limit` values and cursor page endpoints for high
  volume screens.
- Production domains are live:
  - Mini App: `https://subsmarket.xyz`
  - API: `https://api.subsmarket.xyz`
- Read-only production check passes with `npm run production:check`.

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

### 5. Production Env Cleanup

Verify Render production env values:

- `APP_ENV=production`;
- `SENTRY_DSN` is set;
- `SENTRY_SEND_DEFAULT_PII=false`;
- `SENTRY_TRACES_SAMPLE_RATE=0`;
- `RATE_LIMIT_REDIS_URL` is set;
- `CORS_ALLOWED_ORIGINS=https://subsmarket.xyz,https://www.subsmarket.xyz`;
- `TELEGRAM_MINI_APP_URL=https://subsmarket.xyz`;
- `TELEGRAM_WEBHOOK_URL=https://api.subsmarket.xyz/api/telegram/webhook`.

## Later, Not Blocking MVP

- Public rating.
- Internal disputes.
- Payment receipt upload and manual moderation.
- Marketplace Engine for accounts and mobile data.
- Complex operator tariff slot types.
- Queue system beyond GitHub Actions and notification outbox.

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
