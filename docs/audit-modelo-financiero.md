# Auditoría del Modelo Financiero — MiCuadre

## 1. Estructura de Cuentas (`accounts`)

```sql
-- 58 columnas totales. Las claves para el modelo financiero:
id              UUID PK
user_id         UUID FK → auth.users
name            TEXT
type            TEXT CHECK ('cash','debit','credit')
currency        TEXT CHECK ('DOP','USD') DEFAULT 'DOP'

-- Balance (no-crédito)
balance         DECIMAL(15,2) DEFAULT 0

-- Crédito (legacy single-currency)
credit_limit    DECIMAL(15,2)
current_debt    DECIMAL(15,2) DEFAULT 0
closing_date    INTEGER (1-31)
due_date        INTEGER (1-31)
minimum_payment DECIMAL(15,2)

-- Crédito multi-moneda (migraciones 010, 011)
credit_limit_dop        DECIMAL(15,2) DEFAULT 0
credit_limit_usd        DECIMAL(15,2) DEFAULT 0
current_debt_dop        DECIMAL(15,2) DEFAULT 0
current_debt_usd        DECIMAL(15,2) DEFAULT 0
statement_balance_dop   DECIMAL(15,2) DEFAULT 0
statement_balance_usd   DECIMAL(15,2) DEFAULT 0
paid_statement_amount_dop DECIMAL(15,2) DEFAULT 0
paid_statement_amount_usd DECIMAL(15,2) DEFAULT 0
pending_transit_dop     DECIMAL(15,2) DEFAULT 0
pending_transit_usd     DECIMAL(15,2) DEFAULT 0
closing_day             INTEGER (1-31)
due_days_after_cutoff   INTEGER DEFAULT 20
minimum_payment_percentage DECIMAL(8,6) DEFAULT 0.0278
last_statement_cutoff_date DATE
statement_due_date      DATE
late_fee_applied_cycle_dop DATE
late_fee_applied_cycle_usd DATE

-- Crédito ciclo (migración 011 - parcialmente aplicadas)
current_balance_dop     DECIMAL(15,2) DEFAULT 0
current_balance_usd     DECIMAL(15,2) DEFAULT 0
financed_balance_dop    DECIMAL(15,2) DEFAULT 0
financed_balance_usd    DECIMAL(15,2) DEFAULT 0
available_credit_dop    DECIMAL(15,2) DEFAULT 0
available_credit_usd    DECIMAL(15,2) DEFAULT 0
payment_due_day         INTEGER (1-31)
annual_interest_rate    DECIMAL DEFAULT 0.60

-- Branding/meta
color, icon, icon_url, icon_type, icon_value, primary_color, secondary_color,
background_style, bank_name, bank_logo_key, bank_logo_url,
account_number, sort_order, is_favorite, is_active, created_at, updated_at
```

**Problemas detectados:**
- Existen **tres sistemas paralelos** para deuda de crédito: `current_debt` (legacy), `current_debt_dop/usd` (multi-moneda), y `current_balance_dop/usd` (ciclo) — sin sincronización garantizada entre ellos.
- `balance` solo aplica a cuentas no-crédito; las `current_debt_*` se usan para crédito. No hay un campo único `net_balance` que funcione para todos los tipos.
- No existe `account_type` en sentido ledger (activo/pasivo/patrimonio). Solo `type` con semántica de UI (`cash/debit/credit`).

---

## 2. Transacciones y Movimientos

### `transactions` — El registro central (340 filas)
```sql
id                  UUID PK
user_id             UUID FK
account_id          UUID FK → accounts
category_id         UUID FK → categories
type                TEXT CHECK ('income','expense')
amount              DECIMAL(15,2) > 0  ← SIEMPRE positivo
currency            TEXT CHECK ('DOP','USD')
amount_base         DECIMAL(15,2)      -- convertido a moneda base (no se usa consistentemente)
exchange_rate       DECIMAL(10,4) DEFAULT 1
description         TEXT
date                DATE
notes               TEXT
is_recurring        BOOLEAN DEFAULT false
parent_transaction_id UUID FK → transactions  ← vincula pares source+dest
metadata            JSONB              ← campo semántico clave (kind, transfer_id, etc.)
billing_cycle_id    UUID               ← ciclo de tarjeta (parcial)
is_statement_transaction BOOLEAN DEFAULT false
subscription_id     UUID FK → subscriptions
created_at          TIMESTAMPTZ
```

