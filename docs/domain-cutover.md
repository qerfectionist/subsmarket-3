# subsmarket.xyz Domain Cutover

## Target layout

| Public address | Target | Purpose |
| --- | --- | --- |
| `https://subsmarket.xyz` | Vercel | Telegram Mini App |
| `https://www.subsmarket.xyz` | Vercel redirect | Optional canonical redirect to the apex domain |
| `https://api.subsmarket.xyz` | Render | FastAPI API and Telegram webhook |

Cloudflare is already authoritative for `subsmarket.xyz`. No DNS records were
present when this plan was prepared, so the cutover will not replace an
existing website or API.

## Current status

Checked on 2026-06-27:

- Vercel project: `subsmarket-3`.
- Vercel production deployment is ready.
- `subsmarket.xyz` is attached to the Vercel project and `verified=true`.
- `www.subsmarket.xyz` is attached to the Vercel project and `verified=true`.
- Vercel production env `VITE_API_BASE_URL` has been reset to
  `https://api.subsmarket.xyz`.
- Vercel production was redeployed after the env update, and the deployment was
  aliased to `https://subsmarket.xyz`.
- Vercel certificate was issued for `subsmarket.xyz` and
  `www.subsmarket.xyz`.
- `https://subsmarket.xyz` returns 200.
- `https://www.subsmarket.xyz` returns 200.
- Cloudflare DNS records for `subsmarket.xyz` and `www.subsmarket.xyz` are
  created and set to DNS only.
- Cloudflare DNS for `api.subsmarket.xyz` is created as CNAME to
  `subsmarket-api.onrender.com`.
- Render custom domain `api.subsmarket.xyz` is added to the `subsmarket-api`
  service and verified.
- Cloudflare proxying is enabled for `api.subsmarket.xyz`. DNS-only mode caused
  Cloudflare Error 1000 because the Render target is also behind Cloudflare.
- `https://api.subsmarket.xyz/health` returns `{"status":"ok"}`.
- `https://api.subsmarket.xyz/ready` returns database `ok`.
- Backend CORS allows `https://subsmarket.xyz` and
  `https://www.subsmarket.xyz`.
- The temporary Render API key used for setup has been revoked.

## 1. Add domains before DNS records

In Vercel, `subsmarket.xyz` and `www.subsmarket.xyz` are already added to the
existing Mini App project.

In Render, `api.subsmarket.xyz` has already been added as a custom domain on the
existing FastAPI web service and is verified.

Render service:

```text
Name: subsmarket-api
Service ID: srv-d8q5tnh194ac73dgkp3g
Default URL: https://subsmarket-api.onrender.com
```

Dashboard path used:

```text
subsmarket-api -> Settings -> Custom Domains -> Add Custom Domain
Domain: api.subsmarket.xyz
```

CLI/API alternative used:

```powershell
$env:RENDER_API_KEY='<temporary Render API key>'
curl.exe --request POST `
  --url "https://api.render.com/v1/services/srv-d8q5tnh194ac73dgkp3g/custom-domains" `
  --header "Authorization: Bearer $env:RENDER_API_KEY" `
  --header "Accept: application/json" `
  --header "Content-Type: application/json" `
  --data "{\"name\":\"api.subsmarket.xyz\"}"
```

The temporary Render API key used for this setup has been revoked.

## 2. Add Cloudflare DNS records

Create the Vercel and Render records exactly as their dashboards show. Start
them as **DNS only** (grey cloud) until both providers issue HTTPS
certificates. After verification, Cloudflare proxying can be enabled for the
API if the Render custom-domain health check continues to pass.

These records have been created for the Mini App:

```text
Type  Name  Value                         Proxy
A     @     216.198.79.1                  DNS only
A     @     64.29.17.1                    DNS only
CNAME www   eb64be71de75cd46.vercel-dns-017.com  DNS only
```

Do not use Cloudflare proxying for these records unless Vercel certificate
issuance breaks again. Vercel is currently serving HTTPS correctly.

Do not create a record for the backend on the apex domain. The API must stay on
`api.subsmarket.xyz` so browser caching and security rules can be separated
from the Mini App.

The backend DNS record has already been created. It is proxied because
DNS-only mode produced Cloudflare Error 1000:

```text
Type   Name  Value                         Proxy
CNAME  api   subsmarket-api.onrender.com   Proxied
```

## 3. Configure Vercel

This Vercel environment variable is already set for Production:

```text
VITE_API_BASE_URL=https://api.subsmarket.xyz
```

The Mini App itself will be served from `https://subsmarket.xyz`. Redeploy has
already been run after the environment variable update.

The Vercel certificate was issued with:

```powershell
vercel certs issue subsmarket.xyz www.subsmarket.xyz --scope qerfectionist-gmailcoms-projects
```

## 4. Configure Render

These production environment variables are already set on the FastAPI service:

```text
TELEGRAM_MINI_APP_URL=https://subsmarket.xyz
TELEGRAM_WEBHOOK_URL=https://api.subsmarket.xyz/api/telegram/webhook
CORS_ALLOWED_ORIGINS=https://subsmarket.xyz,https://www.subsmarket.xyz
SENTRY_DSN=<configured in Sentry>
SENTRY_SEND_DEFAULT_PII=false
SENTRY_TRACES_SAMPLE_RATE=0
```

Keep the existing `TELEGRAM_WEBHOOK_SECRET`, `PAYMENT_REQUISITE_SECRET`,
`INTERNAL_JOB_TOKEN`, and database variables unchanged.

The Render service was redeployed after these environment updates, and CORS
preflight checks now return 200 for both Mini App origins.

## 5. Update Telegram

After Render is healthy:

1. Set the BotFather Main Mini App URL to `https://subsmarket.xyz`.
2. Run the backend webhook setup command from the production environment.
3. Use one test Telegram account to open the Mini App and receive a test
   notification.

Webhook status:

```text
https://api.subsmarket.xyz/api/telegram/webhook
```

The Telegram webhook is already set to the new API domain. Telegram menu button
also points to `https://subsmarket.xyz/`.

## 6. Verify

The cutover is complete only when all checks pass:

```text
https://subsmarket.xyz                 -> Mini App opens
https://api.subsmarket.xyz/health      -> {"status":"ok"}
https://api.subsmarket.xyz/ready       -> database: ok
```

Then run:

```powershell
cd backend
python -m subsmarket.ops.telegram_production_smoke
python -m subsmarket.ops.sentry_smoke
```

Finally, open the Mini App from Telegram, create a test family, and confirm
that the test notification contains the `Open SubsMarket` button.
