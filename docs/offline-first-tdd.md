# Technical Design Document: Offline-First Architecture

## 1. Executive Summary

**Objective:** Convert MiCuadre from a SSR-dependent Next.js PWA into a fully offline-capable mobile app (iOS via Capacitor) with local-first data storage and background synchronization.

**Current problem:** The Capacitor iOS app loads `https://micuadre-five.vercel.app` in a WebView. Without internet, nothing loads.

**Target state:** The app loads entirely from local files on the device. All data operations work offline (reads + writes). Changes sync when connectivity resumes.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                  Capacitor Shell (iOS)               │
│  ┌───────────────────────────────────────────────┐  │
│  │          WKWebView (local static files)         │  │
│  │  ┌──────────┐  ┌──────────┐  ┌─────────────┐  │  │
│  │  │  Service  │  │  React   │  │  Supabase   │  │  │
│  │  │  Worker   │ ←→ │  App    │ ←→ │  Browser   │  │  │
│  │  │  (cache)  │  │ (Next.js│  │  Client     │  │  │
│  │  └──────────┘  │ static)  │  └──────┬──────┘  │  │
│  │                └──────────┘         │           │  │
│  │                      │              │           │  │
│  │                ┌──────▼──────────────▼──────┐   │  │
│  │                │     Sync Engine             │   │  │
│  │                │  (lib/offline/sync-engine)  │   │  │
│  │                └──────┬──────────────────────┘   │  │
│  │                       │                          │  │
│  │                ┌──────▼──────┐                   │  │
│  │                │  IndexedDB  │                   │  │
│  │                │  (OfflineDB)│                   │  │
│  │                └─────────────┘                   │  │
│  └───────────────────────────────────────────────┘  │
│                                                       │
│  ┌───────────────────────────────────────────────┐  │
│  │  Capacitor Plugins (Network, etc.)             │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                          │
                          │ (when online)
                          ▼
┌─────────────────────────────────────────────────────┐
│                   Vercel / Supabase                   │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │  API Routes  │  │  Supabase    │  │  Stripe    │ │
│  │  (webhooks,  │  │  (DB + Auth) │  │  Webhooks  │ │
│  │   cron)      │  │              │  │            │ │
│  └──────────────┘  └──────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Key Design Decision: Hybrid App + Cloud API

Not everything moves to the client. The architecture splits into two tiers:

| Tier | What | Runs where |
|------|------|------------|
| **App Tier** | UI, local DB, sync engine, offline queue | iOS device (static files) |
| **Cloud Tier** | Stripe webhooks, cron jobs, admin operations | Vercel (API routes) |

The cloud tier handles only operations that **cannot run client-side** (Stripe secret keys, admin service role, cron schedules). The app tier handles everything else.

---

## 3. Current SSR Inventory — What Must Change

### 3.1 Build Output

| Current | Target |
|---------|--------|
| `next.config.mjs` — default SSR output | `output: 'export'` — static HTML export |
| Next.js server manages auth, routing | All routing handled client-side |
| `middleware.ts` guards routes via server | Auth guards move to client wrappers |

### 3.2 Auth System

| Current (SSR) | Target (PKCE Client-side) |
|---------------|---------------------------|
| `lib/supabase/server.ts` — `createServerClient` with cookies | Remove. Only use `lib/supabase/client.ts` |
| `lib/supabase/middleware.ts` — edge middleware refreshing session | Remove. Session handled by `onAuthStateChange` |
| `app/auth/callback/route.ts` — server-side code exchange | Replace with `supabase.auth.exchangeCodeForSession()` client-side |
| `redirect()` in `app/page.tsx` — server redirects based on auth | Replace with client-side router push + `<AuthenticatedRoute>` wrapper |

