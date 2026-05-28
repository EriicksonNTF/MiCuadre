# MiCuadre 🚀

**Tu asistente financiero personal** - Una aplicación móvil y web (PWA) moderna para gestionar finanzas personales con seguimiento de cuentas, tarjetas de crédito, transacciones, presupuestos, metas de ahorro e inteligencia artificial adaptada al mercado dominicano.

---

## 📸 Vista Previa (Mockups 3D)

<div align="center">
  <table style="border-collapse: collapse; border: none; border-spacing: 15px;">
    <tr>
      <td align="center" valign="top" width="32%">
        <img src="Mockup%203D/Mockup%203D%20Dashboard.png" width="100%" style="border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" alt="Dashboard principal"/>
        <br />
        <sub style="font-size: 12px; color: #666;"><b>Dashboard Principal</b></sub>
      </td>
      <td align="center" valign="top" width="32%">
        <img src="Mockup%203D/Mockup%203D%20Transaccion.png" width="100%" style="border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" alt="Registro de transacciones"/>
        <br />
        <sub style="font-size: 12px; color: #666;"><b>Registro de Transacciones</b></sub>
      </td>
      <td align="center" valign="top" width="32%">
        <img src="Mockup%203D/Mockup%203D%20Metas.png" width="100%" style="border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" alt="Metas de ahorro"/>
        <br />
        <sub style="font-size: 12px; color: #666;"><b>Metas de Ahorro</b></sub>
      </td>
    </tr>
  </table>
</div>

---

## 🌟 Funcionalidades Principales

### 💳 Gestión de Cuentas y Tarjetas
- **Cuentas de Efectivo y Débito**: Controla el saldo de tus billeteras y cuentas bancarias en tiempo real.
- **Ciclos de Crédito Realistas**: Seguimiento de tarjetas de crédito con cálculo de fechas de corte, fechas límite de pago, pago mínimo y simulación de interés financiero (1.5% mensual sobre saldo financiado).
- **Personalización Visual**: Soporte de branding para los principales bancos dominicanos (Popular, BHD, Banreservas, etc.) con sus respectivos colores e íconos.
- **Soporte Multi-moneda**: Gestión nativa de cuentas en Pesos Dominicanos (DOP) y Dólares Estadounidenses (USD).

### 💸 Transacciones y Transferencias
- **Registro Detallado**: Categorización automática de ingresos y gastos.
- **Transferencias Inteligentes**: Módulo para mover fondos entre cuentas propias o transferir a beneficiarios registrados, con soporte para comisiones bancarias automáticas e impuestos (como el 0.15% en transferencias electrónicas).
- **Mutaciones Optimistas**: Actualización instantánea en la interfaz de usuario antes de recibir respuesta del servidor para una experiencia fluida.

### 📶 Arquitectura Offline-First (Sin Conexión)
- **Persistencia en IndexedDB**: Almacenamiento local mediante la base de datos `micuadre-offline` para consultar saldos e historial sin internet.
- **Outbox Pattern**: Cola de operaciones de escritura pendientes de sincronización (`offline_outbox`).
- **Idempotencia Anti-Duplicados**: Generación de `idempotency_key` en el cliente y validación en metadatos de Supabase para evitar registros duplicados en caso de cortes de red a mitad de una transacción.
- **Sincronización Automática**: El motor de sincronización (`Sync Engine`) se activa al detectar red (`navigator.onLine`), al enfocar la app (`focus`), o al cambiar la visibilidad del documento, con la opción de forzar sincronización manual desde un banner de estado.

### 📷 Escaneo de Recibos con OCR Local
- **100% Privado**: El escaneo y procesamiento se realizan localmente en el dispositivo utilizando **Tesseract.js** (sin enviar fotos a servidores de terceros).
- **Preprocesamiento Avanzado**: Reducción de ruido, ajuste de escala y variantes de alto contraste/rotación de la imagen para maximizar la tasa de éxito.
- **Detección de Calidad**: Cálculo automático de desenfoque/borrosidad (varianza laplaciana) para alertar al usuario si la foto necesita mejor iluminación.
- **Prefill Inteligente**: Extracción automática de comercio, monto, moneda, fecha y categoría sugerida para rellenar de inmediato el formulario de gastos.

