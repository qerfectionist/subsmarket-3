# Local Demo Flow

This flow exists only for local development. It uses backend development auth
headers through the frontend dev user switch. Real Telegram Mini App auth still
uses Telegram `initData`.

## Demo users

The frontend shows a `Dev mode` switch when:

- the app runs through Vite dev mode;
- Telegram `initData` is not present.

Available users:

- `Owner` -> `@demo_owner`
- `Member` -> `@demo_member`

The switch is intentionally frontend-only and dev-only. It must not become a
product feature.

## Manual browser flow

1. Select `Owner`.
2. Create a `Семья подписки`.
3. Create a `Семья тарифа`.
4. Select `Member`.
5. Open search and send a request to each family.
6. Select `Owner`.
7. Open `Мои семьи`, then `Заявки и участники`.
8. Approve the member request.
9. Mark access as provided.
10. Select `Member`.
11. Confirm that access was received.
12. Open payment requisites.
13. Mark the payment as paid.
14. Select `Owner`.
15. Confirm the payment.

Expected final state:

- member status is `active`;
- first payment status is `paid`;
- payment requisites are visible only after access confirmation;
- subscriptions and tariffs stay separated by `family_type`.

## API smoke result

The automated local smoke flow creates one subscription family and one tariff
family, then runs:

- create family;
- create request;
- approve request;
- provide access;
- confirm access;
- open payment requisite;
- report payment paid;
- confirm payment received.
- move the family payment date into the 3-day reminder window;
- run due jobs and verify scheduled regular payments plus reminder jobs;
- move the payment date to today;
- run due jobs and verify regular payments become due;
- age the due payments by 25 hours;
- run due jobs and verify regular payments become overdue.
- read `/api/families/{family_id}/audit-log`;
- verify that expected audit actions were created.

Run it from the project root:

```powershell
backend\.venv\Scripts\python -m subsmarket.dev.demo_flow
```

## UI e2e smoke

The frontend Playwright suite now includes a full Mini App owner/member flow.
It resets only the two local demo users, imports the catalog, and then verifies
the rendered app flow:

- owner creates a subscription family;
- member sends a request;
- owner approves and marks access as provided;
- member confirms access and sees the phone requisite;
- member marks the first payment as paid;
- owner confirms the payment.

Run it from the project root:

```powershell
npm run test:ui
```

Playwright starts its own test backend on `127.0.0.1:8001` and its own Vite
frontend on `127.0.0.1:5174`. The test backend uses a temporary SQLite database
under `.tmp`, so UI e2e does not require Docker or a running local Postgres.
Manual development still uses the normal `127.0.0.1:8000` and
`127.0.0.1:5173` servers.

Playwright runs with one worker because the UI tests share one isolated e2e
database.
