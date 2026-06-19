# Схема БД MVP

База данных MVP - PostgreSQL. Названия таблиц приведены в snake_case.

Документ описывает логическую схему и обязательные ограничения. Конкретная ORM
может отличаться, но не должна менять доменные правила.

## Enums

```sql
user_status = active | restricted

family_status = active | full | closing | closed
family_period = monthly | yearly

family_member_role = owner | member
family_member_status =
  awaiting_access | awaiting_confirmation | payment_due | active |
  removal_pending | left | removed | cancelled_before_access

family_request_status = pending | approved | rejected | cancelled | expired
family_request_cancel_reason =
  user_cancelled | family_full |
  owner_cancelled_before_access | candidate_cancelled_before_access

family_payment_kind = first | regular | prepaid
family_payment_status =
  scheduled | due | payment_reported | paid | overdue | cancelled

notification_status = pending | sent | failed | cancelled
```

## users

```sql
users (
  id uuid primary key,
  telegram_user_id bigint not null unique,
  username text not null,
  first_name text not null,
  last_name text,
  photo_url text,
  status user_status not null default 'active',
  created_at timestamptz not null,
  updated_at timestamptz not null
)
```

Правила:

- `username` обязателен;
- телефон пользователя не хранится;
- Telegram-профиль обновляется при входе.

## family_services

```sql
family_services (
  id uuid primary key,
  slug text not null unique,
  name text not null,
  variant text,
  family_type text not null,
  category text not null,
  subcategory text,
  max_members int not null,
  supported_periods jsonb not null,
  status text not null,
  metadata jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
)
```

Правила:

- `max_members between 2 and 8`;
- создать семью можно только при `status = 'active'`;
- каталог импортируется из `data/family-services.json` после ручной проверки.

## families

```sql
families (
  id uuid primary key,
  service_id uuid not null references family_services(id),
  owner_user_id uuid not null references users(id),
  family_type text not null,
  status family_status not null,
  period family_period not null,
  max_members int not null,
  active_members_count int not null,
  has_been_full boolean not null default false,
  total_price_kzt int not null,
  member_share_kzt int not null,
  rounding_delta_kzt int not null,
  payment_day int not null,
  next_payment_date date not null,
  description text,
  owner_rules text,
  price_updated_at timestamptz,
  closing_started_at timestamptz,
  closes_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
)
```

Индексы:

```sql
create index families_search_idx
  on families(service_id, period, status, next_payment_date);

create index families_owner_idx
  on families(owner_user_id, status);

create index families_discovery_idx
  on families(family_type, created_at desc)
  where status = 'active';
```

Правила:

- `active_members_count <= max_members`;
- `max_members <= 8`;
- `payment_day between 1 and 31`;
- `member_share_kzt % 50 = 0`;
- `rounding_delta_kzt = member_share_kzt * max_members - total_price_kzt`;
- сервис, период и вместимость не меняются после создания;
- максимум две активные семьи владельца проверяется транзакцией с блокировкой
  владельца;
- `status = full`, когда `active_members_count = max_members`;
- `status = active`, когда место освободилось и семья не закрывается.

## family_payment_requisites

```sql
family_payment_requisites (
  id uuid primary key,
  family_id uuid not null unique references families(id),
  bank text not null,
  encrypted_phone text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
)
```

Правила:

- `bank in ('kaspi', 'halyk', 'freedom', 'jusan')`;
- номер карты и IBAN не принимаются;
- телефон хранится только как зашифрованный платежный реквизит владельца;
- реквизит не используется для входа, поиска или связи.

## family_members

```sql
family_members (
  id uuid primary key,
  family_id uuid not null references families(id),
  user_id uuid not null references users(id),
  role family_member_role not null,
  status family_member_status not null,
  joined_at timestamptz not null,
  access_provided_at timestamptz,
  access_confirmed_at timestamptz,
  removal_scheduled_at timestamptz,
  removal_acknowledged_at timestamptz,
  removal_cancel_requested_at timestamptz,
  left_at timestamptz,
  removed_at timestamptz,
  cancelled_at timestamptz,
  closing_acknowledged_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
)
```

Индексы:

```sql
create unique index family_one_owner_idx
  on family_members(family_id)
  where role = 'owner';

create unique index family_active_member_unique_idx
  on family_members(family_id, user_id)
  where status in (
    'awaiting_access',
    'awaiting_confirmation',
    'payment_due',
    'active',
    'removal_pending'
  );

create index family_members_user_idx
  on family_members(user_id, status);

create index family_members_family_status_joined_idx
  on family_members(family_id, status, joined_at);
```

Правила:

- владелец создается вместе с семьей;
- активные статусы участвуют в `active_members_count`;
- терминальные статусы остаются для истории.

## family_requests

```sql
family_requests (
  id uuid primary key,
  family_id uuid not null references families(id),
  user_id uuid not null references users(id),
  status family_request_status not null,
  cancel_reason family_request_cancel_reason,
  created_at timestamptz not null,
  expires_at timestamptz not null,
  decided_at timestamptz,
  cancelled_at timestamptz,
  expired_at timestamptz
)
```

Индексы:

```sql
create unique index family_pending_request_unique_idx
  on family_requests(family_id, user_id)
  where status = 'pending';

create index family_requests_owner_queue_idx
  on family_requests(family_id, status, created_at);

create index family_requests_user_idx
  on family_requests(user_id, status, created_at);
```

Финальный запрет после отказа:

```sql
family_request_restrictions (
  family_id uuid not null references families(id),
  user_id uuid not null references users(id),
  reason text not null,
  created_at timestamptz not null,
  primary key (family_id, user_id)
)
```

Правила транзакций:

- перед созданием заявки проверить отсутствие `family_request_restrictions`;
- перед созданием заявки проверить не больше двух `cancelled/user_cancelled` в
  эту семью;
