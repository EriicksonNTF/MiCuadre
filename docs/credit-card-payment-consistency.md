# Consistencia de pagos de tarjeta

## Modelo actual implementado

- Un pago de tarjeta crea dos movimientos en `transactions`:
  - Origen: `type = expense` en cuenta fuente.
  - Tarjeta: `type = income` en cuenta de tarjeta.
- Ambos lados quedan enlazados por metadata:
  - `operation_type: "credit_card_payment"`
  - `payment_group_id`
  - `payment_id` (compatibilidad con flujo anterior)
  - `side: "source_account" | "credit_card"`

## Crear pago

- `payCreditCard` valida usuario autenticado, cuenta origen, tarjeta, monto y fondos.
- Actualiza saldo cuenta origen y deuda de tarjeta.
- Inserta ambos movimientos enlazados.

## Eliminar pago

- `deleteTransaction` detecta si es pago de tarjeta.
- Busca movimientos hermanos por `payment_group_id`; fallback a `payment_id`.
- Revierte impacto de ambos lados y elimina ambos movimientos.
- Elimina notificaciones asociadas al pago y crea aviso claro de eliminación.

## Editar pago

- `updateTransaction` detecta pagos de tarjeta.
- Estrategia segura: revertir primero el grupo anterior y recrear el pago con los nuevos valores.
- Soporta cambio de cuenta origen y monto.

## Validaciones de monto

- Monto > 0.
- Monto <= deuda actual de tarjeta en la moneda seleccionada.
- Cuenta origen con fondos suficientes (incluyendo conversiones cuando aplique).

## Pendiente DGII 0.15%

- UI ya muestra bloque de `Monto`, `Impuesto DGII 0.15%` y `Total a debitar`.
- En esta fase el impuesto queda en `0` para no romper lógica existente.
- Fase siguiente: aplicar impuesto obligatorio en débito de cuenta origen y registrar metadato/transaction separada.
