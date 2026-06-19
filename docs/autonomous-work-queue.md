# Autonomous work queue

This document is the queue Codex should use when the user says:

```text
лимит близко, автономный режим
```

The queue exists to keep work productive without asking product questions.
Tasks here must not require new decisions from the user and must not contradict
the approved SubsMarket product rules.

## Rules

- Do not add escrow, platform payments, card storage, IBAN storage, disputes,
  admin panel, ratings, accounts, or GB sales while working on Family Engine MVP.
- Do not reintroduce `Club`, `slot_config`, or `slot_type`.
- Keep `Family` as the domain name.
- Keep family subscriptions and family tariffs separate through `family_type`.
- Keep future accounts and GB sales in the future Marketplace Engine.
- Do not store Telegram phone numbers.
- Do not expose payment requisites before member access is confirmed.
- Prefer small, verifiable increments with tests.
- If a task becomes blocked by missing external credentials, skip it and continue
  with the next local task.
- At the end of a long run, update the checkpoint section below.

## Current autonomous priorities

### 1. Owner workspace UX

Goal: make owner work obvious inside the Mini App.

Tasks:

- split pending requests, active members, and payments into clear owner sections;
- show owner task counters;
- make actions visually distinct:
  - accept request;
  - reject request;
  - mark access provided;
  - cancel before access;
  - confirm payment;
  - mark payment not received;
  - schedule member removal;
  - revoke removal;
- keep member usernames visible only where the user has the right to see them;
- keep family terminology in all visible copy.

### 2. Member workspace UX

Goal: make member obligations clear without platform money handling.

Tasks:

- make first payment flow explicit:
  - request;
  - owner approval;
  - access provided;
  - member confirms access;
  - requisites open;
  - member marks paid;
  - owner confirms;
- improve payment list with due date, amount, period, and status;
- show clear empty states when there are no payments or no active family;
- keep “money questions are outside SubsMarket” implied by copy, not by long
  legal text.

### 3. TMA UI polish

Goal: make the frontend feel like a Telegram Mini App instead of a website.

Tasks:

- reduce local dev switch height;
- keep bottom navigation visible and safe-area aware;
- improve mobile spacing and card density;
- avoid desktop dashboard patterns;
- maintain Telegram theme variable support;
- keep dev-only UI hidden in real Telegram.

### 4. Frontend reliability

Goal: catch broken navigation quickly.

Tasks:

- expand Playwright smoke tests for:
  - home;
  - search;
  - create;
  - my families;
  - requests;
  - family details when data exists;
- avoid Russian text selectors in tests because Windows shell encoding can
  corrupt inline scripts;
- keep tests deterministic with dev auth.

### 5. Backend hardening

Goal: protect product rules that are easy to break later.

Tasks:

- add tests for:
  - owner max two active families;
  - payment requisites hidden before access confirmation;
  - owner cannot leave family like a normal member;
  - member can leave and frees a slot;
  - closing starts a three-day warning;
  - removal warning lasts 12 hours;
- keep tests fast and local.

### 6. Documentation

Goal: keep future work aligned with the architecture.

Tasks:

- update docs after code changes;
- keep deployment instructions current;
- record any deliberate product tradeoff;
- keep Marketplace Engine separated from Family Engine.

## Checkpoint

Last checkpoint:

- TMA bridge exists.
- Backend validates Telegram init data.
- Family subscriptions and family tariffs are separated by `family_type`.
- Audit log exists and is visible in family details for members/owners.
- Regular payment cron and notification outbox exist.
- Playwright UI smoke test exists.
- Backend tests cover Telegram init data, active request limit, rejected request
  restriction, family full auto-cancel, phone/card validation, and rounding.

2026-06-18 autonomous run:

- Owner workspace now has task counters and separate sections for requests,
  members, and payments awaiting confirmation.
- Member workspace now shows the next required action without implying that
  SubsMarket handles money.
- Payment lists now show a useful empty state.
- Playwright smoke test covers bottom navigation for home, search, create,
  my families, requests, and family details when data exists.
- Backend tests now also cover:
  - owner max two active families;
  - payment requisites hidden before access confirmation;
  - owner cannot leave family like a normal member;
  - member leaving frees a family slot;
  - family close starts a three-day warning;
  - member removal warning lasts 12 hours.
- Verification passed:
  - `ruff check backend/src backend/alembic backend/tests`;
  - `compileall backend/src backend/tests`;
  - `pytest backend/tests` with 16 tests;
  - `npm run build`;
  - `npm run test:ui`;
  - `git diff --check`.