- перед созданием заявки проверить не больше трех `pending` заявок пользователя
  на тот же сервис;
- при `rejected` вставить запись в `family_request_restrictions`;
- при заполнении семьи отменить остальные `pending` заявки с `family_full`;
- job истечения заявок переводит просроченные `pending` в `expired`.

Ограничение на три заявки на сервис требует транзакционной проверки, потому что
сервис находится через `families.service_id`.

## family_payments

```sql
family_payments (
  id uuid primary key,
  family_id uuid not null references families(id),
  member_id uuid not null references family_members(id),
  kind family_payment_kind not null,
  status family_payment_status not null,
  amount_kzt int not null,
  period family_period not null,
  period_start date not null,
  period_end date not null,
  due_at timestamptz not null,
  requisites_opened_at timestamptz,
  reported_paid_at timestamptz,
  confirmed_paid_at timestamptz,
  overdue_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null,
  updated_at timestamptz not null
)
```

Индексы:

```sql
create unique index family_payment_unique_period_idx
  on family_payments(member_id, period_start, period_end, kind);

create index family_payments_due_idx
  on family_payments(status, due_at);

create index family_payments_member_idx
  on family_payments(member_id, status);

create index family_payments_family_status_due_idx
  on family_payments(family_id, status, due_at);
```

Правила:

- `amount_kzt > 0`;
- первый платеж получает `due_at = requisites_opened_at + interval '30 minutes'`;
- регулярные платежи переходят в `overdue` через 24 часа после даты оплаты;
- `paid` ставится только действием владельца;
- участник самостоятельно создает не больше одного ближайшего будущего
  `prepaid` периода;
- владелец после договоренности может записать несколько оплаченных периодов;
- будущий `scheduled` платеж становится `cancelled` при выходе, удалении или
  закрытии семьи, а причина остается в `cancel_reason`.

## Предупреждения жизненного цикла

Правила:

- удаление хранится в `family_members.removal_scheduled_at` и выполняется через
  12 часов, если владелец не отозвал решение;
- подтверждение предупреждения хранится в `removal_acknowledged_at` и не
  останавливает удаление;
- просьба участника об отмене хранится в `removal_cancel_requested_at`, но
  отменить удаление может только владелец;
- подтверждение предупреждения о закрытии хранится в
  `family_members.closing_acknowledged_at`;
- закрытие семьи длится 3 календарных дня;
- отсутствие подтверждения участника не продлевает срок закрытия;
- бот напоминает участнику ежедневно до подтверждения.

## notification_jobs

```sql
notification_jobs (
  id uuid primary key,
  recipient_user_id uuid not null references users(id),
  event_type text not null,
  payload jsonb not null,
  status notification_status not null,
  available_at timestamptz not null,
  attempts int not null,
  sent_at timestamptz,
  failed_at timestamptz,
  error text,
  created_at timestamptz not null,
  updated_at timestamptz not null
)
```

Индексы:

```sql
create index notification_jobs_dispatch_idx
  on notification_jobs(status, available_at);

create index notification_jobs_recipient_event_status_idx
  on notification_jobs(recipient_user_id, event_type, status);
```

Правила:

- бизнес-модули создают jobs, но отправка не меняет бизнес-состояние;
- повторная отправка допускается для failed jobs;
- критичные уведомления нельзя отключить.

## family_audit_logs

```sql
family_audit_logs (
  id uuid primary key,
  family_id uuid not null references families(id),
  actor_user_id uuid references users(id),
  target_user_id uuid references users(id),
  target_member_id uuid references family_members(id),
  target_request_id uuid references family_requests(id),
  target_payment_id uuid references family_payments(id),
  action text not null,
  old_status text,
  new_status text,
  details jsonb not null,
  created_at timestamptz not null
)
```

Индекс:

```sql
create index family_audit_logs_family_idx
  on family_audit_logs(family_id, created_at);

create index family_audit_action_created_idx
  on family_audit_logs(action, created_at);
```

Правила:

- audit log append-only;
- не удалять события при закрытии семьи;
- не хранить в payload незашифрованные платежные телефоны.

## idempotency_records

```sql
idempotency_records (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  operation text not null,
  idempotency_key text not null,
  request_hash text not null,
  resource_type text,
  resource_id uuid,
  created_at timestamptz not null,
  unique (user_id, operation, idempotency_key)
)
```

The backend writes the idempotency record and domain resource in the same
transaction. The table is denied to Supabase client roles and can later be
reused by Marketplace operations.

## Транзакционные сценарии

### Одобрение заявки

1. Заблокировать строку `families` по `family_id`.
2. Проверить статус и наличие места.
3. Заблокировать `family_requests` по `request_id`.
4. Проверить `status = 'pending'`.
5. Создать `family_members(awaiting_access)`.
6. Перевести request в `approved`.
7. Увеличить `active_members_count`.
8. Если семья стала полной, перевести `families.status = 'full'`.
9. Отменить остальные `pending` заявки с `family_full`.
10. Создать audit events и notification jobs.

### Подтверждение доступа участником

1. Заблокировать `family_members`.
2. Проверить `status = 'awaiting_confirmation'`.
3. Перевести member в `payment_due`.
4. Создать `family_payments(kind='first', status='due')`.
5. Установить `due_at = now() + 30 minutes`.
6. Открыть реквизиты только в ответе этому участнику.
7. Создать audit event.

### Подтверждение оплаты владельцем

1. Заблокировать `family_payments`.
2. Проверить `status = 'payment_reported'`.
3. Перевести payment в `paid`.
4. Если member был `payment_due`, перевести его в `active`.
5. Остановить reminders.
6. Уведомить участника.
7. Создать audit event.
