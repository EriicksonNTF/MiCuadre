# MiCuadre Production Launch Checklist

## A. Environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `STRIPE_SECRET_KEY` (server only)
- `STRIPE_WEBHOOK_SECRET` (server only)
- `STRIPE_PRO_MONTHLY_PRICE_ID`
- `STRIPE_PRO_YEARLY_PRICE_ID`

## B. Supabase migration checklist

- [ ] `scripts/018_profiles_plan_fields.sql` aplicado
- [ ] `scripts/019_billing_blueprint.sql` aplicado
- [ ] Indices y trigger `updated_at` de `billing_subscriptions` confirmados

## C. Supabase RLS checklist

- [ ] RLS habilitado en `billing_customers`
- [ ] RLS habilitado en `billing_subscriptions`
- [ ] RLS habilitado en `billing_events`
- [ ] RLS habilitado en `billing_plan_snapshots`
- [ ] Solo `SELECT own` para clientes en tablas billing
- [ ] Sin politicas client-side de escritura billing

## D. Stripe product/price checklist

- [ ] Producto Pro mensual/anual activo y prices configurados
- [ ] Moneda e intervalos revisados

## E. Stripe webhook checklist

- [ ] Endpoint configurado: `/api/webhooks/stripe`
- [ ] Firma valida con `STRIPE_WEBHOOK_SECRET`
- [ ] Eventos activos:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
- [ ] Idempotencia validada (`billing_events.stripe_event_id` unique)

## F. Stripe Billing Portal checklist

- [ ] Billing Portal habilitado en Stripe
- [ ] Return URL valida (`/settings/plan`)
- [ ] Flujo de cancelacion/renovacion probado

## G. Vercel deployment checklist

- [ ] Variables de entorno cargadas por ambiente
- [ ] Dominio de produccion configurado
- [ ] Deploy preview y produccion con `pnpm run build:safe` exitoso
- [ ] Logs server-side revisados sin secretos

## H. Mobile/PWA checklist

- [ ] `public/manifest.json` vigente
- [ ] Landing y `/settings/plan` sin overflow critico
- [ ] Botones principales con area tactil comoda
- [ ] Modo oscuro estable

## I. Private testing notes

- [ ] QA interno con cuentas reales de staging
- [ ] Confirmar que checkout success no asume upgrade inmediato
- [ ] Confirmar reconciliacion via `/api/billing/status`

## J. Payment test checklist

- [ ] Exito (`4242 4242 4242 4242`)
- [ ] Requiere autenticacion (`4000 0025 0000 3155`)
- [ ] Rechazo (`4000 0000 0000 9995`)
- [ ] Cancelacion desde checkout

## K. Rollback checklist

- [ ] Mantener ultimas variables estables
- [ ] Revertir deploy si webhook falla masivamente
- [ ] Forzar plan `free` temporalmente solo via server admin scripts
- [ ] Auditar `billing_events` fallidos antes de reintentar

## L. Known limitations before launch

- Checkout success depende de webhook async (no instantaneo)
- Pro depende de `STRIPE_PRO_MONTHLY_PRICE_ID` y `STRIPE_PRO_YEARLY_PRICE_ID`; `STRIPE_PRO_PRICE_ID` solo es fallback legacy mensual.
- Sin panel admin interno para reintentos masivos de billing events