- Local Docker Postgres, backend API, and frontend dev server were started for
  browser verification.

2026-06-18 UI e2e run:

- Added stable test ids for the Family Engine flow in the Mini App.
- Added a development-only `/api/dev/reset-demo-data` endpoint. It is mounted
  only when `APP_ENV=development` and resets only local demo users.
- Added `frontend/playwright.config.ts` with one worker because UI tests share a
  local demo database.
- Added Playwright e2e coverage for:
  - owner creates a subscription family;
  - member sends a request;
  - owner approves and marks access as provided;
  - member confirms access and sees requisites;
  - member reports first payment;
  - owner confirms payment.
- Updated `docs/local-demo-flow.md` with the UI e2e command.
- In-app Browser runtime was attempted first for rendered QA, but the runtime
  connection closed before returning a result. Playwright was used for rendered
  validation fallback.

2026-06-18 notification reliability run:

- Added retry metadata to `notification_jobs` through migration
  `20260618_0007`.
- Added notification retry settings:
  - `NOTIFICATION_MAX_ATTEMPTS`;
  - `NOTIFICATION_RETRY_BASE_SECONDS`;
  - `NOTIFICATION_RETRY_MAX_SECONDS`.
- Updated Telegram notification dispatch:
  - successful sends become `sent`;
  - transient errors stay `pending` with exponential backoff;
  - Telegram `400` and `403` are treated as permanent failures;
  - jobs become `failed` after max attempts.
- Added notification dispatcher unit tests for sent, retry, permanent failure,
  and max-attempt failure.
- Added `TELEGRAM_MINI_APP_URL`. When configured, Telegram notifications include
  a button that opens the Mini App.
- Local Postgres was migrated to `20260618_0007 (head)`.
- Verification passed:
  - `ruff check backend/src backend/alembic backend/tests`;
  - `compileall backend/src backend/tests`;
  - `pytest backend/tests` with 20 tests;
  - `npm run build`;
  - `npm run test:ui` with 2 tests;
  - `git diff --check`.

2026-06-18 bot production layer run:

- Added Telegram bot webhook endpoint at `/api/telegram/webhook`.
- Added production webhook secret verification through
  `X-Telegram-Bot-Api-Secret-Token`.
- Added thin `/start` bot behavior:
  - private `/start` sends the SubsMarket intro;
  - private text receives the same helper message;
  - group updates are ignored;
  - bot does not mutate Family Engine state.
- Added `python -m subsmarket.bot.set_webhook` for production webhook setup.
- Added env values:
  - `TELEGRAM_WEBHOOK_URL`;
  - `TELEGRAM_WEBHOOK_SECRET`;
  - `TELEGRAM_WEBHOOK_DROP_PENDING_UPDATES`.
- Updated Render blueprint and deployment/API/TMA docs.
- Added bot tests for `/start`, ignored group updates, webhook secret checks,
  and `setWebhook` payload.
- Verification passed:
  - `ruff check backend/src backend/alembic backend/tests`;
  - `compileall backend/src backend/tests`;
  - `pytest backend/tests` with 27 tests;
  - `npm run build`;
  - `npm run test:ui` with 2 tests;
  - `git diff --check`.

2026-06-18 production readiness run:

- Moved system checks into `subsmarket.core.api`.
- Added `/ready`, which verifies database connectivity and is used by Render
  health checks.
- Added `python -m subsmarket.ops.check_deploy_config`, which validates
  production env without printing secrets.
- Render web service now runs config check before migrations and catalog seed.
- Added tests for `/health`, `/ready`, webhook API secret behavior, webhook
  handler invocation, and production config validation.
- Verified a safe fake production config through the CLI.
- Restarted the local backend and verified:
  - `/health`;
  - `/ready`;
  - local frontend;
  - Docker Postgres health.
- Verification passed:
  - `ruff check backend/src backend/alembic backend/tests`;
  - `compileall backend/src backend/tests`;
  - `pytest backend/tests` with 34 tests;
  - `npm run build`;
  - `npm run test:ui` with 2 tests;
  - `git diff --check`.

2026-06-18 frontend error UX run:

- Added a complete Mini App error-label map for current backend domain errors.
- API errors like `FAMILY_REQUEST_FORBIDDEN` now render as plain user-facing
  Russian text.
- Unknown or already-human API messages still pass through without being
  rewritten.
- Verification passed:
  - `pytest backend/tests` with 34 tests;
  - `npm run build`;
  - `npm run test:ui` with 2 tests;
  - `git diff --check`.

2026-06-18 owner settings UX run:

