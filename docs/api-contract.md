# API контракт MVP

API строится вокруг команд Family Engine. Названия приведены как REST-черновик.
При реализации нужно сгенерировать OpenAPI и frontend-типы из backend-схем.

## Общие правила

- Все запросы идут от Telegram Mini App пользователя.
- Backend проверяет Telegram init data.
- Пользователь без Telegram username получает `USERNAME_REQUIRED`.
- Ошибки бизнес-правил возвращаются кодами, пригодными для UI.
- Платежные реквизиты возвращаются только после подтверждения доступа
  участником.

## Error codes

```text
USERNAME_REQUIRED
SERVICE_NOT_ACTIVE
FAMILY_NOT_FOUND
FAMILY_FULL
FAMILY_CLOSING
OWNER_ACTIVE_FAMILY_LIMIT_REACHED
INVALID_CAPACITY
INVALID_PERIOD
REQUEST_ALREADY_PENDING
REQUEST_REJECTED_PREVIOUSLY
REQUEST_SELF_CANCEL_LIMIT_REACHED
SERVICE_ACTIVE_REQUEST_LIMIT_REACHED
REQUEST_EXPIRED
REQUEST_NOT_PENDING
MEMBER_NOT_AWAITING_ACCESS
MEMBER_NOT_AWAITING_CONFIRMATION
PAYMENT_NOT_DUE
PAYMENT_NOT_REPORTED
PAYMENT_ALREADY_PAID
FORBIDDEN
```

## Identity

### GET /api/me

Возвращает текущего пользователя.

Если username отсутствует:

```json
{
  "ok": false,
  "error": "USERNAME_REQUIRED",
  "message": "Создайте username в Telegram и снова откройте SubsMarket."
}
```

### PATCH /api/me/refresh-telegram-profile

Обновляет имя, username и фото из Telegram init data.

## Telegram Bot

### POST /api/telegram/webhook

Webhook endpoint для Telegram Bot API.

Headers:

- `X-Telegram-Bot-Api-Secret-Token` должен совпадать с
  `TELEGRAM_WEBHOOK_SECRET` в production.

Текущее поведение:

- private `/start` отправляет короткое описание SubsMarket и кнопку Mini App;
- другие private text messages получают то же помогающее сообщение;
- group updates игнорируются;
- бот не меняет product state. Бизнес-логика остается в Mini App и Family
  Engine.

## Catalog

### GET /api/catalog/family-services

Public read-only catalog endpoint.

Query:

- `category`;
- `family_type=subscription|tariff`;
- `status=active`.

Возвращает проверенные сервисы для создания и поиска семей.

## Families

### GET /api/families

Персонализированный поиск семей. Требует Telegram-аутентификацию.

Query:

- `family_type=subscription|tariff`.
- `limit=1..100`, default `50`.
- `offset=0..100000`, default `0`.

Pagination rule: list endpoints use `limit + offset` and keep server-side
caps. Clients should request the next page only after receiving a full page.

Cursor pages are available for high-volume screens and should be preferred by
new clients. They return:

```json
{
  "items": [],
  "next_cursor": "opaque-token-or-null"
}
```

The cursor is an opaque bookmark. Clients must send it back unchanged as
`cursor=<value>` to fetch the next page.

Cursor endpoints:

- `GET /api/families/page`;
- `GET /api/families/me/page`;
- `GET /api/families/payments/me/page`;
- `GET /api/families/requests/me/page`;
- `GET /api/families/{family_id}/requests/page`;
- `GET /api/families/{family_id}/members/page`;
- `GET /api/families/members/{member_id}/payments/page`;
- `GET /api/families/{family_id}/audit-log/page`.

Backend исключает:

- закрытые семьи;
- заполненные семьи;
- собственные семьи пользователя;
- семьи, где пользователь уже является активным участником;
- семьи с активной заявкой пользователя;
- семьи, где владелец уже отказал этому кандидату;
- семьи, где нет свободных мест;
- семьи в статусе `closing`.

### POST /api/families

Header `Idempotency-Key` is supported and used by the Mini App. Repeating the
same key with the same body returns the originally created family. Reusing the
key with a different body returns `409 IDEMPOTENCY_KEY_REUSED`.

The Mini App also sends `Idempotency-Key` for critical state transitions:

