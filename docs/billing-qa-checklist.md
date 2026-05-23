# MiCuadre Billing QA Checklist (Phase 12)

Esta guia valida el flujo SaaS de `billing_subscriptions` (NO `financial_subscriptions`).

## A) Variables de entorno requeridas

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (solo server)
- `STRIPE_SECRET_KEY` (solo server)
- `STRIPE_WEBHOOK_SECRET` (solo server)
- `STRIPE_PRO_MONTHLY_PRICE_ID`
- `STRIPE_PRO_YEARLY_PRICE_ID`
- `STRIPE_PLUS_MONTHLY_PRICE_ID`
- `STRIPE_PLUS_YEARLY_PRICE_ID`

## B) Migraciones de Supabase requeridas

- Aplicar `scripts/018_profiles_plan_fields.sql`
- Aplicar `scripts/019_billing_blueprint.sql`

Verificar tablas:

- `billing_customers`
- `billing_subscriptions`
- `billing_events`
- `billing_plan_snapshots`

## C) Configuracion Stripe Dashboard requerida

- Producto/price Pro mensual y anual activos.
- Producto/price Plus mensual y anual activos.
- Billing Portal habilitado.
- Webhook endpoint con eventos:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`

## D) Stripe CLI local testing

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Para disparar eventos de prueba:

```bash
stripe trigger checkout.session.completed
stripe trigger customer.subscription.created
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
stripe trigger invoice.payment_succeeded
stripe trigger invoice.payment_failed
```

## E) Tarjetas de prueba Stripe

- Pago exitoso: `4242 4242 4242 4242`
- Requiere autenticacion: `4000 0025 0000 3155`
- Pago rechazado: `4000 0000 0000 9995`

Fecha futura, CVC cualquiera, ZIP cualquiera.

## F) Casos Checkout

1. Free -> Pro (exitoso)
   - Se crea session
   - Redirige a Stripe
   - Vuelve con `?checkout=success`
   - UI muestra estado de reconciliacion
   - Webhook actualiza `billing_subscriptions`
   - `profiles.plan_tier` termina en `pro`

2. Checkout cancelado
   - Vuelve con `?checkout=cancelled`
   - Mensaje amigable sin error tecnico
   - Plan no cambia

3. Plus sin price ID configurado
   - Botón Plus no rompe
   - Usuario ve error amigable sin nombres de variables.
   - Mensaje de contacto amigable

## G) Casos Billing Portal

1. Usuario con `billing_customers`
   - Abre portal correctamente
   - Retorna a `/settings/plan`
   - Puede refrescar estado manualmente

2. Usuario sin `billing_customers`
   - Respuesta segura
   - Mensaje amigable (sin error tecnico bruto)

## H) Casos Webhook e idempotencia

1. Evento nuevo
   - Inserta `billing_events` en `processing`
   - Procesa sync
   - Marca `processed` + `processed_at`

2. Evento repetido
   - Detecta `stripe_event_id`
   - Retorna 200 sin reprocesar

3. Error interno
   - Marca `billing_events.status = failed`
   - Retorna error seguro

## I) Casos de entitlements

- `active`, `trialing` => desbloquea premium
- `past_due`, `unpaid`, `incomplete` => premium solo si `current_period_end` aun vigente
- `canceled` => no mantiene premium mas alla del periodo
- No debe quedar premium perpetuo por estado moroso viejo

## J) Checklist de salida a produccion

- [ ] Variables de entorno cargadas en hosting
- [ ] Stripe Portal configurado
- [ ] Webhook endpoint activo y firmado
- [ ] Migraciones aplicadas en Supabase
- [ ] Logs verificados (sin secretos)
- [ ] QA de checkout/portal completado en entorno real
- [ ] `pnpm run build:safe` pasa

---

## Notas de seguridad para developers

- El webhook es la fuente de verdad de billing.
- `checkout=success` NO significa plan activo instantaneo.
- `/api/billing/status` es la capa de reconciliacion para UI.
- Entitlements dependen de estado sincronizado en Supabase, no de suposiciones frontend.
- Nunca exponer `STRIPE_SECRET_KEY` ni `SUPABASE_SERVICE_ROLE_KEY` al cliente.
