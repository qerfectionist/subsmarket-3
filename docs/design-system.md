# SubsMarket Design System

Date: 2026-06-28

Status: draft, source of truth for the next UI reset.

## Purpose

SubsMarket needs to feel like a finished Telegram Mini App before launch. This
document defines the visual and UX rules for the MVP so screens stop drifting
from one another.

The design system is not decoration. It protects three things:

- users understand what to do in the first 10 seconds;
- family subscriptions and family tariffs stay clear and trustworthy;
- future modules, accounts and gigabytes, can be added later without breaking
  the main product.

## Product Personality

SubsMarket should feel like:

- a calm service utility;
- a lightweight finance app;
- a Telegram-native control panel;
- a place where strangers can coordinate without confusion.

SubsMarket should not feel like:

- a landing page;
- a crypto app;
- a casino-style marketplace;
- a colorful catalog where every block fights for attention;
- an admin panel for developers.

## UX Principles

### 1. One Screen, One Main Job

Every screen must answer:

- what is happening;
- what the user should do next;
- what can wait.

If a block does not help the current screen job, remove it.

### 2. Trust Before Beauty

The app handles money coordination between strangers. The interface should be
plain, predictable, and calm. Fancy UI is less important than clear hierarchy.

### 3. No Hidden Critical State

Pending requests, access waiting, payment due, and owner confirmation must be
visible without hunting through the app.

### 4. Marketplace Later

Accounts and gigabytes may appear on Home as future modules, but they must not
look equally active until those engines are ready.

### 5. Mobile App, Not Website

The Mini App should use compact mobile flows:

- stable bottom navigation;
- short titles;
- native-feeling lists;
- no marketing hero sections;
- no long scroll on Home;
- no horizontal overflow;
- no page bounce where it feels broken.

## Foundation

### UI Stack

Current implementation stack:

- `@worldcoin/mini-apps-ui-kit-react` for base UI primitives;
- `lucide-react` for line icons;
- custom CSS tokens in `frontend/src/styles/tokens.css`;
- app-level styles in `frontend/src/styles.css`;
- Telegram native APIs in `frontend/src/telegram.ts`.

Rules:

- do not mix multiple visual libraries on one screen;
- use World UI Kit primitives when they fit;
- use custom CSS only to create SubsMarket-specific layout and states;
- use one icon family only: Lucide;
- use real service logos only for services, not for generic controls.

### Platform Behavior

The app must respect Telegram Mini App behavior:

- use safe-area padding;
- keep bottom navigation visible;
- use Telegram BackButton on inner screens;
- use Telegram MainButton only when a screen has one obvious primary action;
- use native confirmation for destructive actions;
- avoid full-page web-like scroll where a native app would use compact groups.

## Tokens

Design tokens should live in `frontend/src/styles/tokens.css`. Avoid hardcoded
colors and spacing in components unless there is a documented exception.

### Color Roles

Use semantic roles, not random colors.

| Role | Token | Use |
| --- | --- | --- |
| App background | `--app-bg` | Page background |
| Surface | `--app-surface` | Cards, list groups, panels |
| Secondary surface | `--app-secondary-bg` | Inputs, neutral icon wells, inactive areas |
| Text | `--app-text` | Primary copy |
| Muted text | `--app-muted` | Secondary copy, helper text |
| Accent | `--app-accent` | Main CTA, active nav, selected state |
| Accent soft | `--app-accent-soft` | Soft icon background, selected quiet state |
| Danger | `--app-danger` | Destructive action and serious error |
| Success | `--app-success` | Completed payment/access only |
| Warning | `--app-warning` | Needs attention, overdue, pending risk |
| Border | `--app-border` | Default separators |
| Strong border | `--app-border-strong` | Focused or important containers |

Color rules:

- blue means action or active state;
- red means destructive or real error;
- orange means attention or waiting risk;
- green means completed/confirmed only;
- neutral gray means disabled, future, quiet, or secondary;
- future modules must be neutral, not colorful.

### Color Budget Per Screen

Each screen should normally use:

- neutral background;
- one blue accent;
- one semantic state color only if needed.

If a screen has blue, green, orange, purple, yellow, and red at once, it is
failing the system.

### Typography