### 🤖 Copiloto Financiero con IA ("MIA")
- **Asistente Integrado**: Chat conversacional que responde a preguntas sobre tu estado financiero real utilizando contexto local del usuario.
- **Acciones Directas en el Chat**: Posibilidad de confirmar transacciones y borradores sugeridos por la IA directamente desde los botones del chat.
- **Límites de Uso Inteligentes**: Acceso controlado a funciones avanzadas dependiendo del plan contratado.

### 🎟️ Suscripciones y Gestión de Planes (Stripe)
- **Planes Free y Pro**:
  - **Plan Free**: Acceso básico. Limitado a 3 cuentas, 2 metas de ahorro y 3 suscripciones financieras.
  - **Plan Pro**: Cuentas, metas y suscripciones ilimitadas, reportes detallados, MIA avanzada y exportaciones de datos en CSV/Excel.
- **Pasarela Completa**: Integración con Stripe para gestionar checkout de planes (mensual/anual) y portal de autoservicio de facturación.
- **Sincronización por Webhooks**: Procesamiento inmediato de eventos de Stripe (`invoice.paid`, `customer.subscription.deleted`, etc.) para actualizar las capacidades de la cuenta.

---

## 🛠️ Stack Tecnológico

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript
- **Estilos**: Tailwind CSS v4 con componentes Radix UI y animaciones personalizadas
- **Backend / Base de Datos**: Supabase (PostgreSQL + Auth con soporte para RLS)
- **Suscripciones y Pagos**: Stripe
- **Estado y Caché**: SWR con mutaciones optimistas
- **Formularios**: React Hook Form + Zod
- **Motor de OCR**: Tesseract.js (Local en cliente)
- **Base de datos local**: IndexedDB

---

## 📂 Estructura del Proyecto

```
MiCuadre/
├── app/                    # Páginas y Rutas de Next.js (App Router)
│   ├── page.tsx           # Dashboard principal (/) (Protegido por Auth)
│   ├── accounts/         # Gestión de cuentas y tarjetas de crédito
│   ├── api/              # Endpoints API (Billing, Webhooks Stripe, IA, etc.)
│   ├── auth/             # Flujos de autenticación de Supabase (OAuth, Login, Sign Up)
│   ├── coach-ia/         # Interfaz conversacional con el Copiloto MIA
│   ├── dashboard/        # Redireccionamiento al dashboard principal (/)
│   ├── expense/          # Creación y edición de gastos/ingresos
│   ├── goals/            # Seguimiento de metas de ahorro e inversión
│   ├── history/          # Historial global de movimientos
│   ├── inicio/           # Landing page promocional de MiCuadre
│   ├── notifications/    # Centro y alertas de notificaciones
│   ├── onboarding/       # Flujo inicial de bienvenida y configuración
│   ├── pay/              # Pagos de tarjetas y transferencias
│   ├── scan/             # Escáner de recibos mediante OCR local
│   ├── send/             # Transferencias entre cuentas y beneficiarios
│   ├── settings/         # Ajustes de perfil, facturación y logs
│   └── layout.tsx        # Layout principal de la aplicación
├── components/             # Componentes React
│   ├── accounts/         # Screens y formularios de cuentas
│   ├── billing/          # Selector de planes y pasarela
│   ├── dashboard/        # Widgets del dashboard financiero
│   ├── entitlements/     # Controladores de acceso, banners de límite y upsell
│   ├── ui/               # Componentes base e interactivos (shadcn-style)
│   └── navigation/       # Menú inferior y cabeceras
├── hooks/                  # Hooks personalizados de React
│   ├── use-auth.ts       # Estado de sesión y perfil de Supabase
│   ├── use-data.ts       # Data fetching unificado con SWR
│   ├── use-entitlements.ts # Verificación y límites del plan contratado
│   └── use-billing-status.ts # Consulta del estado de Stripe
├── lib/                    # Utilidades y lógica de negocio
│   ├── supabase/         # Clientes Browser y Server para Supabase
│   ├── offline/          # Base de datos IndexedDB y motor de sincronización
│   ├── entitlements/     # Reglas y control de límites del plan
│   ├── billing/          # Definición de planes, precios y sincronización de Stripe
│   └── credit-cycle.ts   # Algoritmo de cálculo de ciclos y financiamiento de tarjetas
└── scripts/                # Scripts de automatización y migraciones SQL
    ├── *.sql             # Migraciones base de datos (001_ a 022_)
    └── *.mjs             # Scripts de prueba e integración
```

