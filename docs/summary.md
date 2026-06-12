# MiCuadre Agent Summary

## Session: Bottom Nav Redesign + Keyboard Zoom Fix

## Goal
- Replace floating pill navbar with flat bottom bar
- Add `pb-nav-safe` to all screens so content is never hidden behind navbar
- Change active nav indicator from green line to subtle zoom + shadow
- Fix iOS Safari keyboard zoom issue (inputs < 16px cause viewport zoom that persists)

## Constraints & Preferences
- Offline-first PWA must not break; Capacitor iOS support must keep working.
- All screen content must clear the bottom navbar — no partial cut-off.
- Active nav indicator: subtle zoom (`scale-110`) + drop shadow, no green line.
- Navbar: solid `bg-card` (no backdrop blur — was causing visible blur on dashboard), `border-t`, flat at bottom edge.
- Navbar height: `h-[4.5rem]` (72px) + `env(safe-area-inset-bottom)`.
- Bottom padding for content: `calc(5rem + env(safe-area-inset-bottom))` (5rem = 80px, gap above nav).
- Keyboard fix: ALL input/select/textarea must have `font-size >= 16px` on mobile to prevent iOS zoom.

## Progress
### Done
- **Contrast ratio verification**: All text-on-background pairs pass WCAG AA (4.5:1) in both modes. `surface--surface-raised` FAIL is expected (two background surfaces, not text). Script at `scripts/check-contrast.mjs` (uses `culori`).
- **Planning shell restructured**: Tabs moved inside same sticky container as header (always visible). Static "Centro de mando" callout removed.
- **Global summary cards removed**: `PlanningSummaryCards` no longer rendered in `planning-shell.tsx` — each tab is self-contained.
- **Back button removed**: `ChevronLeft` and its button deleted from planning header.
- **FinancialCalendarTab reordered**: (1) `PlanningMiniCalendar`, (2) `RotatingUpcomingPaymentsCard`, (3) `CalendarFilterPills` with label "Filtrar por tipo", (4) filtered event list. Removed redundant summary card.
- **DebtsTab subscriptions section**: Added using `useFinancialSubscriptions()` — shows name, amount, next payment date, and status from `public.subscriptions` table.
- **Bottom-nav redesigned from floating pill to flat bar**:
  - `bg-card` solid (no `backdrop-blur`), `border-t border-border`, flat at bottom edge.
  - Height `h-[4.5rem]` (was `h-[4.7rem]`), safe-area via `paddingBottom: env(safe-area-inset-bottom)` on the `<nav>` element.
  - Active indicator: replaced green top line with `scale-110 drop-shadow-sm` on the active icon.
  - FAB and long-press quick menu preserved.
- **`globals.css` padding updated**: `.pb-nav-safe` → `calc(5rem + env(safe-area-inset-bottom))`, `.mobile-page` padding-bottom → same value.
- **CoachIAWidget position**: Changed from `bottom-24` to `bottom-[calc(5rem+env(safe-area-inset-bottom))]` — sits above navbar in both collapsed and expanded states.
- **Planning shell content padding**: Updated to `pb-[calc(5rem+env(safe-area-inset-bottom))]`.
- **Build verified**: `npm run build` passes with zero TypeScript errors (60 pages).
- **14 screens patched with `pb-nav-safe`**: accounts-screen, account-detail, history-screen, notifications-screen, profile/page (2 instances), settings-screen, settings/notifications-screen, settings/reports-screen, settings/plan-screen, settings/categories-screen, settings/subscriptions-screen, send/page, scan/page, settings/security-privacy/page.
- **Offline page fixed** — defined as named constant before export to resolve declaration scope issue.

### Blocked
- `npm run build:mobile` fails due to Turbopack Geist font issue in Next 16 (pre-existing).
- Budget history (presupuestos terminados/cerrados) cannot be built: data model only has `is_active: boolean` (soft-delete). No `status` lifecycle field, no `period_end`, no auto-close. Needs data model change to support history.
- Coach-ia/page.tsx not migrated to MobilePageShell (needs React.forwardRef).
- expense-form.tsx not migrated (uses `h-[100dvh] flex flex-col overflow-hidden`).
- No Android Capacitor platform exists yet.

