# Family Engine and Marketplace Engine

SubsMarket has two different product engines.

## Family Engine

Family Engine is for recurring shared groups where members join one family and pay
their share over time.

It includes two separate family service types:

- `subscription` - family subscriptions for digital services;
- `tariff` - family mobile operator tariffs.

Both use the same simple MVP rule:

- one place equals one participant;
- the owner also occupies one place;
- no `slot_type`;
- no `slot_config`;
- no device-specific slots;
- payment goes directly to the owner.

The UI must show these as separate sections:

- Family subscriptions;
- Family tariffs.

## Marketplace Engine

Marketplace Engine is for one-off listings:

- mobile data/GB sales - implemented;
- account/access sales - planned.

Marketplace listings must not be implemented as `Family` records and must not reuse
family membership or recurring payment logic.

This keeps Marketplace growth possible without polluting the Family domain.
