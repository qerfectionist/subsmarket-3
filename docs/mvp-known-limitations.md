# MVP Known Limitations

These are intentional limitations for the first Family Engine release.

## Product Scope

- No escrow.
- SubsMarket does not accept money.
- SubsMarket does not verify bank transfers.
- Payment happens directly between participant and owner.
- Receipts and disputes are not included in this release.
- Public rating and reviews are not included.
- Admin panel is not included.
- Account sales and mobile-data sales are not included yet.

## Families

- Owner counts as one family member.
- Free owner limit is two active owner families.
- This limit can become paid later.
- Family subscriptions and family tariffs use the same Family Engine.
- Tariffs do not have slot types yet: one place means one participant.
- Full families are hidden from search.
- Invite code can still open the family card, even if the family is full.

## Requests

- A candidate can have at most three active requests for one service.
- Rejected request cannot be sent again to the same family.
- Candidate self-cancel does not count as rejection.
- Expired request does not punish the candidate.
- Owner rejection has no reason in MVP.

## Access And Payments

- Owner gives access first.
- Participant pays only after confirming access.
- Payment requisites are hidden until access is confirmed.
- Only phone numbers are allowed as payment requisites.
- Card numbers and IBAN are forbidden.
- First payment has a 30-minute timer, but the platform does not automatically
  remove a participant for non-payment.
- Regular payments are tracked by reminders and owner confirmation.
- Money conflicts are resolved by users in Telegram chat, outside SubsMarket.

## Operations

- Current production uses Render/Vercel plus Supabase/Postgres.
- Redis rate limiting is connected through Upstash.
- UptimeRobot checks `/health`.
- GitHub Actions also has a fallback uptime workflow.
- Free infrastructure can have cold starts or slower `/ready` checks.
- Paid Render/Supabase plans are recommended before a large public launch.

## Later Modules

- Marketplace Engine for accounts.
- Marketplace Engine for mobile data.
- Receipts.
- Disputes.
- Public reputation.
- Admin moderation tools.