Font stack:

```css
-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI",
Roboto, ui-sans-serif, system-ui, sans-serif
```

Use system fonts because Telegram users expect native rendering.

Scale:

| Name | Size | Weight | Use |
| --- | ---: | ---: | --- |
| Screen title | 24px | 750 | Main screen heading |
| Section title | 17px | 700 | Group heading |
| Card title | 16px | 700 | Main item name |
| Body | 14px | 500 | Descriptions |
| Caption | 12px | 600 | Metadata, helper text |
| Label | 11px | 700 | Small uppercase/system labels |

Copy rules:

- titles must be short;
- body text should be one sentence;
- do not repeat the same word in title and subtitle;
- do not use marketing copy inside operational screens;
- use verbs for actions: `Найти`, `Создать`, `Подтвердить`, `Оплатил`;
- avoid vague labels like `Подробнее` when a concrete action exists.

### Spacing

Base spacing unit: 4px.

Recommended scale:

| Token idea | Value | Use |
| --- | ---: | --- |
| `space-1` | 4px | tight icon/text gaps |
| `space-2` | 8px | inner micro gaps |
| `space-3` | 12px | compact card padding |
| `space-4` | 16px | default section gap |
| `space-5` | 20px | major section gap |
| `space-6` | 24px | screen-level gap |

Rules:

- Home should use fewer, larger groups;
- details screens may use denser lists;
- forms need breathing room, but not landing-page spacing;
- keep card padding consistent across screens.

### Radius

| Token | Value | Use |
| --- | ---: | --- |
| `--app-radius-sm` | 10px | chips, small controls |
| `--app-radius-md` | 12px | inputs, small cards |
| `--app-radius-lg` | 16px | list groups, buttons |
| `--app-radius-xl` | 20px | major cards |

Rules:

- do not mix very round and sharp styles on one screen;
- avoid huge pill cards unless the action is truly primary;
- bottom nav can be rounded, but must not cover important content.

### Shadows

Use shadows rarely.

- list groups: border first, shadow optional;
- bottom nav: soft fixed shadow;
- alerts and sheets: stronger shadow allowed;
- no heavy glassmorphism.

## Components

### App Shell

Purpose: global mobile frame.

Includes:

- safe-area padding;
- maximum mobile width;
- bottom navigation;
- Telegram theme integration.

Rules:

- no horizontal scroll;
- Home should fit the viewport as much as possible;
- inner screens can scroll naturally;
- content must not hide under bottom nav.

### Top Bar

Purpose: identify the app and current user lightly.

Content:

- avatar or initials;
- `SubsMarket`;
- notification icon only if notifications have value.

Rules:

- do not make top bar visually heavier than the screen content;
- dev user switch must not look like production UI;
- username should be small and secondary.

### Bottom Navigation

Tabs for MVP:

1. `Главная`
2. `Поиск`
3. `Семьи`
4. `Заявки`

Rules:

- no center plus button while `Создать семью` already exists as a primary action;
- badges show real pending work only;
- active tab is blue;
- inactive tabs are muted;
- no extra colors in nav.

### Primary Action Card

Use for the main next step on Home or major operational screens.

Example actions:

- `Найти семью`
- `Создать семью`
- `Подтвердить доступ`
- `Оплатил`

Rules:

- one primary visual action per screen;
- if two actions are equal, show them as a compact choice group, not two hero
  banners;
- subtitle explains the result, not the feature.

### List Item

Default pattern for:

- family rows;
- request rows;
- payment rows;
- settings rows;
- service rows.

Structure:

- leading icon or logo;
- title;
- one subtitle;
- status or amount on the right.

Rules:

- public family cards must not show participant names;
- service logos are allowed;
- generic icons use Lucide only;
- right side should contain one thing: status, amount, or action.

### Family Card

Public card must show:

- service;
- family type: subscription or tariff;
- price per member;
- total capacity and free slots;
- next payment date;
- owner preview only when allowed;
- primary action: send request.

Public card must not show:

- payment phone;
- bank;
- participant list;
- private access details.

### Status Chip

Use chips for state, not decoration.

Approved chip labels:

