# MiCuadre Billing Runbook

## 1) Verificar plan de usuario despues de pago

1. Confirmar que Stripe emitio `checkout.session.completed` y `customer.subscription.*`.
2. Confirmar en `billing_events` que el evento esta `processed`.
3. Confirmar en `billing_subscriptions` que existe la fila del usuario y status correcto.
4. Confirmar en `profiles` que `plan_tier` y `plan_status` fueron sincronizados.
5. En UI, usar `Verificar estado` en `/settings/plan`.

## 2) Si el usuario pago pero sigue Free

- Revisar webhook delivery en Stripe.
- Revisar `billing_events` para ese `stripe_event_id`.
- Si `failed`, inspeccionar error server logs y corregir causa.
- Confirmar `billing_customers.stripe_customer_id` asociado a `user_id` correcto.
- Ejecutar reconciliacion consultando `/api/billing/status` autenticado.

## 3) Si el webhook fallo

- Buscar eventos `status = failed` en `billing_events`.
- Validar configuracion de `STRIPE_WEBHOOK_SECRET`.
- Validar endpoint activo y reachable.
- Verificar que migraciones billing esten aplicadas.

## 4) Si el portal no abre

- Confirmar `billing_customers` para el usuario.
- Confirmar Billing Portal habilitado en Stripe.
- Confirmar `STRIPE_SECRET_KEY` valida en ambiente actual.

## 5) Si checkout falla

- Confirmar `STRIPE_PRO_MONTHLY_PRICE_ID` y `STRIPE_PRO_YEARLY_PRICE_ID`.
- Confirmar `STRIPE_SECRET_KEY` configurada.
- Confirmar usuario autenticado en app.
- Revisar logs `[billing-checkout]` en servidor.

## 6) Si Pro no está disponible

- Confirmar `STRIPE_PRO_MONTHLY_PRICE_ID` y `STRIPE_PRO_YEARLY_PRICE_ID`.
- Si estás en transición desde Business/Plus, los tiers legacy se normalizan internamente a Pro.
- Si no esta configurado, usar flujo de contacto/sales temporal.

## 7) Inspeccion manual en Supabase

- `billing_customers`: validar mapeo `user_id <-> stripe_customer_id`.
- `billing_subscriptions`: validar `plan_tier`, `status`, `current_period_end`, `cancel_at_period_end`.
- `billing_events`: validar idempotencia y estado de proceso.

## 8) Que NO hacer

- Nunca exponer `SUPABASE_SERVICE_ROLE_KEY` en frontend.
- Nunca exponer `STRIPE_SECRET_KEY` en frontend.
- Nunca editar IDs de Stripe aleatoriamente en produccion.
- Nunca confiar en estado de plan solo en frontend.

La fuente de verdad de plan es webhook + sincronizacion server-side.
