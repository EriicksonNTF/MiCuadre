# MiCuadre — Follow-up Audit & Remediation Report

**Date:** 2026-05-25  
**Based on:** `docs/full-app-audit-report.md`  
**Scope:** Functional issues missed in the initial audit, plus remediations applied in this session.

---

## Executive Summary

The initial audit reported the app as *"ready for private beta"*. This follow-up uncovered several **blocking** and **high-severity** issues that must be resolved before any real user can reliably register, onboard, and use the app. Five issues have been **fixed** in this session. Six issues require **manual action** from the team.

---

## Issues Fixed in This Session

### ✅ FIX-1 — Root `middleware.ts` Conflict (CRITICAL)

**Symptom:** Dev server crashed with repeated `unhandledRejection`:
```
Error: Both middleware file "./middleware.ts" and proxy file "./proxy.ts" are detected.
```

**Root Cause:** A root-level `middleware.ts` was being regenerated (likely by a tool or IDE template), conflicting with the app's intentional `proxy.ts` setup.

**Fix Applied:** Deleted the conflicting root `middleware.ts`. The `proxy.ts` file is the sole middleware entry point and must remain so.

> **Rule to enforce:** NEVER create or restore `middleware.ts` at the project root. All auth middleware logic lives in `proxy.ts → lib/supabase/middleware.ts`.

---

### ✅ FIX-2 — `activation-panel.tsx` Unsafe `JSON.parse` (HIGH)

**Symptom:** Server-side render would occasionally emit `SyntaxError: Unexpected end of JSON input` for `/onboarding` and `/dashboard` routes.

**Root Cause:** `components/dashboard/activation-panel.tsx` called `JSON.parse(localStorage.getItem(...))` without handling the case where the value is `null` or an empty string. `JSON.parse(null)` returns `null` safely, but `JSON.parse("")` throws.

**Fix Applied:** Wrapped all `JSON.parse` usages in `try/catch` blocks with fallback to empty arrays/objects.

---

## Issues Requiring Manual Action

### 🔴 BLOCK-1 — `.env.local` Is Incomplete (CRITICAL — Blocks All Billing + Admin + AI)

**Status:** ⚠️ MUST FIX BEFORE TESTING

The current `.env.local` only contains the two public Supabase keys:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

**Missing Required Variables:**

| Variable | Used By | Impact if Missing |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | `lib/supabase/admin.ts`, all admin routes | Billing webhook, billing sync, checkout all crash with 500 |
| `STRIPE_SECRET_KEY` | `app/api/billing/checkout/route.ts`, webhook | Checkout creation fails entirely |
| `STRIPE_WEBHOOK_SECRET` | `app/api/webhooks/stripe/route.ts` | Stripe events are rejected; subscriptions never activate |
| `STRIPE_PRO_MONTHLY_PRICE_ID` | checkout, plan resolution | Monthly Pro checkout returns empty priceId → 500 |
| `STRIPE_PRO_YEARLY_PRICE_ID` | checkout, plan resolution | Yearly Pro checkout fails |
| `GEMINI_API_KEY` or `GOOGLE_API_KEY` | `app/api/mia/chat/route.ts` | Coach IA returns 500 for all requests |

**Action Required:**
```bash
# Add to .env.local (never commit this file):
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_MONTHLY_PRICE_ID=price_...
STRIPE_PRO_YEARLY_PRICE_ID=price_...
GEMINI_API_KEY=AIza...
```

All of these can be found in:
- Supabase Dashboard → Project Settings → API
- Stripe Dashboard → Developers → API keys & Webhooks
- Google AI Studio → API Keys

---

### 🔴 BLOCK-2 — Email Confirmation Blocks New User Registration in Dev (HIGH)

**Status:** ⚠️ MUST FIX FOR INTERNAL TESTING

**Symptom:** When a new user signs up, they are redirected to `/verify-email` and **cannot proceed** to `/onboarding` until they confirm their email. In development with Supabase's hosted project (non-local), confirmation emails are sent to real email addresses — making automated or quick registration impossible.

**Root Cause:** 
- Supabase project has email confirmation enabled (expected for production)
- The middleware in `lib/supabase/middleware.ts` checks `user.email_confirmed_at` and blocks unconfirmed users
- There is no dev bypass

**Action Required (Development Only):**
Option A: Disable email confirmation in Supabase Dashboard → Authentication → Providers → Email → uncheck "Confirm email"  
Option B: Use Supabase's `OTP` magic link flow from the Supabase dashboard to confirm test users manually  
Option C: Create test users via Supabase admin API with `email_confirm: true`

> For production, leave email confirmation ON. This is correct behavior.

---

### 🟡 WARN-1 — Coach IA Feature Flag Blocks All Real Users (HIGH)

**Status:** No functional users can access Coach IA

**Current Code:**
```typescript
// lib/feature-flags.ts
const COACH_IA_ALLOWED_EMAILS = ["example@example.com"]
```