- `Открыта`
- `Полная`
- `Ожидает`
- `Принята`
- `Отклонена`
- `Доступ выдан`
- `К оплате`
- `Оплачено`
- `Просрочено`
- `Закрывается`
- `Закрыта`

Rules:

- green only for completed states;
- orange only for waiting or overdue attention;
- red only for destructive/problem states;
- neutral for future/unavailable modules.

### Form Field

Used in create/edit flows.

Rules:

- label above field;
- helper text below only when useful;
- inline error immediately under field;
- do not show a wall of validation errors at the top;
- format phone input clearly as `+7XXXXXXXXXX`;
- bank selection must say that card and IBAN are not allowed.

### Empty State

Empty state must answer:

- what is empty;
- why it matters;
- what to do next.

Example:

```text
Пока нет заявок
Когда участник отправит заявку, она появится здесь.
```

Rules:

- no sad illustrations in MVP;
- no jokes;
- one action maximum.

### Error State

Use direct, calm language.

Examples:

- `Не удалось загрузить семьи. Проверьте соединение и попробуйте снова.`
- `Заявка уже не активна.`
- `Семья заполнена. Можно выбрать другую.`

Rules:

- never show raw backend details to normal users;
- technical errors can stay in console/Sentry;
- provide retry when user can recover.

### Loading State

Rules:

- lists use skeleton rows;
- buttons show loading only for the action being performed;
- do not blank the whole app after initial load;
- Home can show compact skeleton blocks.

## Screen Contracts

### Home

Job: show the user's current state and provide fast entry points.

Chosen direction: **Operational Dashboard Home**.

This Home direction is inspired by a compact mobile dashboard:

1. Header with screen title and product name.
2. `Сегодня` task group:
   - `Мои места`;
   - `Заявки`;
   - `Оплаты`.
3. `Быстро` action grid:
   - `Найти место`;
   - `Создать семью`;
   - future `Продать ГБ`;
   - future `Аккаунт`.
4. `Для вас` recommendations/list:
   - useful available families or services.

This works better than a text-heavy action page because it feels like a real
app dashboard and gives returning users immediate orientation.

Secondary:

- bottom navigation remains stable;
- future modules are visible but quiet;
- public recommendations do not expose private participants.

Future modules:

- `Аккаунты и доступы`
- `Гигабайты`

Rules:

- no marketing hero block;
- no top stats strip with `места / заявки / оплаты`;
- no long explanatory subtitles;
- no marketing slogan;
- no `club` copy in user-facing text;
- use `семья`, `место`, `заявка`, `оплата`;
- `Создать семью`, not `Собрать клуб`;
- future modules are visible but disabled/quiet unless implemented;
- recommendations must be compact list rows, not marketplace cards;
- Home should avoid vertical scroll on normal Telegram viewport.

Recommended copy:

```text
Главная
SubsMarket

Сегодня
Мои места
Заявки
Оплаты

Быстро
Найти место
Создать семью

Для вас
```

Do not over-explain on Home. Detail belongs on the destination screen.

### Search

Job: find a family to join.

Must include:

- family type switch: `Подписки` / `Тарифы`;
- service filter;
- list of available families;
- empty state with a clear next action.

Rules:

- show only families the user can act on;
- rejected families are hidden for that candidate;
- full families are hidden in normal search, but invite code can still show
  the family with `Семья полная`.

### Create Family

Job: create a family without mistakes.

Flow:

1. choose family type;
2. choose service/operator;
3. set capacity;
4. set total price;
5. show member share automatically;
6. set payment date;
7. add payment phone and bank;
8. optional description;
9. preview;
10. create.

Rules:

- use Telegram MainButton if the screen has a single final create action;
- show calculated member price near total price;
- warn that phone is shown only after access is confirmed;
- do not ask for card number or IBAN.

### Family Details

Job depends on user role.

Candidate:

- understand family terms;
- send request;
- open owner chat after request is active.

Member:

- see access/payment state;
- confirm access;
- report payment;
- see next payment.

Owner:

- review requests;
- mark access provided;
- confirm payments;
- manage members;
- close family.

Rules:

- owner workspace should be grouped by task;
- dangerous actions must require confirmation;
- payment phone is masked until relevant.

### My Families

Job: show where the user already participates or owns.

Rules:

