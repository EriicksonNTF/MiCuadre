# Rediseño flujo Pagar tarjeta

## Objetivo

Flujo mobile-first compacto, con identidad MiCuadre, inspirado en patrones bancarios (sin copiar marca externa).

## Cambios principales

- Nueva jerarquía visual en `app/pay/page.tsx`.
- Opciones de pago con cards tipo radio.
- Hoja inferior para `Otro monto`.
- Hoja de confirmación previa al envío con resumen claro.
- Acción principal fija (`Continuar`) con safe-area.

## Componentes nuevos

- `components/credit-cards/pay-card/payment-option-card.tsx`
- `components/credit-cards/pay-card/custom-amount-sheet.tsx`
- `components/credit-cards/pay-card/confirm-payment-sheet.tsx`
- `components/credit-cards/pay-card/card-summary-grid.tsx`
- `components/ui/mobile-sheet-layout.tsx`
- `components/ui/swipe-confirm-button.tsx`

## UX

- Validaciones en español.
- Monto personalizado bloquea valores mayores a deuda.
- Confirmación muestra advertencia de fondos insuficientes cuando aplica.
- Recibo posterior mantiene referencias de cuenta/tarjeta y balances.