## Key Decisions
- **Backdrop blur removed from navbar**: Putting `backdrop-blur-xl` on the full-width `<nav>` element (not on a pill) created a visible frosted-glass strip across the bottom of the viewport, causing the dashboard to appear blurred. Fixed with solid `bg-card`.
- **Active nav indicator**: Green top line was too assertive. Replaced with `scale-110 drop-shadow-sm` on the icon — subtle zoom + shadow communicates active state without extra UI chrome.
- **Navbar height**: Reduced from `h-[4.7rem]` (75.2px) to `h-[4.5rem]` (72px). Combined with the 0.5rem gap in `pb-nav-safe` (5rem = 80px), content clears the nav cleanly.
- **`.pb-nav-safe` as single source of truth**: Every screen using `MobilePageShell fullBleed` should also add `pb-nav-safe` or equivalent bottom padding. Screens using `MobilePageShell` without `fullBleed` get `.mobile-page` which already includes the padding.
- **Flat bar over floating pill**: Floating pill (`rounded-[1.8rem] shadow backdrop-blur`) had inconsistent height calculation that caused content to be cut off. A flat bottom bar with simple `border-t` is predictable and eliminates the problem.

## Next Steps
1. Fix iOS keyboard zoom on ALL form inputs (font-size < 16px → min 16px on mobile).
2. Add `visualViewport` resize handler if needed.
3. Rotate remaining exposed secrets (LLM_API_KEY, Supabase service_role key).
4. Scaffold Android Capacitor platform (after responsive layout verified on web + iOS).

## Critical Context
- **`.pb-nav-safe` class**: `padding-bottom: calc(5rem + env(safe-area-inset-bottom))` (80px + safe-area). Navbar is `h-[4.5rem]` (72px) + safe-area padding. The 0.5rem (8px) gap ensures content never touches the nav.
- **`MobilePageShell fullBleed` bypasses `.mobile-page` padding**: Screens using `fullBleed` must manually add `pb-nav-safe` or `pb-[calc(5rem+env(safe-area-inset-bottom))]`.
- **`MobilePageShell` without `fullBleed`**: Gets `.mobile-page` class which already has the correct padding.
- **CoachIAWidget bottom**: `bottom-[calc(5rem+env(safe-area-inset-bottom))]` — directly matches content padding for consistent vertical rhythm.
- **Balance direction**: Cash/debit: expense → balance decreases, income → increases. Credit: expense → debt increases, income/payment → debt decreases.
- **Offline infrastructure**: IndexedDB v2 with 12 cache stores. Outbox supports 28 operation types. Sync engine dispatches all with retry + idempotency.
- **Theme architecture**: Custom ThemeProvider (no next-themes). localStorage + inline script for instant paint. Profile (Supabase) authoritative on load. System default.
- **Responsive architecture**: `MobilePageShell` universal container. `.mobile-page` scales 28rem → 64rem. Sidebar 280px `lg:flex`. Bottom nav `hide-on-desktop` ≥1024px.
- **`npm run build`** (SSR) compiles cleanly. `build:mobile` has pre-existing Turbopack font issue.

## Relevant Files
- `components/navigation/bottom-nav.tsx`: redesigned to flat bar with `scale-110 drop-shadow-sm` active indicator
- `app/globals.css`: `.pb-nav-safe` and `.mobile-page` padding updated to `calc(5rem + env(safe-area-inset-bottom))`
- `components/planning/planning-shell.tsx`: summary cards + back button removed, pb-nav-safe added
- `components/planning/financial-calendar-tab.tsx`: reordered (calendar → payments → filters)
- `components/planning/debts-tab.tsx`: subscriptions section added
- `components/dashboard/coach-ia-widget.tsx`: bottom position → `calc(5rem + env(safe-area-inset-bottom))`
- `scripts/check-contrast.mjs`: WCAG contrast verification script
