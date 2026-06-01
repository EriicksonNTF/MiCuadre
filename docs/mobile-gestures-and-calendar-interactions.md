# Gestos móviles e interacciones de calendario

## Swipe de confirmación unificado

- Componente compartido: `components/ui/swipe-confirm-button.tsx`.
- `components/payment-slider/payment-slider.tsx` ahora reutiliza el componente compartido para mantener el mismo comportamiento en Enviar, pagar tarjeta y pagar cuota.
- Incluye:
  - Umbral de confirmación al 80%.
  - Estado `loading` y prevención de doble envío.
  - Reset automático en error y por `resetKey`.
  - Movimiento con `translate3d` y actualización con `requestAnimationFrame`.

## Flujos migrados

- Enviar dinero (`PaymentSlider` -> componente compartido internamente).
- Pagar tarjeta (confirmación con `SwipeConfirmButton`).
- Pagar cuota/deuda (usa `PaymentSlider`, ahora estandarizado).

## Swipe-back estilo iOS

- Implementado en `components/providers/body-cleanup.tsx` con gesto desde borde izquierdo.
- Zona de activación: 24px.
- Umbral: `min(96px, 25% del ancho)`.
- Fallback: si no hay historial, redirige a `/dashboard`.

### Exclusiones / guards

No activa gesture-back cuando el toque inicia en:
- inputs, selects, botones o contenido editable.
- modales/sheets (`data-app-modal`).
- componentes de swipe confirm (`data-swipe-confirm`).
- zonas explícitas con `data-no-edge-back="true"`.

## Dashboard: preview de calendario

- Nueva tarjeta: `components/dashboard/calendar-preview-card.tsx`.
- Ubicación: `app/dashboard/page.tsx`, antes de movimientos recientes.
- Solo visible para Pro (usuarios Free no ven datos reales de Planning en dashboard).
- Muestra hasta 3 próximos eventos y acceso a `/planning?tab=calendar`.

## Planning Calendar: interacción por fecha

- `components/planning/financial-calendar-tab.tsx` ahora abre una sheet al seleccionar fecha.
- Título: `Pagos del [fecha]`.
- Lista eventos del día con acciones reales:
  - Tarjeta -> `/pay?card=...`
  - Suscripción -> `/settings/subscriptions`
  - Deuda -> `/planning?tab=debts` (o deuda específica)
- Si no hay eventos: `No hay compromisos para este día.`

## Limitaciones conocidas

- El gesto back usa navegación por historial del navegador (comportamiento esperado en PWA/webview).
- La animación visual de arrastre de página no se aplica aún; prioridad fue seguridad/compatibilidad con sliders, formularios y sheets.

## QA checklist

- Probar swipe lento/rápido/parcial en Enviar, pagar tarjeta y pagar cuota.
- Verificar bloqueo de doble submit y reset en error.
- Verificar swipe-back en pantallas internas y fallback a `/dashboard`.
- Confirmar que swipe-back no dispara dentro de sheets, inputs y swipe confirm.
- Confirmar tarjeta de calendario en dashboard para Pro y ocultación de datos para Free.
- En Planning Calendar, tocar fecha con/sin eventos y validar acciones.
