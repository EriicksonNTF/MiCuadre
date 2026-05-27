# Security Entitlements Hardening

## Threat model
- Frontend gating bypass (hidden buttons, local state, URL tampering).
- Direct API/mutation calls from browser console.
- Cross-user access attempts (IDOR with foreign ids).
- Free users attempting Pro-only feature writes.
- Stripe success URL spoofing without webhook confirmation.
- Offline queue trying to bypass daily transaction limits.

## Free/Pro rules enforced
- Free:
  - max 3 accounts
  - max 10 transactions/day
  - max 1 financial subscription
  - no Planning full access
  - no budgets/debts/debt payments
  - no subscription automation/pre-alerts
- Pro:
  - unlimited accounts/transactions/subscriptions
  - planning full enabled
  - automation enabled

## Server-side checks
- Added `lib/entitlements/server.ts` for server plan reads.
- Billing checkout route now:
  - requires auth
  - whitelists `plan=pro`
  - whitelists `interval=monthly|yearly`
  - validates price ids (`price_...`)
  - blocks duplicate checkout for users already Pro

## Database hardening
- Added migration: `scripts/026_security_entitlements_hardening.sql`
- Adds security-definer trigger function `app_enforce_entitlements()` on:
  - `transactions`
  - `subscriptions`
  - `budgets`
  - `debts`
  - `debt_payments`
- Trigger enforces:
  - authenticated ownership (`new.user_id = auth.uid()`)
  - Free daily transaction cap (10/day)
  - Free subscriptions cap (1)
  - Free cannot enable automation
  - Free cannot write budgets/debts/debt_payments
- Service role bypass is preserved for backend jobs (`auth.role() = 'service_role'`).

## Stripe security
- Webhook remains source of truth for plan sync.
- Checkout success URL does not activate plan by itself.
- Billing portal and status remain auth-protected.

## Notification security
- `markNotificationAsRead` now scopes update by `user_id` + `id`.
- `markAllNotificationsAsRead` already scoped by authenticated `user_id`.

## Offline bypass handling
- Offline sync uses `createTransaction`.
- `createTransaction` now enforces daily limit before insert.
- Exceeding queued items fail and remain as failed sync items (no bypass).

## Known limitations
- Full RLS policy introspection requires running SQL in Supabase project.
- Some legacy client-side reads still depend on UI gating, but write-level bypass is hardened by DB triggers.

## Manual test checklist
1. Free user creates 11th transaction -> blocked.
2. Free user creates 2nd subscription -> blocked.
3. Free user enables subscription automation -> blocked.
4. Free user inserts budget/debt via API/SDK -> blocked.
5. User A marks user B notification id -> no effect.
6. `/settings/plan?checkout=success` without webhook -> remains Free.
7. Pro user can create budgets/debts and run automation.
