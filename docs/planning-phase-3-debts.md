# Planning Phase 3 - Deudas y pagos

## Resumen
Se implementó el módulo de Deudas dentro de Planificación con creación de deuda, pago de cuota, historial de pagos y efecto financiero en cuenta origen + deuda.

## Esquema
Migración: `scripts/024_planning_debts.sql`

Tablas nuevas:
- `debts`
- `debt_payments`

## RLS
Se habilitó RLS en ambas tablas.
Políticas:
- `debts_select_own`
- `debts_insert_own`
- `debts_update_own`
- `debts_delete_own`
- `debt_payments_select_own`
- `debt_payments_insert_own`

## Lógica de pago
Archivo: `hooks/use-planning.ts`

Flujo `payDebt`:
1. Valida usuario autenticado.
2. Carga deuda y cuenta origen.
3. Valida monto > 0, monto <= pendiente y balance suficiente.
4. Resta balance a cuenta origen.
5. Resta pendiente de deuda.
6. Inserta registro en `debt_payments`.
7. Inserta movimiento en `transactions` con `metadata.kind = debt_payment`.
8. Enlaza `debt_payments.transaction_id`.
9. Revalida caches de cuentas, deudas, calendario y transacciones.

## Consistencia financiera
- El pago de deuda reduce balance de cuenta origen.
- El pago de deuda reduce `debts.current_balance`.
- El historial queda en `debt_payments`.
- El movimiento queda en `transactions` como egreso.
- No se registra como ingreso.

## Atomicidad y limitación actual
La operación es multi-query desde cliente con rollback compensatorio en caso de fallo.
No es una transacción SQL atómica real.
Mejora futura recomendada: mover `payDebt` a RPC o endpoint server-side transaccional.

## UI implementada
Nuevos componentes:
- `components/planning/debts-tab.tsx`
- `components/planning/debt-card.tsx`
- `components/planning/debt-form-sheet.tsx`
- `components/planning/pay-debt-sheet.tsx`

Incluye:
- Resumen de deudas (pendiente, pagos del mes, próximo pago).
- Formulario de nueva deuda.
- Pago de cuota con `PaymentSlider`.
- Recibo post-pago con detalle de antes/después.

## Calendario
Archivo: `lib/planning/calendar.ts`

El calendario ahora incorpora eventos desde `debts`:
- tipo `debt_payment`
- monto (cuota fija o pendiente)
- fecha próxima por `payment_day`
- acción `Pagar cuota`

## Dashboard
Archivo: `components/dashboard/planning-summary-card.tsx`

Se agregó:
- Deuda pendiente total en el card de Planificación.

## Landing
Archivo: `components/landing/public-landing.tsx`

Se agregó feature:
- "Deudas y pagos"
- "Registra préstamos, cuotas y deudas personales con seguimiento de pagos."

## Entitlements
Se usa límite Free de deudas activas (`max_active_debts: 2`) en creación de deuda.
Si se alcanza el límite, se bloquea creación con mensaje de upgrade.

## MIA
Archivo: `lib/mia/context-builder.ts`

Se añadió sección de deudas activas en el contexto:
- total pendiente
- listado con cuota y día de pago

## Pendiente para fase futura
- Registrar pagos de deuda con transacción SQL atómica por RPC.
- Integrar alertas push automáticas por vencimiento de deuda (si se aprueba).
- Añadir edición/cierre manual de deudas desde UI.
