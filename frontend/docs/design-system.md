# Frontend Design System Implementation Notes

This file mirrors the product design-system rules in
`docs/design-system.md` and keeps frontend implementation decisions close to
the code.

## Source Of Truth

Primary design-system document:

```text
docs/design-system.md
```

Frontend state contracts:

```text
frontend/docs/ux-states.md
```

## Current Stack

- Market screen: semantic React/HTML with isolated `src/styles/market.css`
- Screens not yet migrated: `@worldcoin/mini-apps-ui-kit-react`
- Icons: `@hugeicons/react` with `@hugeicons/core-free-icons` on the Market
  screen; `lucide-react` on the remaining legacy screens
- Market tokens: local HireHi-derived tokens in `src/styles/market.css`
- Other screen tokens: `frontend/src/styles/tokens.css`
- Global styles: `frontend/src/styles.css`
- Telegram native helpers: `frontend/src/telegram.ts`

HeroUI and Tailwind CSS are not part of the frontend stack. Do not mix World
UI and custom components inside one screen. New component libraries require an
explicit design-system decision.

## Market Visual System

The Market keeps the existing SubsMarket product structure and uses a dark
visual system derived from the measured HireHi mobile interface:

- canvas `#141414`;
- primary surface `#1D1E20`;
- secondary surface `#2E3035`;
- interactive accent `#4DB288`, pressed `#3D8A6E`;
- primary text `#FFFFFF`, secondary text `#888888`;
- Inter with the system fallback stack;
- radii `24px` for surfaces, `16px` for controls, `12px` for chips;
- 16px mobile gutter and the `4 / 8 / 12 / 16 / 20 / 24 / 32` spacing scale;
- no borders or shadows on in-flow cards; shadow is reserved for the floating
  bottom navigation;
- one nesting level: canvas -> primary surface -> secondary control.

The accent marks the current navigation item and the main action. It is not
used as decorative card color. Existing service data, actions, ordering, and
navigation contracts remain unchanged.

## Frontend Rules

- Market uses HireHi green as its interaction accent; screens not yet migrated
  retain the existing blue action color.
- Green is only for completed/confirmed states.
- Orange is only for waiting/risk states.
- Red is only for destructive/problem states.
- Future modules are neutral and quiet.
- Generic UI icons come from Lucide only.
- Service logos are only for actual services.
- Do not create duplicate button/card styles without adding them to the
  design system.
- First screen is `Маркет`, not a separate dashboard Home.
- Market keeps its existing product structure and transitions. HireHi defines
  its visual tokens and composition, not its product logic.
- Do not add a top stats strip with `места / заявки / оплаты`.
- Market groups can be visually unlabeled when cards explain the meaning; keep
  semantic `aria-label` for accessibility.
- User-facing copy says `Создать семью`, not `Собрать клуб`.

## Review Checklist

Before merging a UI change:

- no new random hex colors;
- no new icon family;
- no horizontal overflow;
- bottom nav visible and not covering primary actions;
- visible loading, empty, and error states;
- destructive actions use Telegram/native confirmation;
- copy is short and clear;
- Market does not become a landing page.
