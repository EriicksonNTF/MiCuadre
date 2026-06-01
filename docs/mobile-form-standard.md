# Estandar de formularios moviles

## Patron recomendado

- Header fijo.
- Cuerpo con `overflow-y-auto` y `min-h-0`.
- Footer sticky/fijo fuera del scroll.
- Padding inferior con `env(safe-area-inset-bottom)`.

## Base reusable

- `components/ui/mobile-fullscreen-form.tsx`.
- `components/ui/mobile-sheet-layout.tsx` para bottom sheets.

## Reglas

- Boton principal nunca dentro del contenido scrolleable.
- Evitar superposicion con teclado y bottom nav.
- Mantener altura visible del CTA en iOS.

## Estado actual

- Flujo de pago de tarjeta ya usa el patron (footer fijo + sheets).
- Formularios restantes deben migrar gradualmente al mismo patron para consistencia completa.
