# MiCuadre — Documentación Técnica Completa

Esta guía contiene tanto la **arquitectura conceptual** del proyecto como las **instrucciones operativas** para el agente.
Toda pregunta, implementación o decisión debe basarse en esta información.

---

## 1. OBJETIVO DEL PROYECTO Y PROPÓSITO

**MiCuadre** es una **aplicación PWA financiera para el mercado dominicano** diseñada como control holístico de finanzas personales con inteligencia artificial integrada.

### Problema que resuelve
- **Fragmentación financiera:** Múltiples cuentas (efectivo, débito, crédito), suscripciones recurrentes y deudas sin visión consolidada.
- **Falta de presupuestación:** Sin herramientas accesibles para planificar gastos y metas de ahorro.
- **Deuda de tarjeta de crédito no gestionada:** Gestión manual de ciclos de pago, intereses y comisiones.
- **Asesoría financiera inaccesible:** Recomendaciones personalizadas sin pagar asesor.

### Flujo principal del usuario
1. **Autenticación** → Onboarding → Gestión de perfiles
2. **Ingesta de datos** → Agregar cuentas (efectivo, débito, crédito), transacciones manuales u OCR
3. **Análisis** → Dashboard con resumen, historial, insights automáticos
4. **Planificación** → Presupuestos, metas de ahorro, deuda tracking, suscripciones recurrentes
5. **Copiloto IA (MIA)** → Consultas, análisis de tendencias, recomendaciones
6. **Acciones** → Transferencias, pagos de tarjeta, confirmación con undo-delete

### Propuesta de valor
- **Consolidación 360°** de todas las finanzas
- **Automatización inteligente** (ciclos de crédito, alertas de suscripción)
- **IA conversacional (MIA)** para decisiones financieras
- **Offline-first** para acceso sin conexión
- **Móvil nativo** (iOS vía Capacitor) + web responsive
- **Monetización** Free/Pro basada en límites de uso

---

## 2. ARQUITECTURA Y STACK TECNOLÓGICO

| Componente | Tecnología | Versión | Rol |
|-----------|-----------|---------|-----|
| Frontend Framework | Next.js App Router | 16.2.4 | SSR + Rutas dinámicas + API routes |
| Runtime JS | React | 19 | Componentes + Hooks custom |
| Lenguaje | TypeScript | 5.7.3 | Type safety (strict mode) |
| Styling | Tailwind CSS | 4.2.0 | Utility-first + dark mode |
| BaaS / Auth | Supabase | 2.105.1 | PostgreSQL + Auth + RLS |
| Estado del cliente | SWR | 2.4.1 | Data fetching con caché |
| Almacenamiento offline | IndexedDB | Nativo | Cache local + Outbox para sync |
| Componentes UI | Radix UI | Latest | Accesibilidad + primitivos |
| Forms | React Hook Form + Zod | 7.54.1 + 3.24.1 | Validación + tipos |
| Notificaciones | Web Push API + Sonner | 1.7.1 | Push + toasts |
| Gráficos | Recharts | 2.15.0 | Visualización |
| OCR | Tesseract.js | 7.0.0 | Escaneo de recibos (cliente) |
| Pagos | Stripe | 22.1.1 | Suscripciones Free/Pro |
| Rate Limiting | Upstash (Redis) | 1.38.0 | Protección de APIs |
| Mobile | Capacitor | 7.6.7 | Web → iOS (static export) |
| Build | Turbopack | Integrado | Empaquetado rápido |

### Interacción entre componentes

```
┌─────────────────────────────────────────────────────────────────┐
│                         USUARIO (Web/iOS)                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP/HTTPS (SSR + Hydration)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Next.js 16 (App Router) — /app/* pages + API routes             │
│  ├─ Client Components (React 19 + Hooks)                         │
│  │  ├─ useAuth() → Supabase client auth                         │
│  │  ├─ useData() → SWR + Supabase queries                       │
│  │  ├─ useEntitlements() → Plan tier logic                      │
│  │  └─ Custom hooks (use-planning, use-billing-status, etc.)    │
│  ├─ Server Components (API routes)                               │
│  │  ├─ /api/billing/* → Stripe sync + rate limit                │
│  │  ├─ /api/mia/* → Coach IA                                   │
│  │  ├─ /api/ocr/* → Tesseract OCR processing                   │
│  │  └─ Middleware: Auth guard + Route protection               │
│  └─ Offline Support                                              │
│     └─ Service Worker (public/sw.js)                            │
└──────────────────────────┬──────────────────────────────────────┘
                           │ CRUD
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│         Supabase (PostgreSQL + Auth + Real-time)                 │
│  ├─ Tables:                                                      │
│  │  ├─ profiles (user_id, plan_tier, onboarding_completed)      │
│  │  ├─ accounts (cash/debit/credit)                             │
│  │  ├─ transactions (income/expense, metadata)                  │
│  │  ├─ categories (user categories)                             │
│  │  ├─ budgets (monthly limits by category)                     │
│  │  ├─ goals (savings targets)                                  │
│  │  ├─ financial_subscriptions (Netflix, Spotify, etc.)         │
│  │  ├─ debts (credit card cycles + payments)                    │
│  │  ├─ beneficiaries (transfer recipients)                      │
│  │  ├─ credit_card_cycles (statement + payment tracking)        │
│  │  └─ notifications (system + user alerts)                     │
│  └─ RLS Policies (Row-Level Security)                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
   ┌─────────┐        ┌─────────┐      ┌──────────┐
   │IndexedDB│        │ Stripe  │      │  z-ai-  │
   │(Offline)│        │ Billing │      │  web-dev│
   │Outbox   │        │         │      │  SDK    │
   └─────────┘       └─────────┘      └──────────┘
```

