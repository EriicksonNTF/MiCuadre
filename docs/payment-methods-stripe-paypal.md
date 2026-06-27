# Stripe Checkout + PayPal (MiCuadre)

## Resumen
MiCuadre usa un solo flujo de cobro con Stripe Checkout para Pro mensual y Pro anual.
La app no procesa tarjetas ni activa planes desde frontend: el webhook de Stripe es la fuente de verdad.

## Como funciona el pago
1. Usuario toca "Actualizar a Pro".
2. Frontend llama `POST /api/billing/checkout` con `{ plan: "pro", interval: "monthly" | "yearly" }`.
3. Backend valida autenticacion, plan e intervalo.
4. Backend resuelve `price_id` desde variables de entorno.
5. Stripe Checkout procesa el pago (tarjeta y PayPal segun disponibilidad).
6. Stripe envia webhook firmado.
7. MiCuadre sincroniza `billing_subscriptions` y `profiles.plan_tier` en Supabase.

## Configuracion Stripe requerida
Producto:
- `MiCuadre Pro`

Precios:
- `Pro mensual`: 2.99 USD / month
- `Pro anual`: 28.70 USD / year

Variables de entorno:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRO_MONTHLY_PRICE_ID`
- `STRIPE_PRO_YEARLY_PRICE_ID`
- `STRIPE_CHECKOUT_ENABLE_PAYPAL` (`true` para intentar `card + paypal`)
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Compatibilidad legacy:
- `STRIPE_PRO_PRICE_ID` puede actuar como fallback de Pro mensual.

## Price ID vs Payment Link vs Checkout Session
- `Price ID` (`price_...`): identificador de precio en Stripe usado por API (`line_items.price`) para crear Checkout Sessions dinamicas.
- `Payment Link` (`https://buy.stripe.com/...`): URL hospedada por Stripe. No reemplaza `price_id` en este backend.
- `Checkout Session`: sesion creada por `POST /api/billing/checkout` con plan/intervalo validados server-side.

Importante:
- `STRIPE_PRO_MONTHLY_PRICE_ID` y `STRIPE_PRO_YEARLY_PRICE_ID` deben empezar con `price_`.
- Si se coloca un Payment Link en esas variables, MiCuadre bloquea el checkout con error seguro.

## PayPal dentro de Stripe
- MiCuadre no implementa PayPal separado por defecto.
- Si `STRIPE_CHECKOUT_ENABLE_PAYPAL=true`, Checkout intenta `payment_method_types: ["card", "paypal"]`.
- Si Stripe rechaza PayPal para esa cuenta/configuracion, el backend hace fallback automatico a `card` para no romper checkout.

## Eventos webhook usados
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

## Reglas de seguridad
- No exponer `STRIPE_SECRET_KEY` en frontend.
- No exponer `SUPABASE_SERVICE_ROLE_KEY` en frontend.
- No aceptar `price_id`, monto o moneda desde frontend.
- No activar Pro por `success_url`.
- Verificar firma con `STRIPE_WEBHOOK_SECRET`.
- Mantener idempotencia por `billing_events.stripe_event_id`.
- Guardar `user_id`, `plan`, `interval` en metadata de Checkout y suscripcion.
- Si una secret key fue expuesta accidentalmente, rotarla inmediatamente en Stripe Dashboard (API keys / Webhook signing secret).

## Checklist de pruebas (test mode)
1. Pro mensual abre Stripe Checkout.
2. Pro anual abre Stripe Checkout.
3. Cancelar checkout regresa sin activar Pro.
4. Tarjeta de prueba `4242 4242 4242 4242` completa pago.
5. Webhook marca evento `processed`.
6. `profiles.plan_tier` pasa a `pro` cuando corresponde.
7. Billing Portal abre para usuario con customer.
8. PayPal aparece en Checkout solo si Stripe lo habilita.

## Si PayPal no aparece
1. Verificar en Stripe Dashboard que PayPal este habilitado en Payment methods.
2. Confirmar habilitacion para suscripciones recurrentes y USD.
3. Revisar restricciones de cuenta/pais.
4. Mantener flujo por tarjeta en Stripe Checkout.
5. Evaluar PayPal separado solo como fase futura si negocio lo requiere.

## Recomendacion anti-fraude
- Mantener autenticacion obligatoria antes de checkout.
- Limitar entradas a whitelist (`plan=pro`, `interval=monthly|yearly`).
- Registrar eventos y errores sin secretos.
- Agregar rate limiting en API de checkout si se detecta abuso.