**Auth persistence (offline):** The Supabase browser client (`@supabase/ssr`'s `createBrowserClient`) stores the session in memory + `localStorage`. When offline, the cached session allows app usage until the token expires.

### 3.3 API Routes — What Happens to Each

| Route | Current | Future |
|-------|---------|--------|
| `POST /api/auth/sync-profile` | Server upserts profile after signup | Move to client-side: `supabase.from('profiles').upsert()` directly |
| `POST /api/billing/checkout` | Creates Stripe Checkout session | **Keep on Vercel.** Redirect user to hosted checkout URL |
| `POST /api/billing/portal` | Creates Stripe Billing Portal | **Keep on Vercel.** Redirect user to hosted portal URL |
| `GET /api/billing/status` | Reads plan, billing state | Move to client query: `supabase.from('profiles').select()` |
| `POST /api/webhooks/stripe` | Stripe webhooks | **Keep on Vercel** (needs Stripe secret). No change needed |
| `GET /api/cron/process-subscriptions` | Cron job for subscriptions | **Keep on Vercel** as cron-triggered function |
| `POST /api/push/send` | Push notification sender | **Keep on Vercel** (needs VAPID private key + admin client) |
| `POST /api/coach-ia` | Coach IA assistant | **Keep on Vercel** (needs LLM API key + server-only libs) |
| `GET/POST /api/mia/chat` | MIA AI assistant | **Keep on Vercel** (needs LLM API key + server-only libs) |
| `GET /api/user/coach-ia-check` | Allowlist check | Move to client-side: check localStorage or profile metadata |
| `GET /api/account/export` | CSV export | Move to client-side: query + generate CSV in browser |
| `DELETE /api/account/delete` | Full account deletion | **Keep on Vercel** (needs admin client to delete auth user) |
| `GET/PUT /api/profile/notification-preferences` | Read/update notification prefs | Move to client-side: direct Supabase query |

**Routes that stay on Vercel:** 6 routes (webhooks, cron, Stripe checkouts/portal, push, coach/MIA, account deletion).
**Routes that move to client:** 7 routes.

### 3.4 Server-Only Libraries — What Happens

| Library | Current | Future |
|---------|---------|--------|
| `lib/rate-limit.ts` | In-memory rate limiter | Remove for client; API routes that stay keep their own |
| `lib/feature-flags.ts` | Reads env vars for allowlist | Replace with profile metadata or env-check at build time |
| `lib/env/server.ts` | Validates server env vars | Remove. Server routes keep inline validation |
| `lib/entitlements/server.ts` | Admin client plan checks | Replace with client-side: `supabase.from('profiles').select('plan_tier')` |
| `lib/billing/sync-billing-state.ts` | Admin client billing sync | Keep on Vercel (called by webhooks) |
| `lib/mia/access.ts` | MIA feature gating | Keep on Vercel (server-only) |
| `lib/notifications/push-dispatcher.ts` | Sends push notifications | Keep on Vercel (server-only) |
| `lib/supabase/admin.ts` | Service role client | Keep on Vercel (called by webhooks/cron) |
| `lib/supabase/server.ts` | Cookie-based SSR client | Remove entirely |

---

## 4. Proposed Data Flow

### 4.1 Online Reads

```
User Action → SWR Hook → fetchAccounts()
  → supabase.from('accounts').select('*')  [direct browser client]
  → On success: write to IndexedDB cache
  → Return data to component
```

### 4.2 Offline Reads

```
User Action → SWR Hook → fetchAccounts()
  → supabase query fails (offline)
  → Fallback: OfflineDB.get('accounts_cache', user_id)
  → Merge any pending outbox items
  → Return cached data to component
```

### 4.3 Online Writes

```
User Action → createTransaction()
  → Optimistic update: mutate('transactions'), mutate('accounts')
  → supabase.from('transactions').insert({...})  [direct]
  → On success: update IndexedDB cache, create notification
  → On failure: fallback to offline queue
```

### 4.4 Offline Writes

```
User Action → createTransaction()
  → navigator.onLine === false
  → Save to OfflineDB.outbox({ operation, payload, idempotency_key })
  → Optimistic update: mutate() with fake data (kind: 'offline_pending')
  → UI shows the pending transaction immediately
```

### 4.5 Sync Flow

```
Connectivity restored →
  window.dispatchEvent(new Event('online')) →
  Sync Engine triggers →
    1. Fetch pending outbox entries
    2. Check idempotency on server
    3. Execute each operation with skipOutbox: true
    4. On success: delete from outbox, refresh caches
    5. On failure: increment retry, max 5 attempts
    6. Emit sync events for status banner
```

---

## 5. Data Model — All Entities That Need Offline Support

### 5.1 Current (only `transactions` has offline support)

| Entity | Read Offline | Write Offline |
|--------|-------------|---------------|
| accounts | ✅ (IndexedDB) | ❌ |
| transactions | ✅ (IndexedDB + outbox merge) | ✅ (outbox queue) |
| categories | ❌ | ❌ |
| goals | ❌ | ❌ |
| goal_contributions | ❌ | ❌ |
| notifications | ❌ | ❌ |
| beneficiaries | ❌ | ❌ |
| subscriptions | ❌ | ❌ |
| budgets | ❌ | ❌ |
| debts | ❌ | ❌ |
| debt_payments | ❌ | ❌ |
| profiles | ❌ | ❌ |
| notification_preferences | ❌ | ❌ |

### 5.2 Target (all entities offline-capable)

Add to `OfflineDB` (`lib/offline/db.ts`):

| Object Store | Key Path | Sync Strategy |
|-------------|----------|---------------|
| `transactions_cache` | `id` | Pull + merge |
| `accounts_cache` | `id` | Pull + merge |
| `categories_cache` | `id` | Pull (read-only, created server-side) |
| `goals_cache` | `id` | Pull + push |
| `goal_contributions_cache` | `id` | Push only (child of goals) |
| `notifications_cache` | `id` | Pull + push (mark read) |
| `beneficiaries_cache` | `id` | Pull + push |
| `subscriptions_cache` | `id` | Pull + push |
| `budgets_cache` | `id` | Pull + push |
| `debts_cache` | `id` | Pull + push |
| `debt_payments_cache` | `id` | Push only (child of debts) |
| `profile_cache` | `user_id` | Pull + push |
| `notification_preferences_cache` | `user_id` | Pull + push |
| `offline_outbox` | `id` | N/A (queue) |
| `sync_errors` | `id` | N/A (error log) |

---

## 6. Offline Outbox — Extended Operations

Current: only `create_transaction`.

Target: queue ALL write operations:

| Operation | Entity | Success Action |
|-----------|--------|----------------|
| `create_transaction` | transactions | Delete from outbox, mutate caches |
| `update_transaction` | transactions | Delete from outbox, mutate caches |
| `delete_transaction` | transactions | Delete from outbox, mutate caches |
| `create_account` | accounts | Delete from outbox, mutate caches |
| `update_account` | accounts | Delete from outbox, mutate caches |
| `delete_account` | accounts | Delete from outbox, mutate caches |
| `reorder_accounts` | accounts | Delete from outbox, mutate caches |
| `create_goal` | goals | Delete from outbox, mutate caches |
| `update_goal` | goals | Delete from outbox, mutate caches |
| `delete_goal` | goals | Delete from outbox, mutate caches |
| `add_goal_contribution` | goal_contributions | Delete from outbox, mutate caches |
| `create_beneficiary` | beneficiaries | Delete from outbox, mutate caches |
| `update_beneficiary` | beneficiaries | Delete from outbox, mutate caches |
| `delete_beneficiary` | beneficiaries | Delete from outbox, mutate caches |
| `create_subscription` | subscriptions | Delete from outbox, mutate caches |
| `update_subscription` | subscriptions | Delete from outbox, mutate caches |
| `delete_subscription` | subscriptions | Delete from outbox, mutate caches |
| `create_budget` | budgets | Delete from outbox, mutate caches |
| `update_budget` | budgets | Delete from outbox, mutate caches |
| `create_debt` | debts | Delete from outbox, mutate caches |
| `pay_debt` | debts + debt_payments | Delete from outbox, mutate caches |
| `create_transfer` | transfers | Delete from outbox, mutate caches |
| `pay_credit_card` | credit_payments + accounts | Delete from outbox, mutate caches |
| `update_profile` | profiles | Delete from outbox, mutate caches |
| `update_notification_prefs` | notification_preferences | Delete from outbox, mutate caches |

### Idempotency

Every outbox item carries:
- `idempotency_key`: `clientId-operationType-timestamp`
- On sync: server checks `metadata->>idempotency_key` for transactions
- Custom idempotency check for other entities via `client_generated_id` in metadata

---

## 7. Auth Offline Strategy

### 7.1 Session Persistence

- `@supabase/ssr`'s `createBrowserClient` stores session in `localStorage` key `sb-<project-ref>-auth-token`
- When offline, this session is still available
- `supabase.auth.getSession()` returns the cached session immediately
- `supabase.auth.getUser()` may fail offline → fallback to cached user info

### 7.2 Auth Guard (Replaces Middleware)

Create `<AuthenticatedRoute>` client component:
```tsx
function AuthenticatedRoute({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.push('/auth/login')
      } else {
        setSession(data.session)
      }
      setLoading(false)
    })
  }, [])

  if (loading) return <Skeleton />
  return children
}
```

### 7.3 Offline Auth

- If `getSession()` returns a cached session, allow access even offline
- Show offline banner: "Estás sin conexión. Los cambios se sincronizarán cuando te conectes."
- Block operations that strictly require server validation (Stripe purchases)
- Allow all CRUD operations offline

---

## 8. Capacitor Configuration

### 8.1 Remove `server.url`

Current:
```json
"server": {
  "url": "https://micuadre-five.vercel.app",
  "cleartext": false,
  "overrideUserAgent": "...",
  "allowNavigation": ["micuadre-five.vercel.app", "*.supabase.co"]
}
```

Target:
```json
{
  "appId": "app.micuadre.ios",
  "appName": "MiCuadre",
  "webDir": "dist/micuadre",
  "bundledWebRuntime": false,
  "server": {
    "allowNavigation": ["*.supabase.co"]
  }
}
```

### 8.2 Build Pipeline

Add to `package.json`:
```json
"scripts": {
  "build:mobile": "next build && next export -o dist/micuadre && npx cap sync ios",
  "build:mobile:copy": "npx cap copy ios"
}
```

### 8.3 Capacitor Plugins

Install:
- `@capacitor/network` — detect online/offline natively (more reliable than `navigator.onLine`)

Consider (future):
- `@capacitor-community/sqlite` — if IndexedDB performance is insufficient
- `@capacitor/splash-screen` — show splash while app loads
- `@capacitor/status-bar` — native status bar theming

---

## 9. Sync Engine Enhancements

### 9.1 Two-Way Sync

Current: one-way push (outbox → server).
Target: push local changes + pull remote changes.

**Pull sync** (on reconnect):
```
1. Get last_sync_timestamp from local state
2. For each entity type:
   supabase.from(table)
     .select('*')
     .gte('updated_at', last_sync_timestamp)
     .eq('user_id', userId)
   → Upsert each result into IndexedDB
3. Delete from IndexedDB any records deleted server-side
   (requires soft-delete or a deleted_at tracking table)
4. Update last_sync_timestamp
```

### 9.2 Conflict Resolution

Strategy: **Last writer wins** (LWW) with timestamp comparison.

- Each record has `updated_at` timestamp
- On sync: compare local vs server `updated_at`
- Whichever is newer wins
- If a conflict occurs and local lost, notify user via in-app notification
- Track conflicts in `sync_errors` for user review

### 9.3 Sync Status UI

Current: banner with pending/syncing/failed.
Target: add per-entity sync status with granular error messages.

---

## 10. Phase 1 — Migration to Static Export

### 10.1 Files to Create

| File | Purpose |
|------|---------|
| `components/auth/authenticated-route.tsx` | Client-side auth guard wrapper |
| `components/auth/public-route.tsx` | Redirect authenticated users away from login/signup |
| `lib/auth/client-auth.ts` | Client-side auth utilities (session check, sign out) |
| `app/auth/callback/page.tsx` | Client-side OAuth callback handler |
| `app/__offline/page.tsx` | Offline fallback page (service worker) |

### 10.2 Files to Modify

| File | Change |
|------|--------|
| `next.user-config.mjs` | Add `output: 'export'`, configure `distDir` |
| `app/page.tsx` | Remove SSR auth check, add client-side auth redirect |
| `app/layout.tsx` | Remove server components, make client-only |
| All `app/*/page.tsx` redirect shims | Convert to client-side redirects |
| `lib/supabase/client.ts` | May need to switch from `@supabase/ssr` to `@supabase/supabase-js` `createClient` for PKCE |
| `hooks/use-data.ts` | Update profiles fetching to use client query |
| `lib/offline/db.ts` | Add new object stores for all entities |
| `lib/offline/sync-engine.ts` | Add pull sync + extended operations |
| `app/api/profile/notification-preferences/route.ts` | Remove — move to client |

### 10.3 Files to Remove (or skip import)

| File | Reason |
|------|--------|
| `lib/supabase/server.ts` | No SSR server needed |
| `lib/supabase/middleware.ts` | No middleware needed |
| `lib/supabase/admin.ts` | Stays on Vercel as separate module |
| `middleware.ts` (if exists) | No middleware needed |
| `proxy.ts` | No middleware proxy needed |
| `lib/env/server.ts` | No server env validation needed |

### 10.4 API Routes — Keep on Vercel (add as separate `api/` folder)

These stay as serverless functions behind the static export:
- Stripe checkout, portal, webhooks
- Cron subscription processor
- Push notification sender
- Coach IA, MIA chat
- Account deletion

The Capacitor app calls these via fetch when online.

---

## 11. Phase 2 — Extend Offline Queue to All Entities

### 11.1 Changes to `lib/offline/db.ts`

- Add object stores for each entity (see section 5.2)
- Add index for `user_id` on each store
- Add helper methods: `getByEntity()`, `getAllCached()`, `upsertCache()`

### 11.2 Changes to Fetchers in `hooks/use-data.ts`

Each fetcher already has offline fallback. Extend to:
- Store more entity types in IndexedDB
- Cache categories, goals, beneficiaries, subscriptions, budgets, debts
- Merge outbox items for all entity types (not just transactions)

### 11.3 Changes to Mutation Functions

Each mutation (create, update, delete) should:
1. Try server write
2. On failure: save to outbox + optimistic UI update
3. In skipOutbox mode: skip the queue

### 11.4 Changes to `lib/offline/sync-engine.ts`

Extend `syncPendingOperations()` to handle all operation types:
- Map each operation type to its corresponding server write function
- Handle entity-specific idempotency
- Handle complex operations (payCreditCard = multiple DB writes)
- Add pull sync for data freshness

---

## 12. Phase 3 — Polish & Native Integration

- Install `@capacitor/network` for reliable connectivity detection
- Add `@capacitor/splash-screen` for loading state
- Add offline indicator in the iOS status bar area
- Optimize IndexedDB performance for large datasets
- Add migration system for local schema changes
- Add "force sync" button in settings
- Show sync history with timestamps of last successful sync

---

## 13. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| `output: 'export'` breaks dynamic routes | Medium | High | Use `generateStaticParams` for dynamic pages |
| Supabase token expires while offline | Low | Medium | Short sessions (1h). On resume, if token expired, redirect to login with sync pending warning |
| Sync conflicts corrupt data | Low | High | LWW with `updated_at`. Show conflict notifications. Manual override option |
| IndexedDB size limits on iOS | Low | Medium | Cap cache at 50MB. Prune old data. Consider SQLite if needed |
| Capacitor WKWebView caching issues | Medium | Medium | Disable WKWebView built-in cache, rely on service worker |
| Client Supabase URL/anon key exposed | None | — | Already in web app. No change |
| Stripe checkout flow in static export | Low | High | Keep checkout route on Vercel. Open in Safari/Chrome via URL |

---

## 14. Acceptance Criteria

1. ✅ App loads fully on iPhone without internet (Capacitor)
2. ✅ All data entities readable offline (transactions, accounts, categories, goals, etc.)
3. ✅ All write operations queue when offline
4. ✅ Sync engine pushes queued writes when connectivity resumes
5. ✅ Sync engine pulls remote changes on reconnect
6. ✅ Auth persists offline (cached session)
7. ✅ Online/offline status visible in UI
8. ✅ No breaking changes to the web (Vercel-hosted) version
9. ✅ All 13 API routes either migrated to client or kept stable on Vercel

---

## 15. Migration Checklist

### Critical Path (blocking)
- [ ] `next.config.mjs` — add `output: 'export'`
- [ ] `lib/supabase/client.ts` — verify PKCE auth works in static export
- [ ] `app/page.tsx` — convert from SSR redirect to client-side auth check
- [ ] Root layout — remove any dependency on `cookies()` or `headers()`
- [ ] Create `<AuthenticatedRoute>` component
- [ ] Test: app builds and exports as static HTML
- [ ] Test: static export loads in Capacitor iOS

### Offline Data Layer
- [ ] Extend `OfflineDB` with all entity stores
- [ ] Update all SWR fetchers to cache to IndexedDB
- [ ] Update all SWR fetchers to fall back to IndexedDB
- [ ] Extend outbox operations to cover all mutations
- [ ] Extend sync engine for all operation types + pull sync
- [ ] Add connectivity detection via Capacitor Network plugin

### Auth
- [ ] Remove `lib/supabase/server.ts` imports
- [ ] Remove middleware auth guard
- [ ] Implement client-side auth guard
- [ ] Test: auth login → offline → app still works
- [ ] Test: auth → offline → wait 1h → resume → redirect to login

### API Route Migration
- [ ] Move sync-profile, billing-status, notification-preferences, coach-ia-check, export to client
- [ ] Verify remaining API routes (Stripe, webhooks, cron, MIA) work as standalone endpoints
- [ ] Update app to call remaining API routes via fetch

### Build Pipeline
- [ ] Add `build:mobile` script
- [ ] Configure Capacitor `webDir` path
- [ ] Remove `server.url` from `capacitor.config.json`
- [ ] Test: `npm run build:mobile && npx cap run ios`
