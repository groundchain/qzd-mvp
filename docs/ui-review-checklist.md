# UI Review Checklist

## Global updates
- [x] Added a shared design token theme at `packages/shared/src/ui/theme.ts` and applied it in wallet, admin, and merchant POS via `applyThemeVars`.
- [x] Normalized layout scaffolding (skip link, header, nav, main content, footer) and max-width containers across web apps.
- [x] Introduced consistent card, form grid, button, focus, and empty-state patterns with responsive spacing and color usage.
- [x] Refined typography scale, spacing rhythm, shadows, and color contrast to improve readability and hierarchy.
- [x] Added subtle motion with prefers-reduced-motion safeguards.

## Wallet web highlights
- [x] Rebuilt dashboard into section cards with navigation shortcuts and status pill for auth state.
- [x] Added reusable empty states and loading indicators for account, transactions, quotes, and vouchers.
- [x] Clarified form messaging, scenario toggles, and disabled states; aligned inputs on a shared grid.
- [x] Structured transaction list, quote details, and voucher summaries using semantic description lists.

## Admin web highlights
- [x] Applied shared layout chrome, navigation anchors, and session metadata.
- [x] Styled connection, voucher redemption, issuance creation, and validator queue as card sections with cohesive spacing.
- [x] Added badges, card lists, and empty states for requests; improved validator controls with accessible feedback.

## Merchant POS highlights
- [x] Adopted shared shell + navigation with clear merchant status messaging.
- [x] Modernized auth, account monitor, invoice creator, and history sections with responsive grids and cards.
- [x] Refined invoice cards (QR preview, memo textarea, detail grid, actions) and copy/export controls.
- [x] Harmonized typography, colors, and whitespace with the new tokenized theme.
