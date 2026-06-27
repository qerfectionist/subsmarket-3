# Release Checklist

Use this checklist before every production release.

## 1. Local Checks

Run from the repository root:

```powershell
npm run check
```

Pass condition:

- backend lint passes;
- backend compile passes;
- backend tests pass;
- frontend build passes;
- Playwright E2E passes;
- diff check has no real whitespace errors.

Windows LF/CRLF warnings are acceptable.

## 2. Backend Hardening Gate

Before deploying backend changes, verify that the change does not weaken these
Family Engine hot paths:

- family creation keeps the owner active-family limit;
- join request approval cannot overfill the last slot;
- search/list endpoints stay bounded by `limit` and use cursor endpoints for
  high-volume screens;
- access confirmation creates only one first payment;
- regular payment jobs do not duplicate payments or reminders;
- owner/member removal and family closing keep member counts consistent;
- rate limiting still reports `redis` in production;
- no development route is exposed in OpenAPI.

If the change touches one of these paths, run the closest targeted backend test
before `npm run check`.

## 3. Production Smoke

Run:

```powershell
npm run production:check
```

Pass condition:

- API smoke: OK;
- read-only load smoke: OK;
- Telegram smoke: OK;
- Sentry smoke: OK.

Then check:

```text
https://api.subsmarket.xyz/ready
```

Expected:

```json
{"status":"ok","database":"ok","rate_limit":"redis"}
```

## 4. Manual Telegram Check

Open `@subscription_market_bot` and the Mini App from Telegram.

Minimum manual flow:

1. owner creates a test family;
2. candidate opens the family from search or invite code;
3. candidate sends a request;
4. owner sees the request;
5. owner approves the request;
6. owner marks access as provided;
7. candidate confirms access;
8. candidate marks payment as paid;
9. owner confirms payment.

If time is short, at least test family creation and request creation.

## 5. Monitoring

Verify:

- UptimeRobot monitor for `https://api.subsmarket.xyz/health` is green;
- GitHub uptime workflow exists: `.github/workflows/uptime-check.yml`;
- GitHub background jobs workflow exists: `.github/workflows/subsmarket-jobs.yml`;
- `/api/internal/jobs/health` returns `status=ok`;
- Render service is healthy;
- Sentry has no unexpected new backend errors.

## 6. Secrets

Before release:

- temporary Render API keys are revoked;
- Redis URL is only in Render env;
- bot token is only in backend env;
- Supabase/Postgres URL is only in backend env;
- Sentry DSN is only in backend env;
- `SENTRY_SEND_DEFAULT_PII=false`;
- no secret was committed.

## 7. Agent Safety

Do not run broad third-party AI-agent installers, hooks, or MCP setup scripts
directly against the repository or the global Codex folder before a release.
Use dry-run first and prefer project-local docs/checklists over hidden global
automation.

Current ECC decision: [ecc-adoption-plan.md](ecc-adoption-plan.md).

## 8. Rollback

If the frontend breaks:

- rollback to the previous Vercel deployment.

If the backend breaks:

- rollback to the previous Render deploy;
- check `/ready`;
- check Telegram webhook status.
