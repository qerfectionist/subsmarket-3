# SubsMarket Mini App UX Audit

Date: 2026-06-26

Scope: current local Telegram Mini App flow for family subscriptions:
Home -> Search -> Create family -> Owner workspace -> Family details -> Member request -> Requests -> Owner approval queue.

Evidence folder: `docs/product-design-audit/screenshots/`

## Captured Flow

1. `01-home.png` — Home screen. Health: mixed.
2. `02-search-empty.png` — Search empty state and invite code. Health: needs work.
3. `03-create-step-service.png` — Create family first step. Health: partial.
4. `04-create-step-details-filled.png` — Create family filled review-ish state. Health: weak on mobile layout.
5. `05-owner-my-family.png` — Owner "My families" workspace. Health: crowded.
6. `06-owner-family-details.png` — Owner detail page with invite block. Health: too long, but useful.
7. `07-member-family-details-before-request.png` — Member detail page before request. Health: strong concept, heavy execution.
8. `08-member-request-sent.png` — Member state after sending request. Health: okay, needs clearer next action.
9. `09-member-requests.png` — Member requests list. Health: clear.
10. `10-owner-pending-request.png` — Owner pending request workspace. Health: functional, too dense.

## Top Findings

### 1. Bottom navigation blocks important content

Evidence: `02-search-empty.png`, `05-owner-my-family.png`, `10-owner-pending-request.png`.

The bottom nav floats over content and hides text/cards/buttons in several full-page screenshots. This makes the app feel broken even when the flow works.

Recommendation:
- Add bottom padding to every scrollable screen equal to nav height + safe area.
- Avoid placing critical CTAs or explanatory cards under the nav.
- Keep the nav fixed, but reserve space for it.

Priority: high.

### 2. Dev mode takes too much of every screen

Evidence: all screenshots.

The dev user switch occupies the first 170-200px of the mobile viewport. For real users this will disappear, but right now screenshots and local testing make the product look worse than it is.

Recommendation:
- Hide dev switch behind a compact "Dev" chip or collapse it by default.
- Add a production-like preview mode for design review.

Priority: medium for dev, high for design review accuracy.

### 3. Home screen has a good trust story, but too many entry points

Evidence: `01-home.png`.

The core message is good: find a family, access first, pay after. But the screen repeats several actions: hero buttons, step cards, stats, and six navigation cards. A new user can understand the idea, but the next best action is less sharp than it should be.

Recommendation:
- Keep one primary CTA: "Найти семью".
- Keep one secondary CTA: "Создать семью".
- Move lower cards into a simpler "Что можно сделать" section with 3 items max.
- Stats with zero values should not dominate the first session.

Priority: high.

### 4. Search empty state explains too much before offering action

Evidence: `02-search-empty.png`.

The invite code card is useful. The empty-state explanation is also useful, but the numbered explanation cards are squeezed under the floating nav and feel like a wall.

Recommendation:
- Make invite code a compact top card.
- If no families exist, show one sentence and one CTA.
- Move "why list is empty" into expandable helper text.

Priority: high.

### 5. Create family wizard has cramped two-column form layout

Evidence: `04-create-step-details-filled.png`.

The form uses two columns on a 390px viewport. Labels wrap, fields become narrow, and the user has to scan left-right-down-left. This is not Telegram-native. Mobile forms should mostly be one column.

Recommendation:
- Use one-column form fields on mobile.
- Keep the price/share preview sticky near the top.
- Make stepper horizontal chips or compact progress text: "Шаг 4 из 4".
- Put "Создать семью" as the Telegram MainButton or full-width bottom CTA, not a small left-aligned button.

Priority: high.

### 6. Owner workspace mixes management, settings, and member operations

Evidence: `05-owner-my-family.png`, `10-owner-pending-request.png`.

Owner sees card, stats, settings, close family, description, price, payment date, then tabs/actions. It works, but it asks the owner to mentally parse too much.

Recommendation:
- Split owner workspace into clear blocks:
  - "Нужно сделать" — pending requests, payments, access confirmations.
  - "Семья" — members, free slots, invite code.
  - "Настройки" — price, date, description, closing.
- Put dangerous action "Закрыть семью" lower, inside a destructive settings section.

Priority: high.

### 7. Family detail page has the right trust sequence, but action is too low

Evidence: `07-member-family-details-before-request.png`.

The "Порядок сделки" section is excellent for trust. But the primary action "Отправить заявку" appears after a lot of content, so a motivated user has to scroll.

Recommendation:
- Put a compact sticky action area above the fold:
  - member share
  - free slots
  - owner username
  - "Отправить заявку"
- Keep "Порядок сделки" below as trust education.
- Use progressive disclosure for description/rules if long.

Priority: high.

### 8. Request sent state needs a stronger "what now"

Evidence: `08-member-request-sent.png`, `09-member-requests.png`.

The request list is clear and "Написать владельцу" is a good action. But the detail screen after sending request could more clearly say: "Теперь напишите владельцу в Telegram".

Recommendation:
- After request sent, show a success panel:
  - "Заявка отправлена"
  - "Следующий шаг: напишите владельцу"
  - primary button "Написать владельцу"
  - secondary "Мои заявки"

Priority: medium-high.

### 9. Visual style is close to Telegram-native, but typography is inconsistent

Evidence: all screenshots.

Some headings are very bold and large, while form labels/cards use smaller grey text. This creates a playful look, but not always enough hierarchy.

Recommendation:
- Define 4 text styles only: screen title, section title, body, caption.
- Reduce heavy bold usage inside dense owner/settings screens.
- Keep bold for primary decisions and money.

Priority: medium.

### 10. Card imagery placeholder looks broken

Evidence: `05-owner-my-family.png`, `07-member-family-details-before-request.png`.

The black decorative line/placeholder at the top of family cards looks like a failed image load or rendering artifact.

Recommendation:
- Replace with a clean service logo/avatar area.
- For service cards: use logo + color accent, no fake image banner.

Priority: medium-high.

## Accessibility Risks From Screenshots

These are visual risks only; full accessibility requires keyboard/screen-reader testing.

1. Contrast risk: grey text on light blue/grey cards may be too low in several helper captions.
2. Touch target risk: dense form fields and buttons in `04-create-step-details-filled.png` are close together.
3. Focus order risk: two-column mobile form may create confusing reading/focus order.
4. Fixed nav risk: content hidden under nav can block users with zoom or larger text.
5. Motion/Telegram UI risk: overlays and floating nav need testing with reduced motion and screen readers.

## Recommended Redesign Direction

Use Telegram-native, not a generic website:

- One screen = one main job.
- Main CTA visible above the fold.
- Bottom nav never covers content.
- Owner mode separates "tasks" from "settings".
- Member mode emphasizes trust sequence:
  "Заявка -> чат -> доступ -> оплата -> подтверждение".
- Cards should be smaller and more scannable.
- Payment/safety rules should appear at the exact moment they matter, not as long text everywhere.

## Suggested Next Design Tasks

1. Redesign Home + Search as a tighter Telegram-native flow.
2. Redesign Family Detail for candidate: action above the fold, trust sequence below.
3. Redesign Owner Workspace around task queue first, settings second.
4. Redesign Create Family wizard as one-column mobile form.
5. After visual direction is chosen, implement only the selected flow.

## Limits

This audit used screenshots from a local demo flow. It did not test:

- Real Telegram WebApp shell inside Telegram.
- Real screen reader behavior.
- Keyboard-only navigation.
- Network latency and loading states under slow connection.
- Real production data density with many families/requests.
