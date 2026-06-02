# Fase 1 — Auditoría y modelo compartido de pagos de tarjeta

## Hallazgos actuales

- El modelo ya maneja deuda separada por moneda con campos `current_debt_dop/current_debt_usd`, `statement_balance_dop/statement_balance_usd` y `available_credit_dop/available_credit_usd`.
- El pago de tarjeta crea dos lados (egreso cuenta origen + ingreso tarjeta) en `payCreditCard`.
- Se usa metadata enlazada con `payment_group_id` y compatibilidad legacy con `payment_id`.
- Edit/delete de pagos de tarjeta se enrutan por `updateTransaction`/`deleteTransaction` y revierten el grupo.
- Había historial legacy con `kind=credit_payment` sin grupo en algunos usuarios; ya existe script de auditoría para detectarlo.

## Entry points identificados

- `app/pay/page.tsx` (flujo principal)
- `components/planning/quick-pay-card-sheet.tsx` (rápido desde planificación)
- `components/planning/financial-calendar-tab.tsx` (acción desde calendario)
- `components/planning/debts-tab.tsx` (acción desde deudas)
- edición/eliminación desde historial/detalle de cuenta vía `updateTransaction` y `deleteTransaction`

## Funciones compartidas agregadas

En `hooks/use-data.ts`:

- `createCreditCardPayment()`
- `editCreditCardPayment()`
- `deleteCreditCardPayment()`
- `calculateCreditCardPaymentAmounts()`
- `validateCreditCardPayment()`
- `getCardDebtByCurrency()`
- `applyCreditCardPaymentRevalidation()`

Estas funciones encapsulan cálculo, validación, operaciones y refresco para reducir rutas con lógica divergente.

## DGII 0.15%

- El cálculo compartido ya contempla `dgiiTaxAmount` y `totalDebit`.
- En la siguiente fase se aplicará obligatorio en todos los entry points de pago de tarjeta para que principal y DGII queden separados en contabilidad/reportes.
