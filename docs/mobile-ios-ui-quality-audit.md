# Mobile iOS UI Quality Audit

## Scope

Audited the mobile-first layout patterns for:

- Login
- Register
- Onboarding
- Dashboard
- Accounts
- Account creation modal
- Transfer modal
- Transaction create flow
- Planning summary surfaces
- Settings/profile-adjacent copy touched by the language sweep

Screens that require an authenticated dataset or native wrapper state still need device QA:

- Account detail with real transactions
- Credit card detail and pay card flow
- Debt creation and payment flows
- Subscriptions
- Notifications
- Reports
- Profile edit
- Plan selector checkout

## Problems Found

- Dashboard balance was too small for the primary financial value and used hardcoded card colors instead of theme tokens.
- Header action buttons could crowd long user names on narrow iPhone widths.
- Bottom navigation did not include safe-area padding on the fixed nav itself.
- Transaction form used a sticky footer with full nav padding even though bottom nav is hidden on `/expense`, which made the action area unnecessarily tall.
- Transaction category labels were single-line truncated, causing clipped labels for longer Spanish category names.
- Account selector cards had fixed widths that could feel cramped or off-center across iPhone widths.
- Account screen relied mostly on icon-only top actions, making "Crear cuenta" less visible.
- Mobile fullscreen forms needed stricter fixed-header, scroll-body, sticky-footer behavior.
- Several visible Spanish strings were missing accents.

## Rules Adopted

- Page content reserves bottom safe-area space with `calc(6rem + env(safe-area-inset-bottom))`.
- Mobile cards use theme tokens, `28px` radius, `border-border`, and `bg-card`.
- Primary mobile actions use at least `56px` height and `22px` radius.
- Icon buttons use 44-56px touch targets and theme-token backgrounds.
- Major financial amounts use clamp-based sizing, `font-extrabold`, and `leading-none`.
- Form screens use fixed header, independently scrollable body, and sticky safe-area footer.
- Horizontal selectors use responsive widths and truncation/line clamp instead of overflowing.

## Files Changed

- `app/globals.css`
- `app/auth/login/page.tsx`
- `app/auth/sign-up/page.tsx`
- `app/dashboard/page.tsx`
- `app/scan/page.tsx`
- `components/accounts/accounts-screen.tsx`
- `components/dashboard/balance-card.tsx`
- `components/dashboard/coach-ia-widget.tsx`
- `components/dashboard/header.tsx`
- `components/dashboard/planning-summary-card.tsx`
- `components/expense/expense-form.tsx`
- `components/navigation/bottom-nav.tsx`
- `components/planning/budget-form-sheet.tsx`
- `components/planning/calendar-event-card.tsx`
- `components/planning/debt-form-sheet.tsx`
- `components/planning/planning-summary-cards.tsx`
- `components/planning/rotating-upcoming-payments-card.tsx`
- `components/settings/settings-screen.tsx`
- `components/ui/account-carousel-selector.tsx`
- `components/ui/mobile-fullscreen-form.tsx`

## iOS Readiness Status

Partially ready.

The web build is passing and the mobile layout shell now has better iOS safe-area handling, larger touch targets, and safer form footers. Native iOS/Xcode readiness is not fully confirmed because this pass did not run an Xcode simulator build and did not validate real Supabase/OAuth login redirects in the native wrapper.

## Remaining Blockers

- Validate Google OAuth redirect configuration for the production/native URL.
- Confirm session persistence after closing and reopening the iOS wrapper.
- Confirm service worker behavior against production Next assets in the native wrapper.
- Test offline expense capture with a real authenticated account.
- Run real account/card/payment flows with seeded or production-like data.
- Verify plan checkout and billing portal in a safe Stripe test environment.

## Manual QA Checklist

- Login mobile layout: browser-checked at 390x844; no horizontal overflow, 56px primary/social buttons.
- Register mobile layout: browser-checked at 390x844; no horizontal overflow, 56px primary/social buttons.
- Onboarding mobile layout: unauthenticated local route redirects to login as expected; authenticated onboarding visual QA pending.
- Dashboard mobile layout: checked in code; authenticated visual QA pending.
- Transaction form mobile layout: checked in code; authenticated save QA pending.
- Accounts mobile layout: checked in code; authenticated visual QA pending.
- Create account form: checked in code; authenticated create QA pending.
- Transfer modal: checked in code; authenticated transfer QA pending.
- Dark mode: theme-token usage preserved; visual QA pending.
- Light mode: theme-token usage preserved; visual QA pending.
- iPhone safe area: CSS updated; simulator QA pending.

## Verification

- `pnpm run build:safe`: passed.
- `pnpm lint`: passed with existing warnings; no lint errors. Warnings are mostly React compiler purity/set-state-in-effect warnings across pre-existing files.
- Browser QA: local dev server at `http://localhost:3000`; checked `/auth/login`, `/auth/sign-up`, `/onboarding`, `/expense`, and `/accounts` at 390x844. Protected routes redirected to `/auth/login` without horizontal overflow.