- Added real owner controls in Mini App for:
  - editing family description;
  - changing total family price;
  - changing payment day and next payment date.
- Reused existing backend rules:
  - price changes are limited to once per month;
  - payment date changes are blocked after the family has been full.
- Extended Playwright e2e to cover owner description, price, and payment date
  updates before member onboarding.
- Verification passed:
  - `npm run build`;
  - `npm run test:ui` with 2 tests;
  - `git diff --check`.

2026-06-18 root verification commands run:

- Added root `package.json` command shortcuts:
  - `npm run build`;
  - `npm run test:ui`;
  - `npm run backend:lint`;
  - `npm run backend:test`;
  - `npm run check`.
- Updated README with the root verification commands.
- Verified `npm run check` from the project root:
  - backend lint passed;
  - backend tests passed with 34 tests;
  - frontend build passed;
  - Playwright UI tests passed with 2 tests.
- Verification passed:
  - `git diff --check`.

2026-06-18 owner settings backend coverage run:

- Added backend tests for owner settings rules:
  - owner can update family price and member share is recalculated;
  - price can be changed only once per month;
  - payment day and next payment date can be changed before the family was full;
  - payment day changes are locked after the family has been full.
- Verified API documentation already lists the related endpoints.
- Verification passed:
  - `ruff check backend/src backend/alembic backend/tests`;
  - `pytest backend/tests` with 37 tests;
  - `npm run check`;
  - `git diff --check`.

2026-06-18 owner rules visibility run:

- Exposed `owner_rules` in the public Family API response.
- Added owner rules display on family cards and family details.
- Added backend coverage so owner rules are not dropped from API responses.
- Extended Playwright e2e to verify owner rules appear after family creation.
- Restarted local backend/frontend dev servers so UI e2e used the current code.
- Verification passed:
  - `npm run check` with 38 backend tests and 2 UI tests;
  - `git diff --check`.

2026-06-18 root check hardening run:

- Extended root verification commands:
  - `npm run backend:compile`;
  - `npm run check:diff`.
- `npm run check` now runs lint, Python compile, backend tests, frontend build,
  UI tests, and diff whitespace checks.
- Updated README with the new commands.
- Verification passed:
  - `npm run check` with 38 backend tests and 2 UI tests.

2026-06-18 catalog and e2e isolation run:

- Added catalog service tests:
  - family subscriptions and family tariffs remain separated by `family_type`;
  - unsupported catalog `family_type` values are rejected.
- UI e2e now starts its own backend on `127.0.0.1:8001` and frontend on
  `127.0.0.1:5174`.
- UI e2e backend uses a temporary SQLite database initialized from SQLAlchemy
  models through `python -m subsmarket.dev.init_e2e_db`.
- This keeps Playwright independent from Docker Desktop and the manual local
  dev servers on `8000` and `5173`.
- Updated `docs/local-demo-flow.md` with the new e2e behavior.
- Verification passed:
  - `npm run test:ui` with 2 tests;
  - `npm run check` with 40 backend tests and 2 UI tests.

2026-06-18 API contract and TMA noise cleanup run:

- Updated API contract to match the current implementation:
  - catalog filters use `family_type` and `status`;
  - family search currently filters by `family_type`;
  - family creation uses `next_payment_date`, `payment_bank`, and
    `payment_phone`.
- Added Telegram haptic version guards so older/dev Telegram WebApp versions do
  not emit unsupported haptic warnings during UI tests.
- Verification passed:
  - `npm run test:ui` with 2 tests;
  - `npm run check` with 40 backend tests and 2 UI tests.

2026-06-18 mobile UI and requests context run:

- Ran the Mini App at a mobile `390x844` viewport and a desktop `1280x720`
  viewport.
- The in-app Browser completed the first desktop capture, then its native
  connection closed while switching the viewport. Continued the same visual
  verification with local Playwright.
- Fixed the Telegram user header so long usernames remain on one line and are
  truncated instead of stretching the layout.
- Success notices now close automatically after 2.5 seconds.
- Increased bottom content spacing so long forms and owner controls remain
  fully reachable above the fixed navigation bar.
- Request cards now show:
  - family type;
  - service name and variant;
  - request status;
  - a human-readable cancellation reason.
- Added the family summary fields to the request API response and covered them
  with a backend test.
- Extended Playwright e2e to verify that a member sees the requested service on
  the requests screen.
- Verification passed:
  - `npm run check` with 41 backend tests and 2 UI tests;
  - create-family and owner-settings bottom actions remain reachable above the
    fixed navigation bar;
  - no relevant browser console errors were found.

2026-06-18 access confirmation reminder run:

