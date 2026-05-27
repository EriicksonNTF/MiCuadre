# Planning Phase 2: Calendario financiero

## Fuentes de eventos
Se normalizan eventos desde datos existentes sin crear tabla nueva:
- Tarjetas de credito (`accounts` tipo `credit` + `statement_due_date` + `pending_amount`)
- Suscripciones financieras (`subscriptions.next_payment_date`, `amount`)
- Deudas (cuando hay saldo financiado en tarjeta: `financed_balance_dop/usd`)

## Normalizacion
Implementado en `lib/planning/calendar.ts` con `getFinancialCalendarEvents(userId, options)`.

Salida por evento:
- id
- user_id
- type
- title
- amount
- currency
- due_date
- source_id
- source_table
- status (`upcoming | due_today | overdue | paid`)
- action_label
- detail

## UI
- `components/planning/financial-calendar-tab.tsx`
- `components/planning/calendar-event-card.tsx`
- `components/planning/calendar-filter-pills.tsx`

Comportamiento:
- Resumen calendario con compromisos próximos 7 días
- Total comprometido del mes
- Filtros: Todos, Tarjetas, Suscripciones, Deudas
- Tarjetas: CTA `Pagar tarjeta`
- Suscripciones: CTA `Registrar pago`
- Deudas: CTA `Pagar cuota`

## Integración de acciones
Se reutilizan flujos existentes:
- Tarjeta -> `/pay`
- Suscripción -> `/expense`
- Deudas -> `/planning` (placeholder hasta fase de deudas)

No se duplica lógica de pagos.

## Dashboard
Tarjeta de planificación actualizada con:
- Presupuesto usado
- Próximos pagos (total 7 días)
- Próximo evento

## Limitaciones actuales
- No existe tabla dedicada de deudas aún; los eventos de deuda se derivan de saldos financiados en tarjetas.
- Recordatorios manuales no persistidos en esta fase.
- No se envían push notifications automáticas nuevas desde calendario en esta fase.

## Preparación de notificaciones
La clasificación de urgencia quedó lista por estado:
- `due_today` -> Pagar hoy
- `upcoming` cercano (<=3 días) -> Vence pronto
- `overdue` -> Atrasado

Fase siguiente recomendada:
- Orquestar esas urgencias con el sistema actual de notificaciones in-app/push.
