# Telegram Mini App plan

This document records the Telegram Mini App rules that affect SubsMarket UI and
runtime behavior.

## Platform assumptions

- SubsMarket frontend is a web app opened inside Telegram WebView.
- The Mini App is always launched through a Telegram bot.
- The backend must trust only verified Telegram `initData`.
- Local browser development may use demo Telegram users, but production must
  require `X-Telegram-Init-Data`.

## Frontend rules

- Load the official Telegram WebApp script in `frontend/index.html`.
- On startup call `Telegram.WebApp.ready()` and `expand()`.
- Use Telegram theme values for app background, surfaces, text, accent buttons,
  bottom bar, and destructive actions.
- Respect viewport and safe-area values for top padding and bottom navigation.
- Use Telegram BackButton on internal screens:
  - hidden on `Главная`;
  - visible on search/create/mine/requests/details;
  - details screen returns to the tab that opened it.
- Use haptic feedback only on important interactions:
  - selection for tab/action start;
  - success after completed action;
  - error after failed action.
- Keep the in-app bottom navigation because SubsMarket has multiple permanent
  product sections. Telegram MainButton can be added later for single final
  actions, such as submitting a multi-step create form.

## Backend rules

- Verify Telegram `initData` with bot token HMAC.
- Reject missing, invalid, or expired init data in production.
- Limit accepted `initData` age to one day.
- Use Telegram profile fields only:
  - `id`;
  - `username`;
  - `first_name`;
  - `last_name`;
  - `photo_url`.
- Do not store user phone numbers from Telegram.
- Require username before allowing family actions.

## Bot entrypoint

- The bot is a thin entrypoint, not a second product UI.
- `/start` sends a short SubsMarket intro and a Mini App button.
- Telegram webhooks are received at `/api/telegram/webhook`.
- Production webhook requests must include `X-Telegram-Bot-Api-Secret-Token`
  matching `TELEGRAM_WEBHOOK_SECRET`.
- Set the production webhook from the backend environment:

```powershell
python -m subsmarket.bot.set_webhook
```

## Current implementation

- `frontend/src/telegram.ts` owns Telegram WebApp integration.
- `frontend/src/api.ts` sends `X-Telegram-Init-Data` when available.
- `backend/src/subsmarket/identity/telegram.py` validates `initData`.
- `backend/tests/test_identity_telegram.py` covers valid and expired init data.
- `backend/src/subsmarket/bot/api.py` receives Telegram bot webhook updates.
- `backend/src/subsmarket/bot/set_webhook.py` sets the production webhook.

## Sources

- Official Telegram Web Apps docs:
  `https://core.telegram.org/bots/webapps`
- Official Telegram Bot API docs:
  `https://core.telegram.org/bots/api`
- Telegram Mini Apps platform docs:
  `https://docs.telegram-mini-apps.com/platform/init-data`
  and `https://docs.telegram-mini-apps.com/platform/viewport`

## Product boundaries

- Family subscriptions and family tariffs use the Family Engine.
- Mobile-data sales use the implemented Marketplace Engine; account sales will
  use the same domain boundary when added.
- Marketplace listings must not reuse family membership, recurring payment, or
  family audit state machines.