- Corrected an outdated product rule across the project documentation:
  - after 24 hours without access confirmation, membership is not cancelled;
  - the member keeps occupying the family place;
  - no payment is created;
  - the system reminds both sides;
  - only the owner can later start the normal 12-hour removal flow.
- Added a due job that creates one access-confirmation reminder for the member
  and one for the owner after 24 hours.
- Added an owner action to send another reminder while the member remains in
  `awaiting_confirmation`.
- Added audit events for automatic and manual reminders.
- Added a Mini App button `Напомнить подтвердить` in the owner workspace.
- Removed unimplemented payment correction endpoints from the MVP API contract.
- Verification passed:
  - `npm run check` with 43 backend tests and 2 UI tests;
  - repeated due-job runs do not duplicate the automatic reminder;
  - the member remains in `awaiting_confirmation` and the family place remains
    occupied.

2026-06-18 owner payment confirmation reminder run:

- Added owner reminders while a payment remains in `payment_reported`:
  - after 10 minutes;
  - after 20 minutes;
  - after 40 minutes;
  - once per day after 24 hours.
- Each reminder is deduplicated by payment and reminder stage/date.
- Reminders stop automatically when the owner confirms the payment or the
  payment leaves `payment_reported`.
- If a scheduler run was missed, only the latest applicable quick reminder is
  created instead of sending several old reminders at once.
- Removed the obsolete payment-correction flow from product and database
  documentation. Confirmed payments are not changed inside SubsMarket; money
  disagreements remain outside the platform.
- Verification passed:
  - `npm run check` with 44 backend tests and 2 UI tests;
  - quick and daily reminder stages are covered by tests;
  - repeated job runs do not create duplicates.

2026-06-18 Family Engine completion and hardening run:

- Personalized family discovery now excludes the user's own families, active
  memberships, pending requests, and families permanently unavailable after a
  rejection. Owner usernames stay hidden until an active request or membership
  permits direct Telegram contact.
- Future payments are cancelled after a member leaves, a removal completes, or
  a family closes. Related pending notification jobs are cancelled as well.
- Added member prepayment for the nearest future period and owner recording of
  multiple periods already paid after an agreement outside SubsMarket.
- Added PostgreSQL query indexes and changed last-place approval locking to a
  consistent family-then-request order. A real PostgreSQL concurrency test
  verifies that only one request can take the final place without deadlock.
- Added isolated API, scheduler, catalog, payment lifecycle, and production
  smoke coverage. Subscription and tariff storefronts have separate UI e2e
  coverage while sharing the Family Engine.
- Added daily family-closing acknowledgement reminders and a 10-minute cooldown
  for manual access reminders.
- Production configuration now requires explicit HTTPS CORS origins, validates
  reminder settings, and includes a smoke command for health, readiness,
  required OpenAPI routes, and absence of development endpoints.
- Added Alembic migrations `20260618_0008` and `20260618_0009`. The migration
  chain was verified both on the local database and on a clean temporary
  PostgreSQL database.
- Remaining external work requires production credentials and external state:
  deployment, Telegram webhook setup, production catalog review, real-device
  Telegram checks, and replacement of the previously shared bot token.
- Final verification passed:
  - `npm run check`: 60 backend tests passed, one PostgreSQL-only test skipped
    in the generic run, frontend build passed, and 3 Playwright tests passed;
  - the skipped concurrency test passed separately against PostgreSQL;
  - Alembic reports `20260618_0009 (head)`;
  - production config validation and local production smoke passed;
  - the refreshed `390x844` Mini App had no browser console errors;
  - local backend and frontend are ready on ports `8000` and `5173`.

2026-06-19 Supabase production database setup:

- Connected the Supabase plugin after user confirmation.
- Created Supabase project `subsmarket-3` in `qerfectionist's Org`.
  - project ref: `oulwqlysozrdhlhheflk`;
  - region: `eu-central-1`;
  - creation cost reported by Supabase: `0` monthly.
- Applied the Family Engine schema to Supabase and stamped Alembic at
  `20260619_0011`.
- Imported the production catalog:
  - 26 active subscription services;
  - 5 active tariff services.
- Hardened the Supabase public schema:
  - RLS enabled on all public application tables;
  - explicit deny policies for `anon` and `authenticated`;
  - additional audit-log FK indexes added.
- Supabase security advisors returned no lints. Performance advisors only
  reported unused indexes, which is expected on an empty newly-created database.
- Updated production hosting plan:
  - Render hosts only the FastAPI web service;
  - Supabase provides PostgreSQL through `DATABASE_URL`;
  - GitHub Actions calls protected job endpoints every 5 minutes.
