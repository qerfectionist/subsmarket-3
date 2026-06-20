# Monitoring, security, and load testing

This document describes the external services prepared for SubsMarket and the
small amount of account setup that cannot be completed from the repository.

## Already implemented

### Gitleaks

Workflow: `.github/workflows/security.yml`.

It scans the full Git history:

- on every push to `main`;
- on pull requests;
- once per day;
- on manual dispatch.

The repository belongs to a personal GitHub account, so Gitleaks Action does
not require a license key. Third-party actions are pinned to immutable commit
SHAs.

### Better Stack-compatible heartbeat

Workflow: `.github/workflows/subsmarket-jobs.yml`.

After due jobs, Telegram dispatch, and job-status checks all succeed, the
workflow calls the URL stored in the GitHub secret:

```text
JOBS_HEARTBEAT_URL
```

If any earlier step fails, no heartbeat is sent and the monitor eventually
alerts. The URL is optional locally and must never be committed.

Recommended monitor settings:

- expected period: 10 minutes;
- grace period: 10 minutes;
- alert channel: Telegram or email.

The job runs every 5 minutes, but GitHub scheduled workflows can be delayed, so
a strict five-minute heartbeat would produce false alarms.

Create a separate uptime monitor for:

```text
https://subsmarket-api.onrender.com/health
```

Recommended interval: 3 minutes. Add `/ready` as a second monitor after Render
is upgraded to an always-on plan.

### Grafana k6

Script: `tools/k6/subsmarket-api.js`.

Manual workflow: `.github/workflows/load-test.yml`.

The default run checks:

- `/health`;
- `/ready`;
- active family-service catalog;
- authenticated family search when
  `LOAD_TEST_TELEGRAM_INIT_DATA` is configured.

Default thresholds:

- error rate below 1%;
- p95 response time below 2 seconds;
- successful checks above 99%.

The workflow is manual so an accidental push cannot create production load.
Without Grafana Cloud it runs entirely on the GitHub runner. Cloud execution
requires:

```text
K6_CLOUD_TOKEN
K6_CLOUD_PROJECT_ID
```

Start with 10 virtual users for 30 seconds. Increase gradually only after
Render and Supabase paid plans are active.

### Sentry

The FastAPI integration is already present and disabled when `SENTRY_DSN` is
empty. It keeps `send_default_pii=false` and does not intentionally send
Telegram profile data or payment requisites.

After adding the DSN to Render, verify delivery with:

```powershell
npm run sentry:smoke
```

The command sends one controlled informational event and prints only its event
ID, not the DSN.

## External account values still required

### Sentry

Create a Python/FastAPI project and provide its public DSN. Required Render
values:

```text
SENTRY_DSN=<project DSN>
SENTRY_TRACES_SAMPLE_RATE=0
SENTRY_SEND_DEFAULT_PII=false
```

No Sentry auth token is required for the backend integration.

### Better Stack

Create one heartbeat monitor and provide its unique ping URL. It will be stored
as the GitHub Actions secret `JOBS_HEARTBEAT_URL`.

### Grafana Cloud

Cloud execution is optional. Create a k6 project only before production load
testing and provide:

- project ID;
- access token limited to k6 test execution.

These values will be stored in GitHub Actions secrets and must not be committed
or added to frontend environment variables.