### `transfers` — Transferencias entre cuentas (34 filas)
```sql
id                  UUID PK
user_id             UUID FK
from_account_id     UUID FK → accounts
to_account_id       UUID FK → accounts (nullable)
to_beneficiary_id   UUID FK → beneficiaries (nullable)
amount              DECIMAL(15,2) > 0
currency            TEXT
description         TEXT
date                TIMESTAMPTZ
created_at          TIMESTAMPTZ
CHECK: (to_account_id IS NOT NULL XOR to_beneficiary_id IS NOT NULL)
```

### `credit_payments` — Pagos de tarjeta (19 filas)
```sql
id                  UUID PK
user_id             UUID FK
credit_account_id   UUID FK → accounts
source_account_id   UUID FK → accounts
amount              DECIMAL(15,2) > 0
currency            TEXT CHECK ('DOP','USD')
payment_kind        TEXT CHECK ('balance_to_date','statement_balance','minimum_payment','custom')
payment_date        TIMESTAMPTZ
notes               TEXT
created_at          TIMESTAMPTZ
```

### `goal_contributions` — Aportes a metas (5 filas)
```sql
id                  UUID PK
user_id             UUID FK
goal_id             UUID FK → goals
account_id          UUID FK → accounts  ← NO vinculado a transfers
amount              DECIMAL(15,2) > 0
date                TIMESTAMPTZ
notes               TEXT
created_at          TIMESTAMPTZ
```

### `credit_card_cycles` — Ciclos de tarjeta (11 filas)
```sql
id                  UUID PK
user_id             UUID FK
account_id          UUID FK → accounts
cycle_start_date    DATE
cycle_end_date      DATE
due_date            DATE
statement_balance_dop   DECIMAL(15,2) DEFAULT 0
statement_balance_usd   DECIMAL(15,2) DEFAULT 0
paid_amount_dop         DECIMAL(15,2) DEFAULT 0
paid_amount_usd         DECIMAL(15,2) DEFAULT 0
financed_amount_dop     DECIMAL(15,2) DEFAULT 0
financed_amount_usd     DECIMAL(15,2) DEFAULT 0
interest_amount_dop     DECIMAL(15,2) DEFAULT 0
interest_amount_usd     DECIMAL(15,2) DEFAULT 0
status              TEXT CHECK ('open','closed','paid','partial','overdue','financed')
created_at          TIMESTAMPTZ
```

---

## 3. Reglas de Negocio Actuales

Todas las reglas están **hardcodeadas en `hooks/use-data.ts`** o en el SQL de funciones RPC (`scripts/029_atomic_operations.sql`).