---

## 3. ESTRUCTURA DE DIRECTORIOS

```
MiCuadre/
├── app/                                 # Next.js App Router (SSR + API routes)
│   ├── page.tsx                         # "/" → Landing o redirect según auth
│   ├── dashboard/                       # Dashboard principal
│   ├── accounts/
│   │   ├── page.tsx
│   │   └── [id]/                        # Detalle de cuenta individual
│   ├── history/                         # Lista de transacciones + filtros
│   ├── goals/
│   │   ├── page.tsx
│   │   └── [id]/                        # Detalle de meta individual
│   ├── planning/                        # Presupuestos + deudas + calendario
│   ├── expense/                         # Detalle de gasto
│   ├── pay/                             # Flujo de pago de tarjeta
│   ├── coach-ia/                        # Interfaz de MIA
│   ├── send/                            # Transferencias
│   ├── scan/                            # Escaneo OCR
│   ├── profile/                         # Perfil de usuario
│   ├── notifications/                   # Centro de notificaciones
│   ├── settings/                        # Perfil + preferencias
│   │   ├── page.tsx
│   │   ├── categories/
│   │   ├── notifications/
│   │   ├── plan/
│   │   ├── reports/
│   │   ├── security/
│   │   ├── security-privacy/
│   │   ├── subscriptions/
│   │   ├── about/
│   │   └── help/
│   ├── auth/
│   │   ├── login/ sign-up/ callback/    # Auth entry components
│   │   ├── forgot-password/
│   │   └── error/ sign-up-success/
│   ├── onboarding/                      # Flujo de primera vez
│   ├── legal/                           # términos, privacidad, aviso-legal
│   ├── inicio/  login/  register/       # Rutas alternas de landing/auth
│   ├── forgot-password/  reset-password/  verify-email/
│   ├── offline/                         # Offline fallback page
│   ├── qa/                              # QA testing page
│   ├── error/                           # Error boundary
│   └── api/                             # API routes
│       ├── billing/ (status, checkout, portal)
│       ├── mia/chat/
│       ├── coach-ia/
│       ├── ocr/receipt/
│       ├── webhooks/stripe/
│       ├── push/send/
│       ├── user/coach-ia-check/
│       ├── profile/notification-preferences/
│       ├── auth/sync-profile/
│       ├── account/ (export, delete)
│       └── cron/process-subscriptions/
│
├── components/                          # Componentes React reutilizables (25 módulos)
│   ├── accounts/  auth/  billing/
│   ├── credit-cards/ (incl. pay-card/)
│   ├── dashboard/  entitlements/  expense/
│   ├── history/  landing/  legal/
│   ├── navigation/  notifications/  ocr/
│   ├── payment-slider/  planning/  providers/
│   ├── pull-to-refresh/  pwa/  receipts/
│   ├── security/  settings/  swipe-actions/
│   ├── toast/  transactions/
│   └── ui/                              # ~68 shadcn-style primitives
│
├── hooks/                               # Custom hooks (12 total)
│   ├── use-auth.ts  use-data.ts  use-planning.ts
│   ├── use-entitlements.ts  use-entitlement-blocked.ts
│   ├── use-billing-status.ts  use-pull-to-refresh.ts
│   ├── use-undo-delete.ts  use-mobile.ts  use-toast.ts
│   ├── use-persistent-state.ts          # No documentado
│   └── use-swipe.ts                     # No documentado
│
├── lib/                                 # Lógica de negocio pura (36+ archivos)
│   ├── supabase/ (client, server, middleware, admin, user)
│   ├── offline/ (db, outbox, sync-engine)
│   ├── entitlements/ (entitlements, test-user, server, copy, check)
│   ├── billing/ (plans, sync-billing-state)
│   ├── mia/ (access, agent, tools, schemas, snapshots, prompts)
│   ├── planning/ (budgets, calendar, debts)
│   ├── transactions/ (reporting)
│   ├── ledger/ (ledger-service, constants)
│   ├── notifications/ (push-dispatcher, format, type-map)
│   ├── ocr/ (receipt-extractor, types, validate, vision-client)
│   ├── a11y/ (use-modal-a11y)
│   ├── i18n/ (translations, use-translations)
│   ├── pwa/ (precache-routes)
│   ├── validations/ (auth, billing, notifications)
│   ├── env/ (server)
│   ├── types/ (database.ts)
│   └── (+ root files: data, coach-ia, credit-cycle, fin-score, insights, etc.)
│
├── types/                               # Shared TypeScript interfaces
│   ├── billing.ts
│   └── planning.ts
│
├── public/                              # Static assets
│   ├── manifest.json                    # PWA manifest
│   ├── sw.js                            # Service Worker
│   └── (iconos, audio, fallbacks)
│
├── docs/                                # Documentación + auditorías (38 archivos)
│
├── scripts/                             # Build + utilidades
│   ├── fix-asset-paths.mjs / postbuild-export.mjs / prebuild-mobile.mjs
│   ├── screenshot.mjs / audit-visual.mjs / audit-visual-deep.mjs
│   ├── check-connections.mjs
│   └── (*.sql migrations, ~40+ scripts)
│
├── ios/                                 # Capacitor iOS
│   └── App/
│
├── .api-backup/                         # Backup de API routes para mobile build
├── compositions/                        # HyperFrames assets
├── icons/                               # WebP icons
├── templates/                           # Agent docs templates
├── screenshots/                         # Playwright screenshots
│
├── next.config.mjs                      # v0-generated (NO EDITAR)
├── next.user-config.mjs                 # Overrides de configuración
├── middleware.ts                        # ❌ NO EXISTE EN RAÍZ (ver sección 10)
├── tsconfig.json                        # TypeScript strict
├── postcss.config.mjs
├── eslint.config.mjs                    # ESLint v9 flat config
├── components.json                      # shadcn/ui registry
├── capacitor.config.json
├── package.json
└── pnpm-lock.yaml
```

