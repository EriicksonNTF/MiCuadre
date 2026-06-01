# Plan de personalizacion por banco (futuro)

## Objetivo

Permitir seleccionar banco al crear tarjeta para mejorar identificacion visual y organizacion.

## Propuesta

- Campo de banco desde alta de tarjeta:
  - `bank_name`
  - `bank_logo_key` o `bank_logo_url`
  - acento visual derivado de banco
- Presets por emisor (color/acento/icono) sin romper personalizacion manual.
- Metadata opcional de emisor para reportes y filtros.

## Implementacion sugerida

1. Exponer selector de banco en formulario de crear tarjeta.
2. Guardar metadatos sin cambiar comportamiento financiero.
3. Reutilizar branding en tarjeta/resumen/pay flow.
4. Agregar fallback neutral cuando no hay banco.

## Riesgos

- Evitar acoplar logica financiera a branding.
- Mantener compatibilidad con tarjetas existentes sin banco asignado.
