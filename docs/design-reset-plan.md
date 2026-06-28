# SubsMarket Design Reset Plan

Date: 2026-06-28

## Why This Exists

The product logic is clear enough to continue backend and flow work, but the
Mini App cannot ship with a rough interface. Users will not read our product
rules if the first screens feel confusing, noisy, or unfinished.

This plan stops the cycle of small visual fixes. The next frontend work should
follow a design-first path: structure, copy, visual direction, then
implementation.

## Current Problem

- The app works, but the interface does not yet feel like a finished mobile app.
- Visual decisions have been made screen by screen, so color, spacing,
  typography, icon tone, and copy do not feel fully unified.
- Home, search, family details, create flow, and owner workspace need to feel
  like one product, not separate pages.
- Continuing to polish CSS directly is risky because each pass can fix one
  visible issue while creating another.

## Non-Negotiables

- No launch with "we will fix UI later".
- No new marketplace or gigabyte UI until family subscriptions and tariffs feel
  solid.
- No mixing design systems on the same screen.
- No decorative color without meaning.
- No long marketing copy inside operational screens.
- No extra first-screen blocks that do not help the user decide what to do.
- No important action hidden below unnecessary content.

## Product Shape To Preserve

SubsMarket is not a landing page. It is a Telegram Mini App for doing jobs:

1. Find a family.
2. Create a family.
3. Send or review requests.
4. Give access.
5. Confirm payment.
6. Keep the family running.

The interface should behave like a control panel, not a promo website.

## Visual Direction Requirements

The final direction should feel:

- mobile-native;
- calm;
- trustworthy;
- simple enough for non-technical Telegram users;
- more like a finance/service utility than a marketplace feed;
- ready for future modules: accounts and gigabytes, without showing them as
  equal MVP features yet.

## Design System Rules

### Color

- Primary action color: one blue.
- Neutral surfaces: white / light gray.
- Warning and error colors only for real attention or destructive states.
- Future modules use neutral disabled states, not purple/yellow/green accents.
- Status chips should be useful, not decorative.

### Typography

- One font stack.
- Screen title: short and decisive.
- Body text: one sentence maximum on operational screens.
- Avoid marketing phrases on task screens.
- Avoid repeating labels already shown by navigation.

### Icons

- Use one icon family only.
- Icons must be simple line icons.
- No mixed custom SVG styles unless a real brand logo is needed.
- Product/service logos are allowed only for actual services, not generic UI
  controls.

### Layout

- Main screens must fit the Telegram viewport as much as possible.
- Bottom navigation stays stable.
- No horizontal overflow.
- Avoid long vertical scroll on Home.
- Search and detail screens can scroll because their content is naturally long.

## Required Screen Set Before More UI Coding

Before the next implementation pass, design these screens together:

1. Home
2. Search / family list
3. Create family
4. Family details as member
5. Family details as owner
6. My families
7. Requests

Home alone is not enough. If only Home is redesigned, the rest of the app will
still feel disconnected.

## Next Work Sequence

### Step 1. Product UX Skeleton

Create a plain wireframe/spec for the seven MVP screens:

- screen purpose;
- primary action;
- secondary actions;
- empty state;
- loading state;
- error state;
- exact copy.

No colors, no polish, no animations.

### Step 2. Visual Directions

Create three visual directions from the same UX skeleton:

1. Telegram Utility: closest to Telegram native patterns.
2. Calm Finance App: more polished and trustworthy.
3. Compact Control Panel: dense, fast, operational.

Each direction must include at least Home, Search, Create, and Family Details.

### Step 3. Pick One Direction

Choose one direction and freeze:

- colors;
- typography scale;
- spacing;
- border radius;
- icon style;
- card/list style;
- button hierarchy;
- copy tone.

### Step 4. Implement As One Pass

Only after direction is chosen:

- update shared layout styles;
- update screen components;
- update E2E tests where UX contract changes;
- run full check.

## What Not To Do Next

- Do not keep polishing the current Home screen in isolation.
- Do not add marketplace UI yet.
- Do not split frontend architecture just to avoid design discomfort.
- Do not ask product questions that are not blocking the design direction.

## Immediate Recommendation

Pause feature work on the frontend UI. Keep backend hardening separate.
Next frontend task should be: produce the UX skeleton and three visual
directions for the seven MVP screens, then implement only the selected one.

Before implementation, use `docs/design-system.md` as the source of truth for
tokens, components, copy, colors, typography, icons, layout, and QA.
