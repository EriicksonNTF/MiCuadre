# Agent Notes

## Auditoría Completa de la App - 10 jul 2026

### Error Runtime Corregido
- **`dateFilter is not defined`** en `account-detail.tsx:245` — Era un cache stale de `.next`. La variable no existe en el código fuente. Se limpió con `Remove-Item -Recurse -Force ".next"`.

---

## Problemas Encontrados (17 total)

### 🔴 CRÍTICOS (3)

#### 1. Middleware Raíz Ausente — Auth Guard No Funciona
- **Archivo:** `middleware.ts` (raíz del proyecto) — **NO EXISTE**
- **Ubicación real:** `lib/supabase/middleware.ts`
- **Impacto:** Next.js SOLO detecta `middleware.ts` en la raíz. El auth guard (`updateSession`) que protege rutas, fuerza onboarding y verifica email **no funciona**. Todas las rutas protegidas (`/dashboard`, `/accounts`, `/history`, `/goals`, `/planning`, `/settings`, `/expense`, `/notifications`, `/send`, `/pay`, `/profile`, `/scan`) son accesibles sin autenticación.
- **Fix:** Crear `middleware.ts` en la raíz que re-exporte o llame a `updateSession` desde `lib/supabase/middleware.ts`.

#### 2. Tipo `CreditCardCycle` Falta Campo `is_finalized`
- **Archivo:** `lib/types/database.ts:250-267`
- **Problema:** La interfaz `CreditCardCycle` no define `is_finalized`, pero este campo se consulta y escribe en `hooks/use-data.ts` (líneas 480, 510, 524, 553, 571, 639, 755) y `lib/mia/card-snapshot.ts:97`.
- **Impacto:** Errores TypeScript al acceder a `row.is_finalized`. En runtime el campo existe en la DB pero TypeScript no puede verificar su tipo.

#### 3. Tipo `Profile` Falta Campos `username` y `phone`
- **Archivo:** `lib/types/database.ts:15-31`
- **Problema:** La interfaz `Profile` no tiene `username` ni `phone`, pero:
  - `app/profile/page.tsx:61`: `(profile as unknown as Record<string, unknown>).username`
  - `app/profile/page.tsx:62`: `(profile as unknown as Record<string, unknown>).phone`
  - `hooks/use-data.ts:2040`: `updateProfile` acepta `username?: string | null; phone?: string | null`
- **Impacto:** Casts de tipo inseguros en toda la página de perfil.

---

### 🟠 ALTOS (4)

#### 4. Hook `useToast` Duplicado con Bug de Performance
- **Archivo 1:** `components/ui/use-toast.ts:182` — `useEffect(..., [state])`
- **Archivo 2:** `hooks/use-toast.ts:178` — `useEffect(..., [])`
- **Problema:** Dos copias casi idénticas. La versión de `components/ui` tiene `[state]` como dependencia, causando que el listener se agregue y elimine en **cada cambio de estado** — bug de performance.
- **Impacto:** Componentes que importan desde `@/components/ui/use-toast` (vía barrel) obtienen la versión bugueada.

#### 5. Hook `useIsMobile` Duplicado
- **Archivo 1:** `components/ui/use-mobile.tsx`
- **Archivo 2:** `hooks/use-mobile.ts`
- **Problema:** Dos copias idénticas. Diferentes partes del código importan de ubicaciones distintas.
- **Impacto:** Riesgo de divergencia futura.

#### 6. Barrel File `components/credit-cards/index.ts` Vacío
- **Archivo:** `components/credit-cards/index.ts`
- **Contenido:** Solo `// Re-export from accounts or planning modules` — sin exports.
- **Impacto:** Bajo riesgo (los imports usan rutas directas), pero indica organización incompleta.

#### 7. Import Condicional de `@vercel/analytics`
- **Archivo:** `app/layout.tsx:4`
- **Problema:** Import incondicional pero uso condicional (`process.env.NODE_ENV === 'production'`). Si el paquete tiene mismatch de versión, el build falla sin importar el NODE_ENV.

---

### 🟡 MEDIOS (4)

#### 8. `useEffect` con Dependencia Faltante en Profile
- **Archivo:** `app/profile/page.tsx:96-99`
- **Problema:** El effect sincroniza el form con el profile. Si el usuario está editando y el profile cambia externamente, el dispatch sobreescribe sus cambios no guardados.

#### 9. Server Component + CSS Side Effect
- **Archivo:** `app/inicio/page.tsx`
- **Problema:** Server Component que renderiza `<PublicLanding />` (Client Component) que importa CSS como side effect. El CSS solo se carga cuando el client component hidrata, causando posible flash de contenido sin estilo.

#### 10. Módulo Monolítico `use-data.ts` (~4010 líneas)
- **Archivo:** `hooks/use-data.ts`
- **Problema:** Un solo archivo con ~30+ funciones/hooks exportados para todas las operaciones CRUD. Violación de responsabilidad única.

#### 11. Barrel `components/ui/index.ts` Re-exporta Hooks Bugueados
- **Archivo:** `components/ui/index.ts:65-66`
- **Problema:** Re-exporta `use-mobile` y `use-toast` desde `components/ui/`, incluyendo la versión bugueada del toast.

---

### 🟢 BAJOS (6)

#### 12. Sin Archivos `loading.tsx`
- No existe ningún `loading.tsx` en ninguna ruta. Next.js no muestra estados de carga streaming.

#### 13. `CreditCardCycle` Falta `created_at`
- `lib/types/database.ts` — El tipo no tiene `created_at` pero `lib/mia/card-snapshot.ts:97` lo selecciona.

#### 14. Email de Test Hardcodeado
- `lib/entitlements/test-user.ts:2` — Fallback `example@example.com` si no se setea `COACH_IA_TEST_ACCESS_EMAIL`.

#### 15. Ruta Muerta `/transactions` en Middleware
- `lib/supabase/middleware.ts:23` — `/transactions` en `protectedRoutes` pero `app/transactions/` no existe (solo `app/history/`).

#### 16. `calendar_events_cache` Fuera de `EntityType`
- `lib/offline/db.ts` — `CACHE_STORES` incluye `calendar_events_cache` sin entrada correspondiente en `EntityType`.

#### 17. 66 Wildcard Re-exports Frágiles
- `components/ui/index.ts` — `export *` para 66 módulos. Riesgo de colisiones de nombres.

---

## Resumen

| Severidad | Cantidad | Impacto |
|-----------|----------|---------|
| 🔴 Crítico | 3 | Auth no funciona, tipos rotos |
| 🟠 Alto | 4 | Performance, duplicación |
| 🟡 Medio | 4 | UX, arquitectura |
| 🟢 Bajo | 6 | Calidad de código |
| **Total** | **17** | |

---

## Mejoras de Filtros (History Screen) - 10 jul 2026

### 1. Reubicación del Buscador
El input de búsqueda ("Nombre, categoría o monto") fue **eliminado** del componente `TransactionFilterModal`. El historial (`history-screen.tsx`) mantiene su propio buscador en la vista principal.

### 2. Eliminación de Botones de Rango Rápido
Los botones (Hoy, 7d, Mes, 3m, Todo, Personalizado) fueron eliminados de `transaction-filter-modal.tsx`.

### 3. Rolling 1-Month Window
```typescript
function getDefaultMonthRange() {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return { startDate: from.toISOString().slice(0, 10), endDate: to.toISOString().slice(0, 10) }
}
```

### 4. Estilos Modernizados
Todos los inputs usan `rounded-2xl border border-border` consistentemente.
