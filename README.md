## MiCuadre 📊

Aplicación PWA financiera para el mercado dominicano con gestión de cuentas, tarjetas de crédito, transacciones, presupuestos y un copiloto IA llamado "MIA".

### Características Principales
- 📱 Aplicación PWA (Progressive Web App)
- 💰 Gestión de cuentas y tarjetas
- 📊 Análisis de transacciones y presupuestos
- 🤖 Asistente IA MIA (Mi Asistente Inteligente de Asesoramiento)
- 🔔 Notificaciones Push con Web Push API

### Configuración del Proyecto

#### Variables de Entorno

Configure su `.env.local` con las siguientes variables:

| Variable | Descripción | Requerida |
|---------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL de Supabase | ✅ Sí |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anonima de Supabase | ✅ Sí |
| `VAPID_PUBLIC_KEY` | Clave pública para notificaciones Push | ✅ Sí |
| `VAPID_PRIVATE_KEY` | Clave privada para notificaciones Push | ✅ Sí |
| `COACH_IA_ALLOWED_EMAILS` | Emails permitidos para MIA (separados por coma) | ❌ No |

#### Seguridad
- **Protección de `.env.local`**: Este archivo está excluido de GitHub mediante `.gitignore` para evitar exponer claves sensibles.
- **Lifespan de claves**: Las VAPID keys deben generarse localmente y **nunca subirse al repositorio**.

### Estructura del Proyecto

```
src/                  # Código fuente principal
  app/ # Páginas y Rutas de Next.js (App Router)
  components/          # Componentes reutilizables
  hooks/               # Custom React Hooks
  lib/                 # Utilidades y lógica de negocio
  styles/              # Configuración de Tailwind y variables
public/                # Recursos estáticos
.next/                 # Archivos de compilación de Next.js
.env.local             # Variables de entorno locales (no subido al repo)
package.json           # Dependencias y scripts
npm rc/ # Estructura de configuración de npm
```

### Actualizaciones Recientes (2026-06-09)
- ✅ Agregadas VAPID keys como configuración requerida
- 🔒 Mejorada la seguridad de variables de entorno
- 📁 Actualizada estructura de archivos y documentación

### Troubleshooting

**Error: ENOENT o caché corrupta**
```bash
# Limpia la caché de Next.js
npm run dev -- --reset-cache
```

**Notificaciones no funcionan**
1. Verifica que las VAPID keys estén correctamente configuradas en `.env.local`
2. Confirma que el servicio worker esté habilitado en el navegador
3. Revisa la consola para errores de registro de servicio worker

### <!--[hide]-->

## 🛠️ Desarrollo Local

### 1. Instalación de Dependencias
```bash
# Instala dependencias (usa pnpm para mejores tiempos de build)
ppnpm install
```

### 2. Generación de Claves VAPID
```bash
# Instala web-push globalmente y genera claves seguras
npm install -g web-push && web-push generate-vapid-keys
```

### 3. Iniciar Servidor de Desarrollo
```bash
ppnpm dev
```

### 4. Verificación de Configuración
```bash
# Confirma que el archivo `.env.local` exista y tenga:
VAPID_PUBLIC_KEY=BL3gg6JUN1MUFycVYnKJYbdwVR6iG9qOImlGfpfcBsce32sre727WCiBoyFFanE9apGBfq5gB8JRA0JYblNBqZc
VAPID_PRIVATE_KEY=ZKibWnEPVO9zxFlyLQsteziKBmFsh7SFKUKMjCUAM7w
```

## ✅ Confirmación de Seguridad

- [x] **.env.local** está en `.gitignore` ✔️
- [x] **VAPID keys** generadas localmente y no expuestas ✔️
- [x] **Configuración actualizada** en README ✔️