| # | Regla | Código | Dónde |
|---|---|---|---|
| 1 | **Comisión = 0.15%** del monto | `COMMISSION_RATE = 0.0015` | `use-data.ts:65`, SQL RPC |
| 2 | **Pago mínimo = 2.78%** | `DEFAULT_MINIMUM_PAYMENT_PERCENTAGE = 0.0278` | `use-data.ts:66` |
| 3 | **Moratorios = 12%** | `LATE_FEE_RATE = 0.12` | `use-data.ts:67` |
| 4 | **Interés anual = 60%** | `annual_interest_rate DEFAULT 0.60` | Schema accounts |
| 5 | **Cuota de cierre/tarjeta = 20 días** | `due_days_after_cutoff DEFAULT 20` | Schema accounts |
| 6 | **Balance no-crédito: income suma, expense resta** | `balance +/- amount` | `applyAccountImpact()`, RPC |
| 7 | **Balance crédito: expense incrementa debt** | `current_debt +/- amount` (con `greatest(0, ...)`) | `applyAccountImpact()`, RPC |
| 8 | **Sin sobregiro** en no-crédito | `if (nextBalance < 0) throw` | `applyAccountImpact():720` |
| 9 | **Sin pago mayor a deuda actual** | `if (amount > currentDebt) throw` | `payCreditCard():2357` |
| 10 | **Meta: current_amount = suma goal_contributions** | `current_amount + contribution.amount` | `addGoalContribution():2153` |
| 11 | **Transferencia atómica: 4+ escrituras** (validar→insert transfer→insert tx source→debit→insert tx dest→credit→commission) | RPC `create_transfer_safe` | `029_atomic_operations.sql` |
| 12 | **Reconciliación manual**: suma todas las transactions de una cuenta | `sum(case income then amount else -amount)` | `030_reconcile_balance.sql` |

### Cómo se actualizan los balances (flujo actual)

**Transacción normal** (`createTransaction` → `applyAccountImpact`):
```
Cliente → validate funds → insert transaction → applyAccountImpact(debit/credit account) → mutate SWR
```
- **NO atómico**: son 2-3 llamadas HTTP independientes. Si falla entre insert y applyAccountImpact, queda inconsistente.

**Pago de tarjeta** (`payCreditCard`, ~500 líneas):
```
SWR optimistic update → update credit account → update cycles → update source account
→ insert credit_payments record → insert source tx → insert card tx → insert commission tx
→ syncCreditAccountCycle → notify
```
- **Rollback manual**: si algo falla, revierte en orden inverso con delete/update por separado.
- **Problema**: la actualización SWR optimista ocurre ANTES de confirmar en DB; si hay error, solo se revalida.

**Aporte a meta** (`addGoalContribution`):
```
validate funds → insert goal_contribution → update goal → insert transaction → applyAccountImpact
```
- **Rollback manual**: si falla el paso E, revierte A→B→C→D en orden inverso con delete/update.
- **Riesgo**: si el navegador se cierra entre C y D, la meta queda actualizada pero sin transaction ni debit. Dinero fantasma.

---

## 4. Eventos Actuales vs. Propuestos

No existe un sistema de eventos formal. Los "eventos" actuales son implícitos en:
- **`transactions.metadata.kind`**: campo JSONB que etiqueta la semántica de cada transacción
- **`notifications.type`**: `transaction`, `goal`, `credit`, `system`, `transfer`, `subscription`
- **`credit_card_cycles.status`**: `open`, `closed`, `paid`, `partial`, `overdue`, `financed`

### Eventos Actuales (implícitos en metadata.kind)

| Evento | Almacenado en | Equivalente Propuesto |
|---|---|---|
| `kind: "transfer"` | transactions.metadata | TransferExecuted ✅ |
| `kind: "credit_payment"` | transactions.metadata | — |
| `kind: "commission"` | transactions.metadata | CommissionCharged ✅ |
| `kind: "goal_contribution"` | transactions.metadata | — |
| `operation_type: "credit_card_payment"` | transactions.metadata (dual) | — |
| `kind: "subscription_payment"` | transactions.metadata | — |
| — (no existe) | — | AccountCreated ❌ |
| — (no existe) | — | LoanPaymentReceived ❌ |
| — (no existe) | — | StatementGenerated ❌ |
| — (no existe) | — | InterestAccrued ❌ |

### Problemas con el modelo actual de eventos:
1. **No hay cola ni bus de eventos** — todo es síncrono en el cliente.
2. **Los eventos no son replayables** — no se puede reconstruir el estado desde un log.
3. **`metadata.kind` duplica semántica** con `operation_type` (a veces ambos en el mismo registro).
4. **`credit_payments` no tiene event_id** — los pagos no son rastreables como eventos.
5. **No hay `AccountSnapshot`** — no se puede saber el balance en un punto en el tiempo sin sumar todas las transactions.

---

