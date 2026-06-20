# Family Engine backend audit

Audit date: 2026-06-20.

Scope:

- subscription and mobile-tariff families;
- Telegram identity and authorization;
- requests, membership, access, payments, removal, leaving, closing;
- invite codes, notifications, AuditLog, PostgreSQL concurrency;
- Supabase public-schema protection;
- local launch-burst write load.

Marketplace accounts and GB listings are intentionally outside this audit.

## Result

No open P0 or P1 backend defect remains in the audited Family Engine scope.

One privacy defect was found and fixed during the audit:

- a removed or departed member could reuse a known endpoint to request the
  owner's payment phone after membership ended;
- a former member could continue reading later family AuditLog events.

The backend now returns `403` for both cases. Owners keep access to their family
history, and current members retain only the access required by the active
family lifecycle.

## Verified lifecycle

| Area | Verified behavior |
| --- | --- |
| Family creation | owner occupies one slot; two active-family limit is transactional |
| Discovery | subscription and tariff storefronts remain separate |
| Availability | owner confirmation affects ordering, not automatic deletion |
| Invite | one active eight-digit code; full family resolves but rejects requests |
| Request | pending, approved, rejected, cancelled, expired and family-full flows |
| Contact privacy | owner username opens only after an active request or membership |
| Access | owner provides access; member confirms; payment starts afterwards |
| Requisites | hidden before confirmation and after membership termination |
| First payment | due, reported, cancelled report, confirmed, not received, overdue |
| Regular payment | scheduled, due, reminders, overdue, confirmation |
| Prepayment | one member-created period or owner-recorded agreed periods |
| Leaving | member leaves immediately; future scheduled payments are cancelled |
| Removal | owner removes immediately with a required reason |
| Closing | owner selects date; search and new requests close immediately |
| Audit | owner and current members can read; outsiders and former members cannot |
| Notifications | outbox, retries, deduplication and job-status monitoring |

## Authorization coverage

API tests verify that an unrelated user cannot:

- edit description, price, payment date, visibility, or availability;
- view owner queues, family members, family payments, or private AuditLog;
- approve, reject, or cancel another user's request;
- create, rotate, disable, or read the owner's invite management endpoint;
- provide access, confirm access, remove members, or close a family;
- read payment requisites or another member's payment history;
- report, cancel, confirm, or reject another member's payment;
- create member prepayments or record owner-confirmed prepaid periods.

## Supabase and PostgreSQL protection

Two independent checks now protect public-schema tables:

1. A migration contract test fails when a new `op.create_table` is not covered
   by the baseline hardening migration and does not add its own RLS/revoke
   statements.
2. A PostgreSQL integration test checks the migrated database and requires RLS
   on every SQLAlchemy application table. When `anon` or `authenticated` roles
   exist, it also requires zero direct table grants for those roles.

The Mini App continues to use the FastAPI backend. It does not read application
tables directly through the Supabase Data API.

## Launch-burst rehearsal

Local Docker PostgreSQL run:

- 2500 family creations;
- 2500 join requests;
- 2500 approvals;
- concurrency: 50;
- errors: 0;
- validation: 2500 full families, 2500 approved requests, 2500 members;
- cleanup: zero temporary services, users, and families remained.

Measured local results:

| Phase | Throughput | p50 | p95 | max |
| --- | ---: | ---: | ---: | ---: |
| Create families | 13.07 ops/s | 3789.86 ms | 4555.80 ms | 5383.77 ms |
| Create requests | 81.98 ops/s | 605.62 ms | 714.29 ms | 862.78 ms |
| Approve requests | 108.80 ops/s | 456.23 ms | 538.59 ms | 665.36 ms |

This proves correctness under the tested local burst, not the final capacity of
Render Pro or Supabase Pro. Production capacity must be measured after the paid
service sizes, connection pool, region, and autoscaling settings are final.

## Remaining external checks

These require production services or real Telegram clients:

- production migration and RLS verification against the real Supabase project;
- Render Pro and Supabase Pro load test with agreed safe limits;
- real Telegram webhook and notification delivery;
- Telegram iOS, Android, and Desktop Mini App checks;
- Sentry DSN activation and verification of a controlled test error;
- rotation of any bot or database credential previously shared outside secret
  storage.