### Notas sobre la estructura real vs documentada
- `app/transactions/` **no existe** — solo existe `app/history/` (el middleware referencia `/transactions` como ruta protegida pero la página no está)
- `middleware.ts` **no existe en la raíz** — está en `lib/supabase/middleware.ts` pero Next.js no lo detecta automáticamente ahí
- `tailwind.config.ts` **no existe** — Tailwind v4 usa configuración CSS nativa en `app/globals.css`
- Los paquetes `@capacitor/*` **no están en package.json** — existen `capacitor.config.json` y `ios/` pero los npm packages no están instalados
- Hay **16 rutas de página no documentadas** en `app/` (send, scan, profile, legal/*, offline, qa, etc.)

---

## 4. MOTORES CRÍTICOS DEL PROYECTO (4 PILARES)

### 🔴 Motor 1: `hooks/use-data.ts` — SWR + Offline Hybrid

**Responsabilidad:** Gestión centralizada de TODAS las lecturas/escrituras con soporte offline-first.

```typescript
// Lectura
useAccounts() → SWR("accounts", fetchAccounts)
useTransactions() → SWR("transactions", fetchTransactions)
useProfile() → SWR("profile", fetchProfile)
useFinancialSubscriptions() → SWR(...)

// Escritura
createTransaction(payload)
  ├─ Online → Supabase insert
  └─ Offline → offlineDB.put("offline_outbox", item) + idempotency key

createAccount(name, type, currency)
deleteTransaction(id) → { pending, undo } via useUndoDelete

// Helpers
applyAccountImpact(transaction) → Actualiza balance
syncAccountBalance() → Recalcula deuda de tarjeta
```

**Por qué es crítico:** Fuente única de verdad, tolerancia offline, idempotencia, performance (SWR dedup).

### 🔴 Motor 2: `lib/offline/db.ts` — IndexedDB Wrapper

**Estructura:** Singleton con 3 stores: caches de lectura, outbox de escritura, sync errors log.

**Operaciones Outbox (33 total):**
`create_transaction | update_transaction | delete_transaction | create_account | update_account | delete_account | create_budget | pay_credit_card | create_goal | add_goal_contribution | create_subscription | create_beneficiary | ...`

**Por qué es crítico:** Backbone de offline-first, idempotency keys previenen duplicados, error tracking, background sync.

### 🔴 Motor 3: `lib/supabase/middleware.ts` — Auth Guard + Routing

**Middleware server-side que:**
1. Crea Supabase server client
2. Obtiene usuario + verifica onboarding_completed
3. Aplica reglas de enrutamiento (protegidas ↔ públicas)
4. Maneja email verification

**Rutas protegidas:**
```
/dashboard, /accounts, /transactions, /history, /goals, /planning,
/settings, /expense, /notifications, /onboarding, /send, /pay, /profile, /scan
```

**Rutas públicas:**
```
/, /auth/login, /auth/sign-up, /auth/callback, /auth/forgot-password,
/auth/error, /auth/sign-up-success, /verify-email
```

**Por qué es crítico:** Seguridad server-side, onboarding flow forzado, session management, email verification.

### 🔴 Motor 4: `lib/entitlements/entitlements.ts` — Feature Gating Matrix

**Matriz Free vs Pro:**
| Feature | Free | Pro |
|---------|------|-----|
| max_accounts | 3 | unlimited |
| max_daily_transactions | 10 | unlimited |
| max_goals | 2 | unlimited |
| max_budgets | 0 | unlimited |
| max_active_debts | 0 | unlimited |
| planning_full | ❌ | ✓ |
| advanced_reports | ❌ | ✓ |
| exports | ❌ | ✓ |
| mia_advanced | ❌ | ✓ |
| financial_subscriptions | 1 | unlimited |

**Por qué es crítico:** Monetización centralizada, fácil de escalar, checks server + client, UX consistente.

---

## 5. FLUJOS DE DATOS E INTEGRACIONES

### 5.1 Autenticación
```
User → [/auth/login] → Supabase Auth → middleware.ts (JWT check)
→ useAuth() (session browser) → Dashboard o redirect
```

### 5.2 Lectura de datos (SWR)
```
useSWR("accounts", fetch) → Cache hit? → Render → Background mutate
```

### 5.3 Escritura (Offline Outbox)
```
Submit → Online? → Supabase INSERT + mutate()
       → Offline? → IndexedDB outbox → Background sync cuando online
```

### 5.4 Feature gating (Entitlements)
```
useEntitlements() → plan_tier → ENTITLEMENTS_BY_PLAN → allowed? → UI
```

### 5.5 Stripe (Suscripción)
```
PlanSelectorSheet → /api/billing/checkout → Stripe Checkout
→ Webhook → UPDATE profiles.plan_tier → mutate("profile")
```

### 5.6 Coach IA (MIA)
```
User query → detectIntent() → POST /api/mia/query → rate-limit → assertMiaAccess()
→ Snapshot datos → LLM (z-ai-web-dev-sdk) → CoachResponse → UI
```

### 5.7 OCR (Escaneo de recibos)
```
ReceiptScanner → Tesseract.js (cliente) → POST /api/ocr/process → LLM post-processing
→ structured JSON → User review → createTransaction()
```

### 5.8 Notificaciones push
```
PushNotificationCard → requestPermission() → Subscribe SW → Backend
→ web-push → Browser → SW display → Click → redirect
```

---

## 6. COMANDOS VERIFICADOS

```bash
npm run dev              # Dev server Next.js
npm run build            # Producción SSR
npm run build:mobile     # Static export + Capacitor
npm run start            # Iniciar build
npm run lint             # ESLint (falla: eslint no está en devDependencies)

# Mobile pipeline
npm run build:mobile     # prebuild → build → postbuild
npx cap copy ios         # Copiar out/ → ios/App/public/
npx cap sync ios         # Sync + regenerar Package.swift
```

### Mobile Build Pipeline
1. `prebuild:mobile` → mueve `app/api/` → `.api-backup/`
2. `build:mobile` → `next build` con `BUILD_EXPORT=true`
3. `postbuild:mobile` → `fix-asset-paths.mjs && postbuild-export.mjs`
   - `fix-asset-paths.mjs`: convierte rutas absolutas `/_next/...` a relativas
   - `postbuild-export.mjs`: restaura `app/api/` desde `.api-backup/`

---

## 7. REGLAS DE UI Y DISEÑO

### Dark Mode (CRÍTICO — sin regresiones)
- NUNCA usar colores hardcodeados (`bg-white`, `bg-black`, `bg-gray-*`, `text-white`, `text-gray-*`)
- SIEMPRE usar variables semánticas: `bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`, `border-border`
- Colores de categoría: `bg-orange-100/30 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400`
- Modales overlay: `bg-foreground/20 backdrop-blur-sm`
- Botones destructivos: `bg-destructive text-destructive-foreground`

### Convenciones del proyecto
- Path alias `@/*` habilitado
- UI shadcn-style (`components/ui`) con Tailwind v4
- Bottom nav visible en toda la app excepto `/auth*` y `/onboarding*`
- Cada `components/*/` tiene barrel file (`index.ts`) → importar desde ahí
- `next.config.mjs` es generado por v0 → NO EDITAR. Usar `next.user-config.mjs`

### Expense Form (Nueva transacción)
- Botón "+" (Nueva categoría) PRIMERO en la lista
- Amount sin `mobile-card` wrapper
- Currency selector y commission toggle en la misma fila
- Bottom navbar visible
- Header: "Nueva transacción" con chevron de retroceso

---

## 8. PATRONES DE CORRECCIÓN CONOCIDOS

### `position: fixed` dentro de `.mobile-page`
- **Causa:** CSS keyframe en `.mobile-page` crea containing block
- **Fix:** Mover elemento fixed FUERA de `MobilePageShell` como sibling de `<main>`

### CoachIAWidget solapado con plan selector sheets
- **Fix:** `{!showWelcomePlanPrompt && !planningUpsellOpen && <CoachIAWidget />}`

### Welcome plan prompt gates
- **Regla:** Free users → 1 vez. Pro → nunca.
- **Fix:** Check `!isPro` + localStorage `micuadre_plan_prompt_seen_{profile_id}`

### iOS Safari auto-zoom en inputs
- **Fix:** `@media (hover: none) and (pointer: coarse) { input, select, textarea { font-size: 16px !important; } }`

### Bottom nav (rediseño actual)
- Flat bar: `bg-card`, `border-t`, `h-[4.5rem]`
- Active: `scale-110 drop-shadow-sm` (no pill background)
- Sin `backdrop-blur`, sin `mx-4`

### MovementReceipt (recibo centrado compartido)
- **Regla:** TODOS los tipos de transacción usan `MovementReceipt`
- **Posición:** `fixed inset-0 flex items-center justify-center p-4`
- **Backdrop:** `bg-black/50`
- **Faltantes:** `quick-pay-card-sheet.tsx`, `expense-form.tsx`

### Planning action buttons → in-app sheets
- **Regla:** "Pagar tarjeta", "Pagar cuota", "Pagar" → Vaul bottom drawer (no `<Link>`)
- **Fix:** `<button onClick={() => onAction?.(event)}>` con callback `navigateFromEvent`

### Form validation → toast siempre
- **Regla:** Todo error de validación muestra inline error + toast
- **Fix:** `notify({ title: "Validación", message: "..." })` junto a `setFormError()`

### Credit-card payment receipt — field reduction
- **Incluir:** Title, large amount, transaction type, origin (name + last-4), destination (name + last-4), date/time, DGII tax, random transaction number (max 12 dígitos)
- **NO incluir:** Balance antes/después, reference numbers, NCF, conceptos

### Amount input font-size
- Mínimo: `text-xl font-bold` (20px)
- Primary flow: `text-[clamp(2.75rem,15vw,4.5rem)]`

### Account cards visibles a través de modales (stacking context leak)
- **Síntoma:** `BrandedAccountCard` visible detrás del modal portaleado
- **Fix:** `hidden` en `MobilePageShell` cuando modal abierto (no `invisible`)
- **Ejemplo:** `className={cn("pb-nav-safe", showTransfer && "hidden")}`

---

## 9. CAPACITOR / iOS

### Requisitos
- Capacitor **7.6.7** — NO usar 8.x (incompatible con Swift sources de plugins)
- `capacitor.config.json`: `webDir: "out"`, `scheme: "micuadre"`
- `server.url` puede estar seteado a producción; quitarlo para local testing

### Simuladores disponibles
| Device | UUID |
|--------|------|
| iPhone 16 Pro | `672AB44F-A760-4AB6-9126-4D3853254F5A` |
| iPhone 16 Pro Max | `EBA46CA1-F4D0-497B-BD06-68E2352C6DAA` |
| iPhone 16 | `2517F99F-174A-48D4-B2B0-1581237E6563` |
| iPhone SE (3rd gen) | `9767878D-41FA-456A-9F09-954E4E7D6947` |

### Build completo (Web → iOS Simulator)
```bash
npm run build:mobile
export DEVELOPER_DIR=/Users/papolo/Downloads/Xcode.app/Contents/Developer
npx cap sync ios
xcrun xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -sdk iphonesimulator -destination 'platform=iOS Simulator,id=672AB44F-...' \
  -derivedDataPath /tmp/micuadre-dd CODE_SIGNING_ALLOWED=NO build
xcrun simctl boot <UUID>
xcrun simctl install <UUID> /tmp/micuadre-dd/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch <UUID> app.micuadre.ios
```

---

## 10. GOTCHAS Y DEUDA TÉCNICA

### Config Gotchas
- `next.config.mjs` = v0-generated → NO EDITAR. Usar `next.user-config.mjs`
- `package-lock.json` y `pnpm-lock.yaml` coexisten; preferir pnpm
- SQL scripts en `scripts/*.sql` sin migration runner

### Problemas conocidos
- Capacitor 7.6.7 en línea (8.x incompatible con Swift sources)
- ESLint no instalado en devDependencies (`npm run lint` falla)
- Static export requiere post-procesamiento de paths (`fix-asset-paths.mjs`)
- No hay migration runner (SQL scripts manuales)
- `prebuild:mobile` deja repo en estado roto si build falla → `node scripts/postbuild-export.mjs` para restaurar
- `cross-env` puede faltar en node_modules → `pnpm add -D cross-env@^10.1.0`
- `capacitor.config.json` `server.url` sobreescribe bundle local
- SPM Package.swift puede generar backslashes en Windows
- Stale git rebase state (archivos con " 2" en `.git/rebase-merge/`)

### Troubleshooting
- `ENOENT: .next/dev/routes-manifest.json` → `pnpm run dev:reset` (después de `npm run build`)
- iOS simulator no encuentra Xcode → `export DEVELOPER_DIR=/Users/papolo/Downloads/Xcode.app/Contents/Developer`

---

## 11. DISCREPANCIAS CONOCIDAS (DOC VS REALIDAD)

### 🔴 Críticas
1. **`middleware.ts` no está en la raíz** — está en `lib/supabase/middleware.ts`. Next.js NO lo detecta automáticamente. El auth guard server-side no funciona hasta que se cree un re-export en `middleware.ts` en la raíz.
2. **`app/transactions/` no existe** — el middleware la lista como ruta protegida pero el directorio no existe. Solo existe `app/history/`.
3. **Paquetes `@capacitor/*` ausentes en package.json** — `capacitor.config.json` y `ios/` existen pero los npm packages no están instalados. El pipeline mobile fallaría en un checkout fresco.

### ⚠️ Moderadas
4. **No hay `tailwind.config.ts`** — Tailwind v4 usa configuración CSS nativa en `app/globals.css`, no archivo JS/TS de configuración.
5. **16 rutas de página no documentadas** en `app/` (send, scan, profile, legal/*, offline, qa, settings/*, goals/[id], etc.)
6. **2 hooks no documentados**: `use-persistent-state.ts` y `use-swipe.ts`
7. **6 subdirectorios de `lib/` no documentados**: `a11y/`, `i18n/`, `notifications/`, `ocr/`, `pwa/`, `validations/`
8. **`docs/` no mencionado** en la estructura de directorios — contiene 38 archivos de diseño y auditoría

### 📝 Menores
9. **`.api-backup/`** documentado solo en el pipeline mobile pero no en el árbol de directorios
10. **40+ scripts SQL** en `scripts/` sin migration runner
11. **`upstash/ratelimit`** documentado como `1.38.0` pero instalado como `^2.0.8`

---

## 12. VISUAL SCREENSHOT DEBUGGING

```bash
npm run screenshot -- --route=dashboard        # Desktop viewport
npm run screenshot -- --route=dashboard --mobile  # Mobile (430x932)
npm run screenshot -- --route=dashboard --fullpage # Scroll capture
npm run screenshot:all                          # Todas las rutas protegidas
```

- Rutas disponibles: dashboard, accounts, pay, expense, history, goals, planning, coach-ia, notifications, profile, settings, settings-plan, settings-categories, settings-security, onboarding, login, signup
- Requiere `TEST_EMAIL` y `TEST_PASSWORD` en env vars
- Screenshots en `screenshots/`
- Funciona contra `http://localhost:3000` (override con `BASE_URL`)

### Visual QA Audit
```bash
npm run audit:visual       # Full mobile audit (50+ screenshots)
npm run audit:visual-deep  # Deep form audit (modals/sheets/drawers)
```
- Captura errores de consola, HTTP, página
- Logs en `screenshots/audit/logs/audit-log.json`
- Reporte en `docs/mobile-visual-qa-audit.md`

---

## 13. VERIFICACIÓN DE CONTRASTE (COMPLETADO)

- Script: `scripts/check-contrast.mjs`
- **Todos los pares texto-sobre-fondo pasan WCAG AA (4.5:1) en ambos modos**
- Light: background–foreground 18.06:1 ✅
- Dark: background–foreground 18.09:1 ✅
- Sin cambios necesarios

---

## 14. ERRATA Y LECCIONES APRENDIDAS (HISTORIAL DE CORRECCIONES)

### 14.1 `update_transaction_safe` — columna `description` faltante en SELECT (jul 2026)

**Síntoma:** Al pagar tarjeta de crédito, error `42703: column "description" does not exist` en el bucle de crédito de `update_transaction_safe`.

**Causa raíz:** La subconsulta `SELECT ... INTO v_ptx` dentro del loop `FOR v_tx IN ... LOOP` no incluía la columna `description`, pero `_record_ledger_entry(..., v_ptx.description, ...)` la requiere.

**Fix:** Añadir `description` a la lista de columnas en `SELECT INTO v_ptx`.

**Lección:** Cada vez que se agregue un parámetro a `_record_ledger_entry`, verificar que todas las llamadas en triggers/funciones existentes lo estén pasando.

### 14.2 Date shift en `EditTransactionSheet` (jul 2026)

**Síntoma:** Al editar una transacción, la fecha se desplazaba un día atrás. Ej: 2026-07-09 se mostraba como 2026-07-08.

**Causa raíz:** `new Date(transaction.date)` interpreta `"2026-07-09"` como UTC midnight (`2026-07-09T00:00:00Z`). Al convertirlo a zona horaria local de República Dominicana (UTC-4), se convierte a `2026-07-08T20:00:00`, desplazando la fecha visible un día atrás.

**Fix:** `new Date(\`${transaction.date}T12:00:00\`)` — forzando el mediodía UTC para evitar el cruce de medianoche.

**Lección:** En husos horarios negativos (UTC-4, UTC-5, etc.), `new Date("YYYY-MM-DD")` siempre desplaza un día antes. Usar siempre `T12:00:00` al construir Dates desde fechas ISO.

### 14.3 Amount field sin estilo consistente (jul 2026)

**Síntoma:** El campo "Monto" en `EditTransactionSheet` aparecía sin bordes/bg, mientras "Descripción" sí los tenía.

**Causa raíz:** `MoneyInput` se renderizaba sin wrapper, mientras `Input` usaba `rounded-xl border border-border bg-background`.

**Fix:** Envolver `MoneyInput` en un `div` con `rounded-xl border border-border bg-background px-4 py-3 focus-within:border-primary/40`.

**Lección:** `MoneyInput` no incluye estilos de borde/fondo por defecto. Siempre debe envolverse igual que los otros inputs del formulario.

### 14.4 Rediseño "Resumen de tarjeta" — redundancias y layout (jul 2026)

**Problemas detectados y corregidos en `account-detail.tsx`:**
- **"Balance actual" era redundante** con "Deuda actual" en el hero section. Se eliminó del resumen.
- **"Pagar antes del" era redundante** con la fecha de pago en el footer del hero card. Se eliminó del resumen.
- **Layout de 2 cards side-by-side** cambiado a **1 card unificado** con **grid de 4 columnas**: Pendiente (pending), Compras (statement_balance), Mínimo (minimum_payment), Financiado (financed_balance).
- **Se agregaron dos métricas nuevas** que antes no se mostraban: "Compras del período" (último corte) y "Financiado" (balance que genera intereses).
- **Badge "Corte y pago" → "Ciclo"** por claridad.

### 14.5 Cutoff date protection — deshabilitar edición de fechas con balance (jul 2026)

**Problema:** Se podían editar las fechas de corte y pago de una tarjeta aunque ya tuviera movimientos registrados, lo que podía desincronizar el ciclo.

**Fix en `edit-credit-card-dialog.tsx`:**
- Los campos de `closing_date` y `due_date` se deshabilitan cuando `currentDebt > 0`.
- Se muestra un `Lock` icon y un mensaje explicativo: *"No puedes cambiar las fechas de corte y pago mientras la tarjeta tenga balance pendiente"*.

### 14.7 `reconcile_account_balance` — función DB con lógica invertida (jul 2026)

**Síntoma:** Las transacciones se creaban pero los balances de las cuentas no se actualizaban en el frontend. Discrepancias de hasta RD$123,123 en cuentas de crédito.

**Causa raíz:** La función `reconcile_account_balance` en la BD tenía la lógica de SUM invertida: `debit=+amount, credit=-amount` en lugar de `credit=+amount, debit=-amount`. Además retornaba `NUMERIC` en vez de `JSONB` y no actualizaba `current_debt_*` para cuentas de crédito — solo `balance`.

**Fix:** Se reemplazó la función completa con la versión correcta del migration `040_backfill_initial_balances.sql` que:
1. Usa `credit=+amount, debit=-amount` en el SUM
2. Retorna `JSONB` con metadatos de corrección
3. Actualiza `current_debt_dop/usd` para cuentas de crédito
4. Usa `GREATEST(..., 0)` para evitar balances negativos

Además, se eliminó el `SECURITY DEFINER` sin `SET search_path` explícito en la versión anterior.

### 14.8 `payCreditCard` — ledger no bloqueante (jul 2026)

**Síntoma:** `payCreditCard` en `hooks/use-data.ts` tenía el ledger write envuelto en un try-catch interno que lo hacía no bloqueante (non-blocking). Si el ledger fallaba, el pago se consideraba exitoso pero los balances quedaban desincronizados.

**Causa raíz:** El ledger write ocurría después de las mutaciones SWR y dentro de `try {} catch(e) { console.error }` sin re-throw. No había rollback.

**Fix:** Se movió el ledger write ANTES de la notificación y mutaciones SWR, y se eliminó el try-catch interno. Si el ledger falla ahora, la excepción propaga al catch exterior que ejecuta rollback completo de todas las operaciones DB.

**Lección:** Cualquier operación de ledger debe ser blocking dentro del mismo try-catch que las DB writes, no después.

### 14.9 Unified icon system — eliminación de maps duplicados (jul 2026)

**Problema:** Tres componentes distintos (`transaction-row.tsx`, `account-detail.tsx`, `expense-form.tsx`) tenían sus propios `categoryIcons`/`categoryColors`/`nameToSlug`/`categoryUiByName` hardcodeados. Las categorías personalizadas siempre caían a `MoreHorizontal` porque el nombre no estaba en el mapa. Además, el campo `icon` de la DB se ignoraba completamente.

**Solución:**
1. Crear `lib/category-icons.ts` — mapa único que cubre las 18 claves seed de la DB, slugs legacy, y claves del expense form. Exporta `categoryIcons` (Record<string, LucideIcon>) y `categoryColors` (Record<string, string>).
2. Los 3 componentes ahora importan desde `lib/category-icons` en lugar de tener sus propios maps.
3. `history-screen.tsx` también eliminó su `nameToSlug` y ahora usa `tx.category?.icon` directamente.
4. La resolución ahora es `categoryIcons[cat.icon]` — si alguien crea una categoría con icon `"car"`, obtiene el ícono correcto.

**Reglas a futuro:**
- No crear nuevos maps de íconos/colores por componente. Importar desde `@/lib/category-icons`.
- Si se agrega una categoría seed nueva, agregar su clave a `lib/category-icons.ts`.
- El campo `categories.icon` en la DB es la fuente de verdad. Los componentes no deben adivinar el ícono por nombre.

---

### 14.10 `syncAccountBalance` — errores silenciosos (jul 2026)

**Síntoma:** Transacciones creadas exitosamente (visibles en history) pero el balance de la cuenta no se actualiza. Discrepancia general entre el registro de movimientos y el saldo mostrado.

**Causa raíz:** `syncAccountBalance` en `hooks/use-data.ts:804-830` tenía 3 fallas de robustez:
1. **Silent return** si el RPC `ledger_calc_balance` devolvía null/undefined — sin error log, sin update.
2. **Update sin verificación** — `await supabase.from("accounts").update(...)` sin capturar `error`.
3. **Sin logging** — imposible diagnosticar por qué falló la sincronización.

Cualquier fallo transitorio (RPC timeout, error de permiso, restricción DB) causaba que el balance quedara desactualizado sin que nadie lo notara.

**Fix:**
1. Se captura `error` del RPC explícitamente.
2. Se verifica `updateError` en ambos paths (crédito y débito).
3. Se agregaron `console.error` con tag `[syncAccountBalance]` para diagnóstico.
4. Se mantiene el patrón **best-effort** (no throw, solo log) para no romper el flujo transaccional — la UI se actualiza vía SWR mutate y el balance se corrige en la próxima operación.

**Lección:** Toda función de sincronización debe (a) verificar errores de cada paso, (b) loguear fallos con contexto suficiente para debugging, (c) decidir entre fail-hard o best-effort según el impacto en la UX transaccional.

---

## 15. MEJORAS DE FILTROS (HISTORY SCREEN) — 10 JUL 2026

### Cambios aplicados en `history-screen.tsx`, `history-filter-content.tsx`, `account-filter-content.tsx`

### 15.1 Reubicación del buscador
El input de búsqueda ("Buscar transacciones...") ya estaba en la vista principal de `history-screen.tsx`, al lado del botón de filtros. No se movió nada — solo se confirmó que no hay búsqueda dentro del Bottom Sheet.

### 15.2 Eliminación de botones de rango rápido
Se eliminó toda la lógica de `DatePreset` (Hoy, 7d, Mes, Todo, Personalizado) que existía en la versión anterior del filtro inline. El Bottom Sheet solo tiene calendario popover para selección manual de fechas.

### 15.3 Rolling 1-month window
- **Rango por defecto:** `1ro del mes actual → hoy`.
- Se calcula con:
  ```typescript
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  const to = new Date() // hoy
  ```
- `startDate` y `endDate` usan `useState` (no `usePersistentState`) para que siempre se reinicien al rango del mes actual al cargar la página.
- El usuario puede sobrescribir el rango manualmente desde el Bottom Sheet si necesita salirse del default.
- **⚠️ Historial de cambios:** Primero se había cambiado a `1ro del mes → 1ro del mes siguiente` (jul 10), pero se revirtió a `1ro del mes → hoy` porque el rango futuro causaba que transacciones recién creadas no aparecieran en la vista por defecto.

### 15.4 Estilos modernizados
- Todos los inputs (fecha, monto, cuenta) ahora usan `rounded-2xl border border-border` en lugar de `rounded-xl border border-input`.
- Se eliminaron las constantes `HISTORY_FILTER_DEFAULTS` y `ACCOUNT_FILTER_DEFAULTS` (no se usaban en ningún lado).

### Archivos modificados
- `components/history/history-screen.tsx`
- `components/filters/history-filter-content.tsx`
- `components/filters/account-filter-content.tsx`
- `components/filters/index.ts`