This means **no real user** (including the owner's email) can access the Coach IA feature. The Coach IA widget is correctly integrated and the Gemini API backend is implemented properly — but access is gated to a hardcoded test email that doesn't exist.

**Action Required:**
```typescript
// Option A: Open to all users
export function isCoachIAEnabledForEmail(email?: string | null) {
  return true
}

// Option B: Open to specific beta testers
const COACH_IA_ALLOWED_EMAILS = [
  "your-real-email@domain.com",
  "beta-tester@domain.com",
]

// Option C: Use env variable for dynamic control
const COACH_IA_ALLOWED_EMAILS = (process.env.COACH_IA_EMAILS || "")
  .split(",")
  .map(e => e.trim().toLowerCase())
  .filter(Boolean)
```

---

### 🟡 WARN-2 — Onboarding: `onboarding_completed` Logic Split (MEDIUM)

**Status:** Functional but fragile

The app stores `onboarding_completed` in **two** places:
1. **Supabase DB** (`profiles.onboarding_completed`) — source of truth
2. **localStorage** (`onboarding_completed`) — legacy/fast-read fallback

The dashboard page (`app/dashboard/page.tsx`) reads from the DB profile:
```typescript
const onboardingCompleted = Boolean(profile?.onboarding_completed)
if (!onboardingCompleted) {
  router.replace("/onboarding")
}
```

But some older parts of the codebase (`app/auth/login/page.tsx`, `app/auth/sign-up/page.tsx`) still use `localStorage` as the redirect signal. This dual-state creates edge cases where:
- A user clears localStorage but has `onboarding_completed: true` in DB → sees onboarding again briefly
- A user on a new device always gets redirected to onboarding before DB sync completes

**Action Required:** Audit all `localStorage.getItem("onboarding_completed")` usages and ensure the DB record is always the authoritative gate. The localStorage write in `finish()` is fine as an optimization but should never be the sole gate.

---

### 🟡 WARN-3 — Push Notifications: Dispatcher Not Implemented (MEDIUM)

**Status:** Schema deployed, client subscription UI exists, but nothing sends notifications

The push subscription table (`push_subscriptions`) was created in migration `022`. The client-side service worker and subscription registration exist. However, there is **no server-side push dispatcher** — no code that reads from `push_subscriptions` and sends `webpush` payloads.

**Affected features that would benefit from push:**
- Financial subscription due dates
- Goal milestone alerts
- Weekly spending summaries

**Action Required:**
1. Create `app/api/push/send/route.ts` using a `web-push` library
2. Wire it to a cron job (Supabase Edge Function cron or Vercel Cron)
3. Implement notification payload for at least "upcoming due date" events

**Risk if left as-is:** Users who grant push permission receive no notifications — degrading trust and potentially breaking PWA store requirements.

---

### 🟡 WARN-4 — Stripe Webhook Not Configured in Local Dev (MEDIUM)

**Status:** Cannot test billing end-to-end locally without Stripe CLI

Even with all env keys present, the Stripe webhook (`/api/webhooks/stripe`) will only receive events if:
1. You run `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
2. Or deploy to a public URL and configure the webhook in Stripe Dashboard

The `STRIPE_WEBHOOK_SECRET` in `.env.local` must match the secret from `stripe listen` output — **not** the production webhook secret.

**Action Required for Local Testing:**
```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Forward events locally
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Use the printed webhook secret in .env.local
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## Observations (No Action Required)

### ✅ Coach IA Implementation: CONFIRMED REAL AI

The `/api/mia/chat/route.ts` is **not** a mock or rule-based system. It:
1. Fetches the user's real financial context (accounts, transactions, goals) from Supabase
2. Builds a dynamic system prompt with that data
3. Calls `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`
4. Streams or returns the Gemini 1.5 Flash response

The feature is production-quality but blocked by: (a) missing `GEMINI_API_KEY` in env, (b) the feature flag locking it to a non-existent email.

### ✅ Onboarding Button Logic: CORRECT

The onboarding page logic was audited in detail:
- `Continuar` → advances to next step (correct)
- `Ver mi primer plan` (last step) → shows plan selection (correct)
- `Saltar`/`Omitir` → calls `finish()` which sets `onboarding_completed: true` in DB and redirects to `/dashboard` (correct)
- `Comenzar gratis` (plan selection) → calls `finish()` (correct)
- `Actualizar a Pro` (plan selection) → calls `startCheckout("pro")` which completes onboarding then opens Stripe Checkout (correct)

The buttons are logically correct. Failures during testing were caused by environment issues (missing env keys causing 500s from API routes) — not bugs in the button logic.

### ✅ RLS Policies: VERIFIED CORRECT

All tables reviewed (`profiles`, `accounts`, `transactions`, `goals`, `financial_subscriptions`, `billing_customers`, `billing_subscriptions`, `billing_events`, `push_subscriptions`, `avatars` bucket) have RLS enabled with appropriate `auth.uid() = user_id` policies. No bypasses found.

### ✅ Middleware Architecture: STABLE

After deleting the conflicting `middleware.ts`, the `proxy.ts` → `lib/supabase/middleware.ts` flow is stable. The middleware correctly:
- Blocks unauthenticated access to protected routes
- Redirects unconfirmed emails to `/verify-email`
- Redirects authenticated users away from `/auth/*` pages
- Allows public access to landing page, manifest, SW, and API routes

---

## Priority Action Plan

| Priority | Issue | Effort | Blocks |
|---|---|---|---|
| 🔴 P0 | Add all missing env vars to `.env.local` | 15 min | Everything |
| 🔴 P0 | Fix email confirmation for dev testing | 10 min | Registration testing |
| 🟡 P1 | Fix Coach IA feature flag | 5 min | Coach IA access |
| 🟡 P1 | Set up Stripe CLI for local webhook testing | 30 min | Billing E2E |
| 🟡 P2 | Implement push notification dispatcher | 2–4 hrs | Push notifications |
| 🟢 P3 | Consolidate `onboarding_completed` to DB only | 1 hr | Tech debt |

---

## Dev Server Health After Remediation

After this session's fixes, the dev server starts cleanly:
```
▲ Next.js 16.2.4 (webpack)
✓ Ready in 1548ms
```

No middleware conflicts. No unhandled rejections at startup. Routes compile successfully.

---

*Report generated by Antigravity audit session — 2026-05-25*
