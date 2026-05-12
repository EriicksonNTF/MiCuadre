# MiCuadre

**Tu asistente financiero personal** - Una aplicación móvil/web para gestionar finanzas personales con seguimiento de cuentas, tarjetas de crédito, transferencias y metas de ahorro.

## Funcionalidades Principales

### Gestión de Cuentas
- **Cuentas de efectivo y débito** - Controla tu dinero en efectivo y cuentas bancarias
- **Tarjetas de crédito** - Seguimiento de ciclos de facturación, fechas de corte y pago mínimo
- **Multi-moneda** - Soporte para DOP (Pesos Dominicanos) y USD (Dólares)

### Transacciones
- Registro de ingresos y gastos por categoría
- Transferencias entre cuentas o a beneficiarios
- Comisiones automáticas en transferencias
- Conversión de moneda integrada

### Funcionalidades Avanzadas
- **Ciclos de crédito realistas** - Cálculo de interés financiero (1.5% mensual)
- **Notificaciones** - Alertas de fechas de pago, recordatorios de tarjeta
- **Metas de ahorro** - Seguimiento de objetivos financieros
- **Perfil de usuario** - Configuración de idioma, moneda preferida, tema

## Stack Tecnológico

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript
- **Estilos**: Tailwind CSS v4 con componentes Radix UI
- **Backend**: Supabase (PostgreSQL + Auth)
- **Estado**: SWR para data fetching con mutaciones optimistas
- **Formularios**: React Hook Form + Zod

## Estructura del Proyecto

```
MiCuadre/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Dashboard principal (/)
│   ├── accounts/         # Gestión de cuentas
│   ├── notifications/   # Centro de notificaciones
│   ├── goals/           # Metas de ahorro
│   ├── history/         # Historial de transacciones
│   └── settings/         # Configuración del usuario
├── components/
│   ├── dashboard/       # Componentes del dashboard
│   ├── ui/              # Componentes shadcn/ui
│   └── transactions/    # Componentes de transacciones
├── hooks/
│   └── use-data.ts      # Data fetching con SWR
├── lib/
│   ├── supabase/       # Cliente/Server Supabase
│   ├── credit-cycle.ts # Lógica de ciclos de crédito
│   ├── notifications.ts
│   └── types/          # Tipos TypeScript
└── scripts/
    └── *.sql           # Migraciones de base de datos
```

## Base de Datos

### Tablas Principales
- `profiles` - Perfil de usuario vinculado a auth.users
- `accounts` - Cuentas (cash, debit, credit)
- `transactions` - Ingresos y gastos
- `transfers` - Transferencias entre cuentas
- `beneficiaries` - Beneficiarios para transferencias
- `goals` - Metas de ahorro
- `notifications` - Notificaciones del sistema
- `categories` - Categorías de transacciones

### Scripts de Migración
Los scripts están numerados en orden de ejecución:
- `001_create_schema.sql` - Schema base
- `002_seed_categories.sql` - Categorías por defecto
- `006_credit_cycle_and_notification_metadata.sql` - Ciclos de crédito
- `011_credit_cycles_real_logic.sql` - Lógica de financing
- `012_credit_cycle_interest_and_financing.sql` - Intereses

## Configuración

### Variables de Entorno
```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000/auth/callback
```

### Configuracion OAuth (Google y Apple) en Supabase
Para que los botones sociales funcionen, necesitas configurar proveedores en Supabase:

1. Ve a `Supabase Dashboard -> Authentication -> Providers`.
2. Habilita `Google` y/o `Apple`.
3. Configura `Client ID` y `Client Secret` de cada proveedor.
4. En cada proveedor, agrega como Redirect URL:
   - `http://localhost:3000/auth/callback` (desarrollo)
   - `https://tu-dominio.com/auth/callback` (produccion)
5. En `Authentication -> URL Configuration`, agrega tus dominios en:
   - `Site URL`
   - `Redirect URLs` permitidas

Si la configuracion no es correcta, la app redirige a `/auth/error` con detalle tecnico.

### Scripts Disponibles
```bash
npm run dev     # Servidor de desarrollo (puerto 3000)
npm run build   # Build de producción
npm run start   # Iniciar servidor de producción
npm run lint    # Eslint
```

## Padrón UI

La interfaz sigue el estilo de **shadcn/ui** con:
- Componentes Radix UI accesibles
- Tailwind CSS para estilos
- Modo claro/oscuro
- Diseño mobile-first para app financiera
- Navegación inferior en móvil

## Funcionalidades Recientes

- **Notificaciones con estado "leído"** - Contador se limpia al ver notificaciones
- **Mutaciones optimistas** - Respuesta instantánea en UI
- **Ciclos de crédito avanzados** - Cálculo de intereses y financiamiento

## Contribución

El proyecto está configurado con Supabase. Para modificar el schema:
1. Edita los scripts SQL en `scripts/`
2. Ejecuta los scripts en tuabase de Supabase
3. Sincroniza los tipos con `scripts/003_sync_frontend_schema.sql`

---

**MiCuadre** - Simplifica tus finanzas personales.
