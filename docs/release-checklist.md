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

## 2. Production Smoke

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

## 3. Manual Telegram Check

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

## 4. Monitoring

Verify:

- UptimeRobot monitor for `https://api.subsmarket.xyz/health` is green;
- GitHub uptime workflow exists: `.github/workflows/uptime-check.yml`;
- Render service is healthy;
- Sentry has no unexpected new backend errors.

## 5. Secrets

Before release:

- temporary Render API keys are revoked;
- Redis URL is only in Render env;
- bot token is only in backend env;
- Supabase/Postgres URL is only in backend env;
- Sentry DSN is only in backend env;
- `SENTRY_SEND_DEFAULT_PII=false`;
- no secret was committed.

## 6. Rollback

If the frontend breaks:

- rollback to the previous Vercel deployment.

If the backend breaks:

- rollback to the previous Render deploy;
- check `/ready`;
- check Telegram webhook status.