## 5. Gaps Priorizados

### 🔴 Alta — Causa raíz de bugs críticos

| Gap | Descripción | Bug asociado |
|---|---|---|
| **GAP-1** No hay doble-entry ledger | Cada transacción registra un solo movimiento (income/expense). Un pago de tarjeta requiere 3+ inserts separados sin enlace ledger. Doble conteo cuando falla alguno. | Doble conteo en pagos de tarjeta |
| **GAP-2** Goal_contributions sin vinculación ledger | Aporta a meta solo vincula `account_id` directo, no pasa por transfers. Si el cliente cierra entre step C y D, la meta avanza sin debitar la cuenta. | Dinero fantasma en metas |
| **GAP-3** No hay reconciliación nativa | `reconcile_account_balance` existe pero NO se llama automáticamente. Es manual via RPC. Además solo suma transactions — ignora transfers y credit_payments. | Falta de reconciliación |
| **GAP-4** Pagos de tarjeta no atómicos | `payCreditCard` hace ~8 llamadas HTTP secuenciales sin transacción DB. Si cualquiera falla, el rollback manual puede fallar también. | Doble conteo, inconsistencias |
| **GAP-5** Múltiples campos de balance sin sincronización | `current_debt`, `current_debt_dop`, `current_debt_usd`, `current_balance_dop`, `statement_balance` — todos deben mantener coherencia manual. | Inconsistencia de balances |

### 🟡 Media — Riesgo de bugs futuros

| Gap | Descripción |
|---|---|
| **GAP-6** Sin soporte para préstamos como cuentas | `debt` es tabla separada, no un tipo de account. No amortización. |
| **GAP-7** Tasas hardcodeadas | Commission (0.15%), minimum payment (2.78%), interest (60%) son constantes en código, no configurables por plan/país. |
| **GAP-8** No hay immutable event log | No se puede auditar "quién hizo qué y cuándo" porque los registros se modifican (update account balance). |
| **GAP-9** `amount` siempre positivo con `type` discriminator | Obliga a lógica dispersa: `type='expense' → -amount`. Una columna `signed_amount` simplificaría todo. |
| **GAP-10** Currency conversion inconsistente | `amount_base` y `exchange_rate` existen pero no se validan ni usan consistentemente. En transfers se calcula en cliente. |

### 🟢 Baja — Mejora sin impacto en bugs

| Gap | Descripción |
|---|---|
| **GAP-11** No hay `net_balance` unificado | Hay que leer `balance` o `current_debt_*` según `type`. Impide queries tipo "patrimonio total". |
| **GAP-12** Sin tipo de cuenta financiera | `type` mezcla semántica de UI (icono) con financiera. Imposible distinguir "ahorro" de "efectivo". |
| **GAP-13** Metadata sin schema | `transactions.metadata` es JSONB libre. Cada operación escribe con keys distintas (`payment_group_id` vs `payment_id` vs `credit_account_id`). |

---

## 6. Resumen para Migración

Para migrar al modelo de ledger propuesto desde esta base:

1. **Convertir `transactions` en entradas de ledger** con doble columna (debit_account_id, credit_account_id) en vez de `type`/`amount`/`account_id`.
2. **Crear `ledger_entries` como tabla inmutable** — nunca se UPDATE ni DELETE. Las operaciones actuales de actualización de account serían derivadas (materializadas) desde el ledger.
3. **Migrar `credit_payments` a transferencias ledger** con 3 patas: (source→credit_card_debt, credit_card_debt→credit_card_available, commission→source).
4. **Migrar `goal_contributions` a transfers ledger** (account→goal: account debit, goal credit).
5. **Reemplazar rollback manual por transacciones DB** (las RPCs de `029_atomic_operations.sql` son el patrón correcto — extenderlo a credit_payments).
6. **Eliminar columnas de balance redundantes** después de probar que el ledger deriva correctamente los balances.
7. **Hacer `COMMISSION_RATE` configurable** por plan o por perfil de riesgo país.
