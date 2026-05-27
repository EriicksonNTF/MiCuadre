# Goals Deprecation Cleanup

## Estado
La funcionalidad pública de **Metas** fue reemplazada por **Planificación**.

## Qué se limpió
- UI pública de Metas removida o reemplazada por copy de Planificación.
- Rutas públicas legacy:
  - `/goals` -> redirige a `/planning`
  - `/goals/[id]` -> redirige a `/planning`
- Copys de navegación, ayuda, dashboard y coach ajustados para usar Planificación/Presupuestos/Deudas.

## Qué se mantiene intencionalmente
- Tabla `goals` y flujo técnico asociado en backend, QA y algunas utilidades analíticas.
- Campos legacy de entitlements (`max_goals`) para compatibilidad temporal.
- Tipos de notificación legacy (`goal`) para no romper historiales ya emitidos.

Estas referencias se mantienen para evitar regresiones en producción mientras se valida adopción total de Planning.

## Estrategia segura de retiro de base de datos (recomendada)
1. Mantener redirecciones `/goals` por al menos 1 ciclo de release.
2. Medir tráfico real a endpoints/tabla `goals`.
3. Confirmar que ningún flujo productivo depende de `goals`.
4. Tomar backup lógico de `goals` y `goal_contributions`.
5. Ejecutar migración de deprecación no destructiva (renombrar, marcar archived o bloquear escrituras).
6. Solo con aprobación explícita: migración destructiva para drop definitivo.

## Nota
No se ejecutó ningún `DROP TABLE` en esta fase.
