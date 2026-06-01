# Auditoría de integridad de pagos de tarjeta

Script: `scripts/audit-card-payment-integrity.mjs`

## Objetivo

Detectar inconsistencias en pagos de tarjeta ya existentes sin modificar datos en automático.

## Modos

- `dry-run` (default): solo diagnóstico.
- `apply`: actualmente no ejecuta cambios destructivos; imprime estrategia para reparación manual aprobada.

## Uso

- Todos los usuarios:
  - `pnpm audit:card-payments -- --dry-run`
- Un usuario:
  - `pnpm audit:card-payments -- --user USER_ID --dry-run`
- Una tarjeta:
  - `pnpm audit:card-payments -- --card CARD_ID --dry-run`

## Requisitos

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Issues detectados

- `missing_card_credit`
- `missing_source_debit`
- `amount_mismatch`
- `currency_mismatch`
- `duplicate_pair`
- `orphan_notification`

Cada fila incluye:

- `user_id` (enmascarado)
- `card_id` (enmascarado)
- `payment_group_id`
- ids de transacciones relacionadas
- `recommended_fix`
- `risk_level`