- Generated ignored local production values file:
  `.tmp/production-env-values.md`.
- Verification passed:
  - local PostgreSQL upgraded to `20260619_0011`;
  - `npm run check` passed with 60 backend tests and 3 Playwright tests.

2026-06-19 Vercel frontend bootstrap:

- Created Vercel project `subsmarket-3` under
  `qerfectionist-gmailcoms-projects`.
- Deployed the Mini App frontend to production:
  `https://subsmarket-3.vercel.app`.
- The first frontend deployment intentionally uses a temporary backend URL.
  After Render backend is deployed, update `VITE_API_BASE_URL` in Vercel and
  redeploy.
- Added `.vercel/` to the root `.gitignore` so local Vercel project metadata
  stays out of Git.

2026-06-19 production deployment completion:

- Deployed the FastAPI backend to Render Free:
  `https://subsmarket-api.onrender.com`.
- Connected Render to Supabase through the IPv4 Session pooler.
- Production health, readiness, database connectivity, OpenAPI routes, and
  absence of development endpoints passed the production smoke check.
- Activated the production catalog and verified 31 visible services:
  26 subscriptions and 5 family tariffs.
- Set Vercel `VITE_API_BASE_URL` to the Render backend and redeployed
  `https://subsmarket-3.vercel.app`.
- Set the Telegram webhook to the Render endpoint with zero pending updates
  and no delivery error.
- Added `SUBSMARKET_API_BASE_URL` to GitHub Actions and verified the protected
  scheduled-jobs workflow completes successfully.
- Pinned Render to Python 3.12 through `backend/.python-version`.
- Remaining external check: update the bot Main Mini App URL in BotFather from
  the old development domain to `https://subsmarket-3.vercel.app`, then test on
  real Telegram iOS, Android, or Desktop.

2026-06-19 Telegram production smoke hardening:

- Confirmed the bot menu button now opens `https://subsmarket-3.vercel.app`.
- Confirmed the webhook points to the Render backend with zero pending updates
  and no delivery error.
- Added a read-only Telegram production smoke command that verifies bot
  identity, webhook state, menu button URL, and Mini App availability without
  printing the bot token.

2026-06-19 signed production Family Engine QA:

- Ran the production API with two isolated, correctly signed Telegram WebApp
  `initData` identities; requests without `initData` were rejected.
- Completed the full owner/member lifecycle for both engines:
  - subscription family;
  - tariff family;
  - join request and approval;
  - access provided and confirmed;
  - payment reported and owner-confirmed;
  - full-family counters and audit timeline.
- The runner removed both QA families, all 12 generated notification jobs, and
  both QA users in a guaranteed cleanup block.
- An independent Supabase query confirmed zero remaining QA users and zero QA
  families after cleanup.

2026-06-19 member removal lifecycle correction:

- Aligned participant removal with the approved 12-hour warning:
  - `Понятно` records acknowledgement without removing the participant;
  - `Попросить отменить` notifies the owner without stopping the timer;
  - only the owner can revoke removal;
  - the slot and scheduled payments remain active until revocation or timeout.
- Added backend service tests and a full owner/member Playwright flow.
- Verified Alembic `20260619_0012` both as an incremental upgrade and from the
  first migration on a clean PostgreSQL database.

2026-06-19 notification dispatch hardening:

- Blocked delivery of internal event names to Telegram users. New
  `notification_jobs` now require a non-empty human-facing `payload.message`;
  invalid existing rows fail permanently with `NOTIFICATION_MESSAGE_MISSING`.
- Trimmed notification text when a job is created so accidental whitespace does
  not leak into Telegram.
- Added tests for creation-time validation, legacy missing-message failures,
  trimmed messages, and the real Telegram sender payload with the Mini App
  button.
- Updated deployment documentation with the outbox message contract.

2026-06-19 backend security and load hardening:

- Closed unauthenticated production access to `GET /api/families/{family_id}`;
  family cards now require verified Telegram auth like the rest of Family
  Engine.
- Protected `POST /api/catalog/import-family-services` in production with
  `X-Internal-Job-Token`; deploy-time seed remains the normal production path.
- Added partial PostgreSQL indexes for deadline jobs:
  pending request expiry, access-confirmation reminders, first-payment overdue
  checks, member-removal execution, and due family closure.
- Added `FOR UPDATE SKIP LOCKED` to state-changing scheduled-job selections so
  overlapping cron runs do not process the same rows.
- Verified backend tests and PostgreSQL-only concurrency test.
