# Planning Integration Final Audit

## Alcance auditado
- Planificacion: Presupuestos, Calendario financiero, Deudas y pagos.
- Integraciones: dashboard, landing, onboarding, entitlements, notificaciones, navegacion.
- Compatibilidad legacy: Goals sin borrado destructivo de BD.

## Modulos implementados y conectados
1. Presupuestos inteligentes
- Lectura de presupuestos del usuario.
- Calculo de uso mensual por categoria desde `transactions`.
- Incluye movimientos offline pendientes cuando aplica.
- Estados: healthy, near_limit, warning, exceeded.
- Alta, edicion y desactivacion de presupuesto desde UI.

2. Calendario financiero
- Eventos de tarjetas de credito (vencimientos/pagos).
- Eventos de suscripciones financieras (next_payment_date).
- Eventos de deudas (cuota/proximo pago).
- Filtros: Todos, Tarjetas, Suscripciones, Deudas.

3. Deudas y pagos
- Alta de deuda.
- Pago de deuda con cuenta origen + slider de confirmacion.
- Actualiza balance de cuenta origen.
- Actualiza balance pendiente de deuda.
- Crea historial en `debt_payments`.
- Crea movimiento en `transactions` con metadata `debt_payment`.
- Muestra recibo post-pago.

## Fuentes de datos conectadas
- Budgets: `budgets`, `transactions`, outbox offline.
- Calendar: `accounts` (credit), `subscriptions`, `debts`.
- Debts: `debts`, `debt_payments`, `accounts`, `transactions`.

## Base de datos y RLS
- Migraciones relevantes:
  - `scripts/023_planning_budgets.sql`
  - `scripts/024_planning_debts.sql`
- Tablas Planning:
  - `budgets`
  - `debts`
  - `debt_payments`
- RLS: habilitado en scripts con politicas por `auth.uid() = user_id`.

## Entitlements (Free/Pro)
- Copy de planes actualizada para Planning:
  - Free: 3 cuentas, 3 presupuestos, 3 suscripciones financieras, 2 deudas activas.
  - Pro: ilimitado + calendario avanzado + reportes + MIA + exportaciones.
- Enforcement activo en creacion:
  - Presupuestos: limite por plan.
  - Deudas: limite por plan.

## Cambios de landing
- Seccion Planning orientada a valor rapido:
  - Presupuestos inteligentes
  - Calendario financiero
  - Deudas y pagos
- CTA en seccion: "Comenzar gratis" y "Ver Pro".

## Cambios de dashboard
- Card de Planificacion con:
  - Presupuesto usado
  - Proximos pagos
  - Deuda pendiente
  - Link a `/planning`

## Cambios de onboarding
- Flujo orientado a "Organiza tu mes":
  1. Crear cuenta
  2. Crear presupuesto
  3. Agregar compromiso opcional
- Mantiene opcion de omitir.

## MIA / Coach
- Prompts sugeridos actualizados a presupuesto/pagos/deudas.
- Persisten referencias legacy internas de goals en partes del motor para compatibilidad.

## Notificaciones
- Preparado en `lib/smart-notifications.ts` para alertas:
  - Presupuesto cerca del limite
  - Presupuesto excedido
  - Pago tarjeta en 3 dias
  - Suscripcion manana
  - Cuota de deuda esta semana
  - Deuda vencida

## Estado de limpieza Goals/Metas
- UI publica de Goals removida; `/goals` y `/goals/[id]` redirigen a `/planning`.
- Se mantienen referencias internas legacy en:
  - flujos QA
  - score/insights legacy
  - utilidades MIA legacy
  - tipos y hooks de goals
- Tabla `goals` NO eliminada (enfoque no destructivo).

## QA de botones (estado por inspeccion + build)
- Presupuestos:
  - Crear: OK
  - Guardar: OK
  - Editar: OK
  - Eliminar/desactivar: OK
- Deudas:
  - Agregar deuda: OK
  - Guardar deuda: OK
  - Pagar cuota: OK
  - Otro monto: OK
  - Desliza para pagar: OK
  - Ver deuda/Listo (recibo): OK
- Calendario:
  - Filtros: OK
  - Acciones: navegan a flujos existentes (`/pay`, `/planning`, `/expense`).

## Navegacion
- Back en Planning actualizado con fallback a `/dashboard`.
- Si hay historial previo, usa `router.back()`; sin historial, fallback `/dashboard`.

## Limitaciones conocidas
1. No se ejecuto verificacion directa en Supabase (sin conexion MCP/DB activa en este entorno).
2. Pago de deuda usa enfoque multi-query con rollback compensatorio; no transaccion SQL atomica real.
3. Persisten referencias internas legacy de goals para compatibilidad; limpieza total requiere fase adicional controlada.
4. `pnpm lint` muestra warnings existentes del repo (no bloqueantes de build), no introducen error de compilacion.

## Recomendaciones siguientes
1. Migrar `payDebt` a RPC/server action transaccional.
2. Separar definitivamente `goal` de tipos/notificaciones legacy cuando se apruebe retiro final.
3. Ejecutar QA manual en navegador (mobile + dark mode) sobre botones de calendario y flujo de pago.
4. Monitorear trafico a `/goals` y planificar deprecacion final de tabla goals con backup previo.
