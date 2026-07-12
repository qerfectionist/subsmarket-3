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

Design reset plan:

```text
docs/design-reset-plan.md
```

## Current Stack

- Base components: `@worldcoin/mini-apps-ui-kit-react`
- Icons: `lucide-react`
- Tokens: `frontend/src/styles/tokens.css`
- Global styles: `frontend/src/styles.css`
- Telegram native helpers: `frontend/src/telegram.ts`

Do not add another visual component library for MVP UI.

## Immediate Implementation Order

1. Implement the selected first-screen direction: **Telegram Wallet-style Market**.
2. Clean token duplication between `tokens.css` and `styles.css`.
3. Convert hardcoded colors in `styles.css` to semantic tokens.
4. Standardize shared components:
   - app shell;
   - bottom nav;
   - status chip;
   - family card/list item;
   - empty state;
   - error state;
   - form field.
5. Redesign screens in this order:
   - Market;
   - My;
   - Create Family;
   - Family Details;
6. Run visual QA and E2E.

## Frontend Rules

- Blue is the only default action/brand color.
- Green is only for completed/confirmed states.
- Orange is only for waiting/risk states.
- Red is only for destructive/problem states.
- Future modules are neutral and quiet.
- Generic UI icons come from Lucide only.
- Service logos are only for actual services.
- Do not create duplicate button/card styles without adding them to the
  design system.
- First screen is `Маркет`, not a separate dashboard Home.
- Market uses Wallet-style structure: summary card, quick actions, compact grouped list.
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
