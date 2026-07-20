# Database backup and restore

This runbook protects the data that cannot be reconstructed from Telegram:
payments, family membership history, audit logs, notification state, and
idempotency records.

## Launch requirement

Before public launch:

1. Run production on a Supabase plan with automatic daily database backups.
2. Confirm the latest successful backup in the Supabase dashboard.
3. Keep the database password and backup files outside Git and outside the
   application server.
4. Restore a downloaded backup into a separate staging project or an isolated
   local PostgreSQL database.
5. Record the restore date, duration, backup timestamp, row-count checks, and
   the person who verified the result.

Supabase Pro currently includes daily backups with a seven-day retention
window. Point-in-time recovery is a separate paid add-on and is not required
for the MVP if daily recovery is acceptable. The current Free plan must not be
treated as having a production backup policy; export it manually until the
project is upgraded.

Official references:

- [Supabase database backups](https://supabase.com/docs/guides/platform/backups)
- [Restore a downloaded backup](https://supabase.com/docs/guides/local-development/restoring-downloaded-backup)

## Manual logical backup on the Free plan

Use the official Supabase CLI backup command or `pg_dump` from a trusted
machine. Do not place the database URL directly in shell history and do not
commit the resulting file.

Example with the Supabase CLI:

```powershell
$env:SUPABASE_DB_URL='<session-pooler-or-direct-database-url>'
npx supabase db dump --db-url $env:SUPABASE_DB_URL -f "backups/subsmarket-$(Get-Date -Format yyyyMMdd-HHmmss).sql"
Remove-Item Env:SUPABASE_DB_URL
```

Move the dump to encrypted off-site storage after it completes. The local
`backups/` directory is ignored by Git, but it is not itself a backup because a
disk failure can remove both the project and the dump.

## Restore drill

Never test a restore against production. Restore into a disposable staging or
local PostgreSQL database, then verify:

```text
alembic_version contains the expected migration head
users row count is plausible
families and family_members counts are plausible
family_payments and family_audit_logs are readable
notification_jobs status counts are readable
encrypted payment requisites can be decrypted by the staging backend
```

Run backend read-only smoke checks against the restored database. Delete the
temporary database only after recording the result.

## Schedule

- Free test environment: manual logical backup before every migration or large
  data import.
- Production: automatic daily backup plus a monthly restore drill.
- Before risky migrations: take an additional logical backup.
- After any data-loss incident: add a regression test or migration check that
  reproduces the failure.

## Secret rotation

`PAYMENT_REQUISITE_SECRET` encrypts payment phone numbers. To rotate it without
losing access to existing values:

1. Set the new value in `PAYMENT_REQUISITE_SECRET`.
2. Put the old value in `PAYMENT_REQUISITE_PREVIOUS_SECRETS`.
3. Deploy and verify that existing requisites still open.
4. Re-encrypt existing values with the new current key in a controlled
   maintenance task.
5. Remove the old secret only after every value has been re-encrypted and a
   backup has been verified.

Up to three previous secrets are tried, in comma-separated order. Encryption
always uses only the current secret.
