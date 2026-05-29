# Ingresos en tarjetas de crédito

Fecha: 2026-05-28

## Cambio funcional

Antes, el formulario de movimientos ocultaba tarjetas de crédito cuando el usuario seleccionaba `Ingreso`.

Ahora, las tarjetas de crédito aparecen en el selector de cuenta para ingresos. Esto permite registrar:

- Abono a tarjeta
- Reembolso en tarjeta
- Ajuste positivo
- Cashback

## Comportamiento de balance

La lógica existente de `hooks/use-data.ts` ya trata un `income` en cuenta `credit` como reducción de deuda:

- Gasto en tarjeta: aumenta `current_debt_*`.
- Ingreso en tarjeta: reduce `current_debt_*`, sin bajar de cero.

No se hicieron cambios destructivos ni migraciones. La columna `transactions.metadata` ya existe como JSONB según `scripts/007_commission_sorting_and_transaction_links.sql`.

## Metadata nueva

Cuando el usuario registra un ingreso en tarjeta desde `components/expense/expense-form.tsx`, se guarda:

```ts
{
  kind: "credit_card_income",
  movement_kind: "card_payment" | "card_refund" | "card_adjustment" | "card_cashback",
  reporting_treatment: "exclude_from_income" | "income_adjustment",
  affects_credit_debt: true
}
```

Por defecto:

- `card_payment` no cuenta como ingreso real.
- `card_adjustment` no cuenta como ingreso real.
- `card_refund` queda como ajuste de ingreso.
- `card_cashback` queda como ajuste de ingreso.

## Reportes e historial

Se agregó `lib/transactions/reporting.ts` para centralizar el criterio:

- `isExcludedFromRealIncome`
- `isReportableIncome`
- `isReportableExpense`

Se usa en:

- Reportes
- Historial
- Detalle de cuenta
- Insights financieros
- Fin Score
- MIA
- Notificaciones inteligentes

Esto evita que un abono de tarjeta infle ingresos reales, manteniendo el movimiento visible en historial y en la tarjeta.

## Limitaciones

No se agregó una tabla nueva ni una columna `movement_kind`; se usa metadata JSONB para evitar migraciones innecesarias. Si más adelante se requiere analítica SQL pesada sobre tipos de movimiento de tarjeta, una columna nullable sería una mejora segura.