- `POST /api/families/{family_id}/close`;
- `POST /api/families/members/{member_id}/access-provided`;
- `POST /api/families/members/{member_id}/access-confirmed`;
- `POST /api/families/members/{member_id}/remove`;
- `POST /api/families/payments/{payment_id}/report-paid`;
- `POST /api/families/payments/{payment_id}/confirm`.

A network retry with the same user, operation, target, and key returns the
original resource. The backend does not create duplicate payments,
notifications, removal timers, or family-closing windows.

Создать семью подписки или семью тарифа.

Body:

```json
{
  "service_id": "uuid",
  "period": "monthly",
  "max_members": 6,
  "total_price_kzt": 3800,
  "payment_day": 15,
  "next_payment_date": "2026-07-18",
  "description": "Семья YouTube Premium",
  "owner_rules": "Оплата вовремя",
  "payment_bank": "kaspi",
  "payment_phone": "+77001234567"
}
```

Backend:

- проверяет сервис и период;
- проверяет лимит двух активных семей владельца;
- рассчитывает `member_share_kzt` и `rounding_delta_kzt`;
- создает `Family`;
- создает владельца как `FamilyMember(owner, active)`;
- шифрует платежный номер.

### GET /api/families/{family_id}

Requires verified Telegram user auth. This endpoint is not public in
production; unauthenticated requests must fail before returning a family card.

Возвращает карточку семьи.

До заявки:

- сервис;
- период;
- общая цена;
- доля;
- вместимость;
- счетчик `3 из 6`;
- свободные места;
- описание;
- правила владельца;
- дата оплаты;
- дата создания;
- имя и фото владельца;
- без username владельца;
- без участников;
- без реквизитов.

Публичный endpoint не возвращает username владельца.

### GET /api/families/{family_id}/view

Персонализированная карточка семьи.

- до заявки `owner_username = null`;
- при `pending`/`approved` заявке или активном членстве возвращает username;
- после `rejected`, `cancelled` или `expired` снова скрывает username.

### GET /api/families/invites/{code}

Resolves an active 8-digit family invite and returns the personalized
`FamilyViewOut`. The family may be hidden from general search. A code never
bypasses the normal join-request and owner-approval flow.

Errors:

- `400 INVALID_FAMILY_INVITE_CODE`;
- `404 FAMILY_INVITE_NOT_FOUND`;
- `409 FAMILY_INVITE_NOT_ACCEPTING` when the family is full;
- `410 FAMILY_INVITE_INACTIVE` after rotation, disabling, or family closing.

Lookup attempts are rate limited. The limiter covers valid and invalid code
shapes so invalid-code enumeration cannot bypass the counter.

### GET /api/families/{family_id}/audit-log

Returns family action history for the family owner or a family member.
Accepts optional `limit` query parameter, default `50`, minimum `1`, maximum `100`.
Accepts optional `offset` query parameter, default `0`, minimum `0`, maximum `100000`.

Each event contains:

- `action`;
- `actor_user_id`;
- `target_user_id`;
- `target_member_id`;
- `target_request_id`;
- `target_payment_id`;
- `old_status`;
- `new_status`;
- `details`;
- `created_at`.

`details` must not contain plaintext payment phone numbers.

### PATCH /api/families/{family_id}/description

Редактировать описание семьи.

### PATCH /api/families/{family_id}/price

Изменить общую стоимость на будущий период.

Правила:

- только владелец;
- не чаще одного раза в календарный месяц;
- уже созданные платежи не меняются;
- уведомить всех участников.

### PATCH /api/families/{family_id}/payment-day

Изменить дату оплаты.

Правила:

- только владелец;
- только пока семья ни разу не была полной.

### PATCH /api/families/{family_id}/visibility

Owner-only. Sets `is_search_visible`. Hidden families remain available through
an active invite code.

### Family invite management

- `GET /api/families/{family_id}/invite` returns the active code to the owner;
- `POST /api/families/{family_id}/invite` creates or returns the active code;
- `POST /api/families/{family_id}/invite/rotate` revokes the old code and
  creates a new one;
- `POST /api/families/{family_id}/invite/disable` revokes the active code.

Codes contain exactly 8 digits. Closing a family hides it from search and
revokes its active code in the same transaction.

### POST /api/families/{family_id}/close

Запустить закрытие семьи.

Backend:

- переводит семью в `closing`;
- устанавливает `closes_at = now + 3 calendar days`;
- отменяет прием новых заявок;
- отменяет будущие `scheduled` платежи и их неотправленные напоминания;
- создает уведомления всем участникам;
- создает acknowledgements.