- split owner and member responsibilities visually;
- show next required action first;
- avoid turning it into a data table.

### Requests

Job: show active application status and let user stop waiting.

Rules:

- pending requests first;
- old requests secondary;
- candidate must understand why a request disappeared or closed.

## Copy System

### Tone

Use:

- simple Russian;
- short sentences;
- direct action labels;
- calm explanations.

Avoid:

- legalistic text;
- startup marketing;
- jokes in money/payment states;
- blaming users.

### Naming

Use in interface:

- `семья`;
- `владелец`;
- `участник`;
- `заявка`;
- `доступ`;
- `оплата`;
- `реквизиты`;
- `семейная подписка`;
- `семейный тариф`.

Do not use in interface:

- `club`;
- `слот`;
- `escrow`;
- `арбитр`;
- `движок`;
- `маркетплейс` for MVP family flows.

### Button Hierarchy

Primary:

- `Найти семью`
- `Создать семью`
- `Отправить заявку`
- `Доступ получил`
- `Оплатил`
- `Подтвердить оплату`

Secondary:

- `Открыть чат`
- `Показать реквизиты`
- `Скрыть`
- `Отменить заявку`

Danger:

- `Удалить участника`
- `Закрыть семью`

## Accessibility

Minimum rules:

- tap targets at least 44px high;
- text contrast must be readable on light and dark themes;
- status cannot rely on color only;
- every icon-only button needs an accessible label;
- forms must keep visible labels;
- focus state must not disappear.

## Implementation Rules

### CSS

- shared values go to `frontend/src/styles/tokens.css`;
- screen-specific layout can stay in `frontend/src/styles.css` until a later
  CSS split;
- avoid new hardcoded hex colors;
- use component classes with product meaning, not visual-only names.

Good:

```css
.family-card
.payment-status-chip
.home-primary-action
```

Avoid:

```css
.blue-box-2
.nice-card
.new-design-card
```

### React Components

When adding UI:

1. first check if a component exists in `frontend/src/components`;
2. use World UI Kit primitive if it fits;
3. use Lucide icon if needed;
4. only then add a custom component.

New reusable components should go under:

- `frontend/src/components/` for shared app components;
- `frontend/src/components/families/` for family-domain UI;
- `frontend/src/components/branding/` for logos/glyphs only.

### Testing

UI changes must preserve:

- no horizontal overflow;
- Home not feeling scroll-heavy;
- bottom nav visible;
- main family flow still passing E2E;
- copy and states matching `frontend/docs/ux-states.md`.

## Design QA Checklist

Before shipping a UI pass:

- Does the screen have one clear main job?
- Is there only one primary action?
- Are colors semantic, not decorative?
- Are future modules visually quiet?
- Are payment and access states impossible to miss?
- Is the copy short enough for a Telegram viewport?
- Does it look like an app, not a website?
- Does it work in light and dark theme?
- Does it avoid horizontal and unnecessary vertical scroll?
- Can a non-technical user understand the next step?

## Migration Plan

### Phase 1. Freeze Rules

- Treat this document as the UI source of truth.
- Stop one-off visual polishing without updating this file.

### Phase 2. Token Cleanup

- align `frontend/src/styles/tokens.css` with the roles above;
- remove duplicate token definitions from `frontend/src/styles.css`;
- replace hardcoded colors with semantic tokens.

### Phase 3. Component Cleanup

- standardize buttons, chips, list items, cards, empty states, and errors;
- remove visually conflicting custom variants;
- keep Lucide as the only generic icon set.

### Phase 4. Screen Redesign

Redesign these screens as one system:

1. Home
2. Search
3. Create Family
4. Family Details
5. My Families
6. Requests

### Phase 5. QA

- run build and E2E;
- visually inspect mobile viewport;
- check dark/light theme;
- update screenshots or design references.

## Final Direction

The recommended direction is **Operational Telegram Finance Utility**:

- Telegram-native structure;
- finance-app trust;
- compact control-panel behavior;
- neutral base;
- blue as the only brand/action color;
- semantic colors only when state requires them.
- dashboard-style Home with stats, today's tasks, quick actions, and compact
  recommendations.

This direction should be used for the next full frontend UI pass.
