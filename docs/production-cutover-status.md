# Production Cutover Status

Last checked: 2026-07-21.

## Public URLs

| URL | Status | Notes |
| --- | --- | --- |
| `https://subsmarket.xyz` | OK | Vercel Mini App, HTTP 200 |
| `https://www.subsmarket.xyz` | OK | Vercel, HTTP 200 |
| `https://api.subsmarket.xyz/health` | OK | FastAPI health returns `{"status":"ok"}` |
| `https://api.subsmarket.xyz/ready` | OK | Database readiness returns `database: ok`, rate limit returns `redis` |
| `https://jobs.subsmarket.xyz/health` | OK | Cloudflare jobs scheduler health returns `{"status":"ok"}` |

## DNS

Cloudflare zone: `subsmarket.xyz`.

| Record | Target | Proxy |
| --- | --- | --- |
| `A @` | `216.198.79.1` | DNS only |
| `A @` | `64.29.17.1` | DNS only |
| `CNAME www` | `eb64be71de75cd46.vercel-dns-017.com` | DNS only |
| `CNAME api` | `subsmarket-api.onrender.com` | Proxied |
| `Worker jobs` | `subsmarket-jobs-scheduler` custom domain | Proxied |

`api` is proxied because DNS-only mode produced Cloudflare Error 1000 with the
Render target.

## Vercel

- Project: `subsmarket-3`.
- Domains: `subsmarket.xyz`, `www.subsmarket.xyz`.
- Certificate issued for `subsmarket.xyz` and `www.subsmarket.xyz`.
- Production env:

```text
VITE_API_BASE_URL=https://api.subsmarket.xyz
```

## Render

- Service: `subsmarket-api`.
- Service ID: `srv-d8q5tnh194ac73dgkp3g`.
- Default URL: `https://subsmarket-api.onrender.com`.
- Custom domain: `api.subsmarket.xyz`, verified.
- Temporary Render API key used for setup has been revoked.
- Production env:

```text
TELEGRAM_MINI_APP_URL=https://subsmarket.xyz
TELEGRAM_WEBHOOK_URL=https://api.subsmarket.xyz/api/telegram/webhook
CORS_ALLOWED_ORIGINS=https://subsmarket.xyz,https://www.subsmarket.xyz
```

## Telegram

- Bot username: `subscription_market_bot`.
- Webhook URL: `https://api.subsmarket.xyz/api/telegram/webhook`.
- Pending update count: `0`.
- Menu button URL: `https://subsmarket.xyz/`.

## Verification Commands

```powershell
curl.exe -I https://subsmarket.xyz
curl.exe -I https://www.subsmarket.xyz
curl.exe https://api.subsmarket.xyz/health
curl.exe https://api.subsmarket.xyz/ready
```

Full safe production check from the repository root:

```powershell
npm run production:check
```

This runs API readiness, a small read-only load smoke, Telegram configuration
smoke, and Sentry smoke. The load smoke only calls public read endpoints by
default and does not create families or users.

```powershell
$env:TELEGRAM_WEBHOOK_URL='https://api.subsmarket.xyz/api/telegram/webhook'
$env:TELEGRAM_MINI_APP_URL='https://subsmarket.xyz'
node scripts/run-python.mjs -m subsmarket.ops.telegram_production_smoke
```

```powershell
npm run sentry:smoke
```

## Latest Safe Production Check

Checked on 2026-06-27 from the local repository:

```powershell
npm run production:check
```

Result:

- API smoke: OK.
- Read-only load smoke: OK, 30 requests, concurrency 5, 0 errors.
- Load smoke p95: about 3035 ms on the current test deployment.
- Telegram smoke: OK, webhook and menu button point to production domains.
- Sentry smoke: OK, controlled event delivered.

The Sentry smoke command used the local environment, so it reported
`environment=development`. Render should keep `APP_ENV=production` for real
production events.

## Production Config Guardrails

The stricter production config checker requires:

- `RATE_LIMIT_REDIS_URL` in production;
- `SENTRY_DSN` in production;
- `SENTRY_SEND_DEFAULT_PII=false` in production.

These launch guardrails are intentional. SubsMarket should not be considered
ready for public traffic without shared rate limiting and backend error
visibility.

## Latest Full Local Check

Checked on 2026-07-21:

```powershell
npm run check
```

Result:

- backend lint: OK;
- backend compile: OK;
- backend tests: OK, 198 passed, 25 skipped because they require PostgreSQL;
- PostgreSQL concurrency/security tests: OK, 25 passed against local Docker
  Postgres;