---

## 🗄️ Base de Datos y Migraciones

La base de datos PostgreSQL se gestiona mediante Supabase. Las tablas principales incluyen:
- `profiles`: Registro del perfil de usuario, plan de suscripción (`plan_tier`), estado y tokens de Stripe.
- `accounts`: Cuentas monetarias (efectivo, débito) y tarjetas de crédito (con campos de corte y pago).
- `transactions` / `transfers` / `beneficiaries`: Registros de flujos monetarios y destinatarios.
- `billing_customers` / `billing_subscriptions` / `billing_events`: Datos de sincronización de Stripe.
- `goals` / `notifications`: Módulos de objetivos de ahorro y notificaciones con estado leído/no leído.

### Scripts de Migración Destacados
Los scripts de la carpeta [scripts/](file:///Users/papolo/Documents/MiCuadre/MiCuadre/scripts) están ordenados cronológicamente:
- `001_create_schema.sql` - Estructura base de tablas, tipos y RLS.
- `012_subscriptions_module.sql` - Soporte para suscripciones recurrentes de finanzas.
- `018_profiles_plan_fields.sql` - Campos de planes (`free`/`pro`) en perfiles de usuario.
- `019_billing_blueprint.sql` - Tablas, índices y políticas RLS para sincronización Stripe.
- `022_avatar_storage_rls_and_push_subscriptions.sql` - Configuración de buckets y push notifications.

Para sincronizar los tipos de base de datos en tu frontend, utiliza:
```bash
npx supabase gen types typescript --local > lib/types/supabase.ts
# O mediante el script de sincronización local
```

---

## ⚙️ Configuración y Despliegue Local

### 1. Variables de Entorno (`.env.local`)
Crea un archivo `.env.local` en la raíz del proyecto (basándote en [.env.example](file:///Users/papolo/Documents/MiCuadre/MiCuadre/.env.example)):

```env
# Conexión Supabase
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-publica
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-privada

# Integración Stripe (Servidor)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_MONTHLY_PRICE_ID=price_...
STRIPE_PRO_YEARLY_PRICE_ID=price_...

# Opcional: Notificaciones Web Push
NEXT_PUBLIC_VAPID_PUBLIC_KEY=tu-vapid-public-key
VAPID_PRIVATE_KEY=tu-vapid-private-key
VAPID_SUBJECT=mailto:soporte@micuadre.app
```

### 2. Configuración de Proveedores de Autenticación
Para habilitar el inicio de sesión social (Google/Apple) a través de Supabase:
1. Ve a **Supabase Dashboard -> Authentication -> Providers**.
2. Activa **Google** y/o **Apple** y añade tu `Client ID` y `Client Secret`.
3. Configura la URL de redirección en tu proveedor externo:
   - `http://localhost:3000/auth/callback` (para desarrollo)
   - `https://tudominio.com/auth/callback` (para producción)
4. En **Authentication -> URL Configuration**, añade el dominio en `Site URL` y en `Redirect URLs` permitidas.

### 3. Comandos de npm / pnpm
```bash
pnpm install          # Instalar dependencias
pnpm dev              # Iniciar el servidor de desarrollo (puerto 3000)
pnpm build            # Compilar versión de producción
pnpm start            # Iniciar servidor compilado en producción
```

---

## 🔧 Solución de Problemas

### Error en Servidor de Desarrollo: "ENOENT: no such file or directory"
Si el servidor de desarrollo de Next.js falla repentinamente mostrando un error similar a:
```
Error: ENOENT: no such file or directory, open '.../.next/dev/server/middleware-manifest.json'
```
Significa que la caché generada en el directorio `.next` está corrupta.

**Solución paso a paso:**
1. Detén los procesos activos de Next:
   ```bash
   pkill -f "next" 2>/dev/null
   ```
2. Elimina la carpeta de caché por completo:
   ```bash
   rm -rf .next
   ```
3. Fuerza la reinstalación limpia de dependencias:
   ```bash
   pnpm install --force
   ```
4. Genera una compilación de prueba para asegurar la sanidad del build:
   ```bash
   pnpm build && pnpm start
   ```
5. Si compila correctamente, puedes volver a usar el servidor de desarrollo:
   ```bash
   pnpm dev
   ```

---

**MiCuadre** - Simplifica y toma el control absoluto de tus finanzas.
