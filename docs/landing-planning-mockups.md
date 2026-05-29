# Mockups de Planificación en landing

Fecha: 2026-05-28

## Qué se agregó

La sección de planificación de `components/landing/public-landing.tsx` ahora muestra tres mockups de producto:

- Presupuestos inteligentes
- Calendario financiero
- Deudas y pagos

## Técnica usada

Se eligió la opción A: componentes React/Tailwind puros.

No se agregaron imágenes externas, screenshots, automatización pesada ni dependencias. Los mockups se renderizan como pantallas móviles dentro de marcos tipo teléfono y usan tokens del tema de la app:

- `bg-background`
- `text-foreground`
- `bg-card`
- `text-card-foreground`
- `text-muted-foreground`
- `border-border`
- `bg-muted`
- `bg-primary`
- `text-primary-foreground`
- `bg-accent`
- `bg-destructive`

## Contenido visual

Presupuestos inteligentes:

- Presupuesto usado
- Comida 77%
- Transporte 52%
- Entretenimiento excedido
- Barras de progreso

Calendario financiero:

- Mini calendario con días marcados
- Próximos pagos
- Visa Popular
- Netflix
- Préstamo personal

Deudas y pagos:

- Total pendiente
- Préstamo personal
- Tarjeta Visa
- Pago próximo
- Progreso pagado

## Resultado

La landing comunica mejor el valor de Planificación sin depender de capturas reales. El enfoque es más flexible porque los mockups pueden evolucionar con el UI real de MiCuadre.