### POST /api/families/{family_id}/acknowledge-closing

Участник подтверждает, что понял предупреждение о закрытии.

## Family requests

### POST /api/families/{family_id}/requests

Header `Idempotency-Key` is supported and used by the Mini App. A network retry
with the same key returns the original request instead of creating a duplicate.

Отправить заявку.

Backend проверяет:

- семья видима и принимает заявки;
- нет pending заявки в эту семью;
- нет отказа в этой семье;
- не исчерпан лимит двух самостоятельных отмен;
- не превышен лимит трех pending заявок на этот сервис.

Ошибка при четвертой активной заявке:

```json
{
  "error": "SERVICE_ACTIVE_REQUEST_LIMIT_REACHED",
  "message": "У вас уже 3 активные заявки на YouTube. Дождитесь ответа или отмените одну заявку."
}
```

### GET /api/families/requests/me

Query:

- `limit=1..100`, default `50`.
- `offset=0..100000`, default `0`.

Список заявок пользователя.

Каждая заявка содержит краткие данные семьи для карточки UI:

- `family_type`;
- `service_name`;
- `service_variant`.
- `owner_username` только для `pending`/`approved` заявки.

Статусы UI:

- `pending` -> `Ожидает ответа владельца`;
- `approved` -> `Принята`;
- `rejected` -> `Отклонена`;
- `cancelled/family_full` -> `Семья заполнена`;
- `expired` -> `Истекла`.

### GET /api/families/{family_id}/requests

Query:

- `limit=1..100`, default `50`.
- `offset=0..100000`, default `0`.

Список заявок владельца.

Sort:

- `created_at asc`.

### POST /api/families/requests/{request_id}/approve

Одобрить заявку.

Backend:

- транзакционно проверяет место;
- создает `FamilyMember(awaiting_access)`;
- переводит заявку в `approved`;
- если семья стала полной, отменяет остальные pending с `family_full`;
- уведомляет кандидата.

### POST /api/families/requests/{request_id}/reject

Отклонить заявку без причины.

Backend:

- переводит заявку в `rejected`;
- создает `family_request_restrictions`;
- уведомляет кандидата текстом:
  `Заявка отклонена. Вы можете отправить заявку в другую семью.`

### POST /api/families/requests/{request_id}/cancel

Кандидат отменяет `pending` заявку.

Backend:

- переводит заявку в `cancelled/user_cancelled`;
- уведомляет владельца текстом `{name} отменил заявку.`

## Family members

### GET /api/families/me

Query:

- `limit=1..100`, default `50`.
- `offset=0..100000`, default `0`.

Семьи пользователя как владельца и участника.

### GET /api/families/{family_id}/members

Owner-only member list.

Query:

- `limit=1..100`, default `50`.
- `offset=0..100000`, default `0`.

### GET /api/families/{family_id}/payments

Owner-only batch payment list grouped by family member. Use this endpoint for
owner screens instead of one request per member.

Query:

- `limit_per_member=1..50`, default `20`.
- `member_limit=1..100`, default `50`.
- `member_offset=0..100000`, default `0`.

Each item contains:

- `member_id`;
- `payments[]`.

### POST /api/families/members/{member_id}/cancel-before-access

Отменить вступление до выдачи доступа.

Доступно:

- владельцу;
- самому участнику.

Backend:

- проверяет `status = awaiting_access`;
- переводит member в `cancelled_before_access`;
- освобождает место;
- если отменил владелец, уведомляет кандидата;
- платежи и реквизиты не создаются.

### POST /api/families/members/{member_id}/access-provided

Владелец отмечает, что доступ выдан.

Backend:

- переводит member в `awaiting_confirmation`;
- уведомляет участника.

### POST /api/families/members/{member_id}/remind-access-confirmation

Владелец повторно напоминает участнику подтвердить доступ.

Backend:

- доступно только владельцу семьи;
- требует `status = awaiting_confirmation`;
- ограничивает ручные напоминания интервалом 10 минут;
- не меняет статус и не освобождает место;
- создает уведомление и audit event.

### POST /api/families/members/{member_id}/access-confirmed

Участник подтверждает доступ.

Backend:

- переводит member в `payment_due`;
- создает первый `FamilyPayment(due)`;
- открывает реквизиты в ответе;
- запускает 30-минутный срок.

Response:

