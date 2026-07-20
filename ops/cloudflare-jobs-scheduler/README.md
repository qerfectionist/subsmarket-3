# SubsMarket jobs scheduler

This Cloudflare Worker is the primary five-minute production scheduler. The
GitHub Actions schedule remains a fallback because GitHub does not guarantee
that scheduled workflows run on time.

The Worker performs one strict sequence:

1. `POST /api/internal/jobs/run-due` and require an empty `job_errors` array;
2. `POST /api/internal/jobs/dispatch-notifications` and require `failed == 0`;
3. `GET /api/internal/jobs/health` and require `status == "ok"` with no warnings;
4. send the success heartbeat.

Any failed request, malformed response, non-empty job error list, notification
failure, or unhealthy job state prevents the success heartbeat. If a failure
heartbeat URL is configured, it is called immediately as well.

## Local verification

```powershell
npm install
npm run check
npx wrangler deploy --dry-run
```

The Worker uses the official Cloudflare Cron Trigger syntax and runs on UTC.
`*/5 * * * *` does not depend on the timezone.

## One-time production setup

Authenticate and store secrets in Cloudflare. Do not put their values in
`wrangler.jsonc`, shell history, GitHub, or this README.

```powershell
npx wrangler login
npx wrangler secret put INTERNAL_JOB_TOKEN
npx wrangler secret put HEARTBEAT_URL
npx wrangler secret put HEARTBEAT_FAILURE_URL
npx wrangler secret put TRIGGER_TOKEN
npx wrangler deploy
```

- `INTERNAL_JOB_TOKEN` must match Render.
- `HEARTBEAT_URL` is the monitor's success URL.
- `HEARTBEAT_FAILURE_URL` is the monitor's explicit failure URL.
- `TRIGGER_TOKEN` protects manual runs and failure tests.

Configure the external monitor for a five-minute period, ten-minute grace
period, and alert after fifteen minutes without success. Configure Telegram and
email delivery.

## Verification after deployment

Store the manual trigger token in the current PowerShell process, then run a
normal call. The token does not become part of the URL.

```powershell
$env:SCHEDULER_TRIGGER_TOKEN='<temporary local value>'
curl.exe --fail-with-body --request POST `
  --header "Authorization: Bearer $env:SCHEDULER_TRIGGER_TOKEN" `
  https://jobs.subsmarket.xyz/run
```

Verify an actual alert by running the protected failure path:

```powershell
curl.exe --request POST `
  --header "Authorization: Bearer $env:SCHEDULER_TRIGGER_TOKEN" `
  "https://jobs.subsmarket.xyz/run?simulate_failure=true"
Remove-Item Env:SCHEDULER_TRIGGER_TOKEN
```

Expected result: HTTP 503, a failed Worker invocation in Cloudflare logs, and a
Telegram/email alert from the heartbeat provider. Record the test date and
delivery time in `docs/production-cutover-status.md`.
