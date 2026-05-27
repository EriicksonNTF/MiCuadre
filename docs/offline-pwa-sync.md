# Arquitectura y Sincronización Offline PWA en MiCuadre

Este documento detalla el funcionamiento del registro de transacciones offline, la persistencia en IndexedDB y el motor de sincronización de la aplicación **MiCuadre** en modo Progressive Web App (PWA).

---

## 1. Cómo Funciona el Registro Offline

Cuando un usuario registra un movimiento (gasto o ingreso) en la interfaz de usuario, la aplicación realiza el siguiente flujo:

1. **Detección de Conexión**: La aplicación evalúa el estado de la red mediante `navigator.onLine` en el cliente.
2. **Registro de Movimiento**:
   - **Con Internet**: Envía la transacción directamente al servidor Supabase.
   - **Sin Internet**: 
     1. Valida los campos del formulario localmente.
     2. Genera un ID local único (`local_tx_...`) y una clave de idempotencia (`idem_...`).
     3. Almacena la transacción de forma local en IndexedDB.
     4. Crea una tarea de sincronización pendiente en el almacén de salida (`offline_outbox`).
     5. Muestra una confirmación en pantalla con un mensaje descriptivo: *"Gasto guardado sin conexión. Se sincronizará cuando vuelva internet."*
3. **Vista Previa Inmediata**: La interfaz recalcula y muestra el balance neto y de las cuentas de forma local, incluyendo los movimientos pendientes.

---

## 2. Almacenamiento en IndexedDB

Para garantizar persistencia estructurada y no saturar `localStorage`, se utiliza IndexedDB bajo la base de datos `micuadre-offline` con los siguientes almacenes (`objectStores`):

### `transactions_cache`
Caché local de transacciones previamente sincronizadas con el servidor. Permite la lectura offline del historial de movimientos.

### `accounts_cache`
Caché local de las cuentas del usuario (Efectivo, Débito, Crédito) para habilitar el dashboard offline.

### `offline_outbox`
Cola de operaciones pendientes por enviar a Supabase. Cada elemento tiene la siguiente estructura:
```typescript
interface OutboxItem {
  id: string;             // ID temporal generado en el cliente (keyPath)
  operation: "create_transaction";
  entity: "transactions";
  payload: any;           // Parámetros de la transacción
  status: "pending" | "syncing" | "failed";
  retry_count: number;
  created_at: string;
  last_attempt_at: string | null;
  last_error: string | null;
  idempotency_key: string; // Clave única para evitar duplicados
}
```

### `sync_errors`
Historial de fallas de sincronización para que el usuario pueda auditar errores.

> [!IMPORTANT]
> **Aislamiento de Sesión y Usuario**: 
> 1. Cada registro en `offline_outbox` incluye el campo `user_id` del usuario activo al momento de crearse.
> 2. El motor de sincronización (`sync-engine.ts`), los balances del dashboard y las listas de transacciones filtran en caliente la cola offline utilizando el `user_id` del usuario actualmente autenticado.
> 3. Todos los almacenes locales de IndexedDB se limpian al cerrar la sesión (`clearAllCaches()`) para garantizar la confidencialidad financiera en dispositivos compartidos.

---

## 3. Motor de Sincronización (Sync Engine)

El motor de sincronización (`lib/offline/sync-engine.ts`) actúa de manera automática e híbrida sin depender únicamente del Service Worker.

### Desencadenadores de Sincronización:
1. **Inicio de la aplicación**: Si el dispositivo tiene conexión al abrir la aplicación.
2. **Evento Online**: Al detectar el evento `window.addEventListener("online")`.
3. **Retorno al Foreground**: Escuchando el evento `document.addEventListener("visibilitychange")` cuando la pestaña de la PWA vuelve a estar activa.
4. **Acción Manual**: Botón flotante **"Sincronizar"** o **"Reintentar"** en el banner inferior de la app.

---

## 4. Prevención de Duplicados (Idempotencia)

Para evitar que una transacción se registre doble si la conexión falla a mitad del envío, se utiliza una **Idempotency Key**:

1. En el cliente, se genera un token único (`idempotency_key`) para cada transacción offline.
2. Este token se guarda dentro de la columna JSONB `metadata` de la tabla `transactions` en Supabase.
3. Antes de realizar una inserción, el motor de sincronización consulta Supabase:
   ```javascript
   const { data: existing } = await supabase
     .from("transactions")
     .select("id")
     .eq("metadata->>idempotency_key", item.idempotency_key)
     .maybeSingle()
   ```
4. Si ya existe un registro con dicha clave, la sincronización se marca como completada de forma segura y se remueve de la cola local sin crear duplicados.

---

## 5. Limitaciones de la Plataforma e iOS

Al tratarse de una PWA ejecutada en el navegador y no una aplicación nativa:

* **iOS/Safari**: Apple restringe fuertemente las ejecuciones en segundo plano cuando la PWA está completamente cerrada. APIs como *Background Sync*, *Periodic Background Sync* o *Background Fetch* no están disponibles o no son confiables en iOS.
* **Estrategia de Mitigación**:
  - Guardamos los gastos de forma 100% segura en IndexedDB mientras la app está abierta sin conexión.
  - El usuario ve el badge de **"Pendiente"** y el banner inferior.
  - La sincronización se realiza automáticamente tan pronto como el usuario vuelve a abrir o enfocar la app (visibility/focus event listener) si hay internet.
  - Se provee el botón manual de reintento.

---

## 6. Pasos para Probar el Comportamiento (QA)

Sigue estos pasos en Google Chrome para comprobar la robustez del sistema:

1. **Preparación**: Abre MiCuadre, inicia sesión y entra al dashboard con internet.
2. **Simular Sin Conexión**:
   - Abre Chrome DevTools -> Pestaña **Network** -> Cambia de *No throttling* a **Offline**.
3. **Registrar Gasto**:
   - Pulsa en **Nueva transacción** (Gasto).
   - Registra un gasto de RD$250 en la cuenta de Efectivo.
   - **Resultado esperado**:
     - El formulario se procesa instantáneamente.
     - Aparece un Toast: *"Gasto guardado sin conexión. Se sincronizará cuando vuelva internet."*
     - El balance neto disminuye por RD$250 (incluyendo el cambio temporal).
     - El balance neto muestra la leyenda: *"Incluye movimientos pendientes"*.
     - El gasto aparece en el historial con un badge color ámbar indicando **"Pendiente"**.
4. **Recargar sin conexión**:
   - Presiona `F5` / Recargar página (manteniendo el modo Offline).
   - **Resultado esperado**: La app abre desde el Service Worker, y los gastos y balances temporales siguen mostrándose correctamente (leídos de IndexedDB).
5. **Restaurar conexión**:
   - Cambia el DevTools Network de nuevo a **Online**.
   - **Resultado esperado**:
     - El motor de sincronización detecta la red e inicia de inmediato la subida.
     - El badge del gasto cambia a **"Subiendo..."** y luego desaparece al quedar sincronizado.
     - El banner flotante muestra un pill verde temporal: *¡Movimientos sincronizados!*
6. **Verificar duplicidad**:
   - Revisa el panel de Supabase: debe existir exactamente una fila para esa transacción.