- frontend build: OK;
- Playwright E2E: OK, 10 passed;
- Cloudflare scheduler tests: OK, 5 passed;
- diff check: OK, no whitespace errors.

The latest backend hardening run added regression coverage for search/payment
cursor pagination and Telegram token-safe error handling.

## Production Config Verification

Checked externally on 2026-06-27:

- `https://api.subsmarket.xyz/health`: OK.
- `https://api.subsmarket.xyz/ready`: OK, `database=ok`, `rate_limit=redis`.
- CORS allows `https://subsmarket.xyz`.
- CORS allows `https://www.subsmarket.xyz`.
- CORS rejects an unrelated origin.
- OpenAPI does not expose `/api/dev` routes.
- Telegram smoke passes with the production webhook and menu button URLs.

`APP_ENV=production` cannot be read from public endpoints. Confirm it directly
in Render environment variables before a public launch.

## Redis Rate Limit

Checked on 2026-06-27:

- Upstash Redis TLS connection: OK.
- Render env `RATE_LIMIT_REDIS_URL`: configured.
- Render deploy: `dep-d8vgs7urnols73dmfr90`.
- `/ready` reports `rate_limit=redis`.

The Redis URL is a secret and must not be committed. The temporary Render API
key used to set it has been revoked after setup.

## Remaining Manual Checks

- Open the bot from a real Telegram account.
- Open the Mini App from the Telegram menu button.
- Create a small test family and complete one test join/payment flow.
- GitHub fallback uptime workflow is available at
  `.github/workflows/uptime-check.yml`.
- Upgrade the production Supabase project to a plan with automatic daily
  backups. A production logical-backup restore drill has completed; the paid
  backup policy is still required before traffic-sensitive public launch. See
  [database-backup-and-restore.md](database-backup-and-restore.md).

Verified in code on 2026-07-20:

- a failed `run-due` step returns HTTP 503, so a scheduler cannot emit a false
  successful heartbeat;
- Telegram `429` responses preserve the exact `retry_after` value and have a
  regression test;
- payment requisite decryption supports a bounded list of previous secrets for
  safe key rotation;
- every literal backend error code has a human-facing frontend label, enforced
  by `npm run check:error-labels`.

Detailed backend launch plan: [backend-readiness-plan.md](backend-readiness-plan.md).

## Infrastructure checklist status (2026-07-21)

1. **Render token rotation: complete.** Local Gitleaks 8.30.1
   scanned all 92 commits with `--log-opts=--all` and found no leaks; the latest
   full-history GitHub Security workflow also passed. The exposed temporary
   Render token was used only to read the production `INTERNAL_JOB_TOKEN` for
   scheduler setup and was then revoked. Render Account Settings showed no
   provisioned API keys on 2026-07-21.
2. **Independent scheduler: deployed and verified.**
   `ops/cloudflare-jobs-scheduler` is deployed at `jobs.subsmarket.xyz` with a
   Cloudflare Cron Trigger for `*/5 * * * *`. Its five tests pass, all required
   Cloudflare secrets are present, and a manual production run completed the
   strict `run-due -> dispatch-notifications -> health` sequence successfully.
3. **Heartbeat and failure alert: configured and verified.** The Worker
   sends success only after HTTP success, an empty
   `run-due.job_errors`, zero notification failures, and strict healthy status.
   Healthchecks.io success and `/fail` URLs are configured as Worker secrets.
   The authenticated simulated failure path returned HTTP 503 and emitted a
   real failure ping on 2026-07-21. Healthchecks is configured with a five-minute
   period, ten-minute grace, and an enabled email notification method. Its event
   history recorded success, explicit failure, the `up -> down` transition, a
   subsequent success, and the `down -> up` recovery transition.
4. **Restore drill: production logical backup verified.** On 2026-07-21 the
   automated drill dumped the production Supabase `public` schema, restored it
   into disposable PostgreSQL 17, and completed the read-only smoke in 33
   seconds. Migration `20260720_0030` matched the repository head, 31 catalog
   services and two users were readable, all orphan counters were zero, and no
   smoke problems were reported. Production currently has no encrypted payment
   requisites, so there were no ciphertext rows to decrypt in this drill. The
   restore script now creates missing Supabase client roles (`anon` and
   `authenticated`) as `NOLOGIN` roles before restoring RLS policies into clean
   PostgreSQL. Automatic daily managed backups remain a separate launch-policy
   requirement until the Supabase plan is upgraded.

The checklist is not complete and public launch remains blocked on the four
pending external confirmations above.
