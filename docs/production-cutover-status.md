# Production Cutover Status

Last checked: 2026-06-27.

## Public URLs

| URL | Status | Notes |
| --- | --- | --- |
| `https://subsmarket.xyz` | OK | Vercel Mini App, HTTP 200 |
| `https://www.subsmarket.xyz` | OK | Vercel, HTTP 200 |
| `https://api.subsmarket.xyz/health` | OK | FastAPI health returns `{"status":"ok"}` |
| `https://api.subsmarket.xyz/ready` | OK | Database readiness returns `database: ok`, rate limit returns `redis` |

## DNS

Cloudflare zone: `subsmarket.xyz`.

| Record | Target | Proxy |
| --- | --- | --- |
| `A @` | `216.198.79.1` | DNS only |
| `A @` | `64.29.17.1` | DNS only |
| `CNAME www` | `eb64be71de75cd46.vercel-dns-017.com` | DNS only |
| `CNAME api` | `subsmarket-api.onrender.com` | Proxied |

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

Checked on 2026-06-27:

```powershell
npm run check
```

Result:

- backend lint: OK;
- backend compile: OK;
- backend tests: OK, 159 passed, 9 skipped;
- PostgreSQL concurrency/security tests: OK, 9 passed against local Docker
  Postgres;
- frontend build: OK;
- Playwright E2E: OK, 7 passed;
- diff check: OK, only Windows LF/CRLF warnings.

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
- Configure an independent five-minute scheduler. GitHub run history checked on
  2026-07-20 contained multi-hour gaps and is not sufficient as the primary
  production scheduler.
- Create a heartbeat monitor and add its ping URL as the required GitHub secret
  `JOBS_HEARTBEAT_URL`.
- Upgrade the production Supabase project to a plan with automatic daily
  backups and complete one restore drill using
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