```json
{
  "payment_id": "uuid",
  "amount_kzt": 650,
  "deadline_at": "2026-06-16T12:30:00Z",
  "requisite": {
    "bank": "kaspi",
    "phone": "+77001234567"
  }
}
```

### POST /api/families/members/{member_id}/leave

Участник выходит сам.

Backend:

- освобождает место сразу;
- отменяет будущие платежи;
- не пересчитывает оплаченные суммы.

### POST /api/families/members/{member_id}/remove

Владелец запускает удаление.

Backend:

- переводит member в `removal_pending`;
- создает 12-часовое предупреждение;
- уведомляет участника.

### POST /api/families/members/{member_id}/acknowledge-removal

Кнопка `Понятно`. Backend фиксирует, что участник увидел предупреждение. Место
остается занятым, платежи не отменяются, 12-часовой срок продолжает идти.

### POST /api/families/members/{member_id}/request-removal-cancellation

Участник просит владельца отменить удаление. Запрос уведомляет владельца, но не
останавливает срок и сам по себе не отменяет удаление.

### POST /api/families/members/{member_id}/revoke-removal

Только владелец отменяет удаление до выполнения.

## Payments

### GET /api/families/payments/me

Query:

- `limit=1..100`, default `50`.
- `offset=0..100000`, default `0`.

Платежи пользователя.

Отмененный будущий платеж содержит:

- `status = cancelled`;
- `cancelled_at`;
- `cancel_reason = member_left|member_removed|family_closing|family_closed`.

### GET /api/families/members/{member_id}/payments

Member payment history. Available to the member and to the family owner.

Query:

- `limit=1..100`, default `50`.
- `offset=0..100000`, default `0`.

### POST /api/families/members/{member_id}/prepayments

Активный участник создает один ближайший будущий период в состоянии `due`.
Повторно создать следующий период нельзя, пока семейный календарь не перейдет
дальше. После перевода используются обычные `Оплатил` и подтверждение владельца.

### POST /api/families/members/{member_id}/prepayments/record-paid

Владелец после договоренности вручную отмечает несколько будущих периодов.

Body:

```json
{
  "periods": 3
}
```

Для месячной семьи доступно до 12 периодов за действие, для годовой - до 3.
Каждый период хранится отдельным `FamilyPayment(kind=prepaid, status=paid)`.

### POST /api/families/payments/{payment_id}/report-paid

Участник нажимает `Оплатил`.

Backend:

- переводит payment в `payment_reported`;
- останавливает напоминания участнику;
- уведомляет владельца сразу, через 10, 20, 40 минут и затем раз в сутки.

### POST /api/families/payments/{payment_id}/cancel-report

Участник отменяет ошибочное `Оплатил` до подтверждения владельцем.

### POST /api/families/payments/{payment_id}/confirm

Владелец подтверждает получение.

Backend:

- переводит payment в `paid`;
- если первый платеж, переводит member в `active`;
- уведомляет участника `Владелец подтвердил оплату.`

### POST /api/families/payments/{payment_id}/not-received

Владелец нажимает `Не получил оплату`.

Backend:

- переводит payment в `due`;
- уведомляет участника:
  `Владелец не подтвердил получение оплаты. Проверьте перевод или свяжитесь с владельцем.`

## Jobs

Эти операции запускаются планировщиком, а не пользователем:

- `expire_pending_family_requests`;
- `send_access_confirmation_reminders`;
- `mark_first_payments_overdue`;
- `mark_regular_payments_overdue`;
- `send_payment_reminders`;
- `send_owner_payment_confirmation_reminders`;
- `execute_member_removals`;
- `close_due_families`;
- `send_closing_acknowledgement_reminders`.

### POST /api/internal/jobs/run-due

Requires `X-Internal-Job-Token` outside development.

Each due-job step is committed separately. If one step fails, the failed step is
rolled back, later steps continue, and the response includes:

- `job_errors[].step`;
- `job_errors[].error_type`;
- `job_errors[].message`.

When there are no failures, `job_errors` is an empty list.

### GET /api/internal/jobs/status

Protected by `X-Internal-Job-Token`.

Returns background health counters:

- notification queue counts by status;
- stale due notifications;
- notification failures from the last 24 hours;
- due Family Engine backlog counts;
- recent notification failure samples without user profiles, message text, or
  payment requisites.

`status` is `ok` when there are no warnings and `attention` when the backend
sees stale notifications, recent notification failures, or backlog that exceeds
one configured processing capacity.
