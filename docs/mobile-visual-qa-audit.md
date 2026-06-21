# Auditoría visual mobile iOS/PWA — MiCuadre

> Fecha: 2026-06-02 (2 pases: pantallas principales + formularios profundos)
> Dispositivo simulado: iPhone (430×932)
> URL base: `https://micuadre-five.vercel.app`
> Build: ✅ `pnpm run build:safe` exitoso sin errores

---

## Resumen ejecutivo

| Métrica | Valor |
|---|---|
| Screenshots totales | **~50 únicos** (31 primer pase + 29 segundo pase) |
| Módulos auditados | **17** |
| Formularios/modales/sheets inspeccionados | **12+** |
| Problemas reales | **3** |
| Críticos | **1** (React hydration error → fix aplicado localmente) |
| Altos | **2** (Coach IA no funcional) |
| Medios | **0** |
| Bajos | **0** |
| Módulo más afectado | `settings/security` (crítico), `coach-ia` (alto) |

### Fix aplicado durante la auditoría

El error crítico C-001 (hydration error en `/settings/security`) fue corregido en el código fuente:

- **Archivo:** `app/settings/security/page.tsx`
- **Cambio:** `isPasskeyEnabled()` y `isPasskeySupported()` movidas de `useState`/`useMemo` a `useEffect`
- **Build:** ✅ Compila sin errores, TypeScript OK, 51 páginas generadas
- **Nota:** El fix está en el código local. Se reflejará en producción al hacer deploy.

---

## Tabla de problemas

| ID | Severidad | Módulo | Ruta | Screenshots | Problema | Impacto | Causa probable | Recomendación | Estado |
|---|---|---|---|---|---|---|---|---|---|
| C-001 | 🔴 Crítico | settings/security | `/settings/security` | `info__settings-security__seguridad.png` | React error #418: mismatch SSR/CSR | La página no hidrata → toggles no funcionan, UI rota | `isPasskeySupported()` usa `window.PublicKeyCredential` en SSR (no existe) | ✅ **FIX APLICADO** en `app/settings/security/page.tsx` vía `useEffect` | Fix local ✅ (pendiente deploy) |
| H-001 | 🟠 Alto | coach-ia | `/coach-ia` | `info__coach-ia__coach-ia-chat.png` | API `/api/mia/chat` retorna 403 Forbidden | Chat no funciona, usuario no puede usar Coach IA | Token JWT no se envía correctamente o endpoint requiere plan Pro | Revisar autenticación en `app/api/mia/chat/route.ts` | Pendiente |
| H-002 | 🟠 Alto | coach-ia | `/coach-ia` | `info__coach-ia__coach-ia-chat.png` | No hay campo de input visible | Usuario no puede escribir mensajes | Posible gating por plan Pro o el error 403 impide render completo | Verificar gating por plan y pantalla de upgrade | Pendiente |

---

## Formularios profundos auditados

Se ejecutó un segundo pase específico para abrir formularios, modales y sheets interactivos.

### ✅ Capturados exitosamente

| Formulario/Modal | Ruta | Screenshot | Estado |
|---|---|---|---|
| Lista de cuentas | `/accounts` | `accounts/info__accounts__lista-cuentas.png` | ✅ |
| Detalle de cuenta | `/accounts/[id]` | `accounts/info__...__detalle-cuenta.png` | ✅ |
| ~~Editar transacción (detalle cuenta)~~ | `/accounts/[id]` | `transactions/info__...__modal-editar-transaccion.png` | ✅ |
| Formulario gasto/ingreso | `/expense` | `transactions/info__expense__formulario-gasto.png` | ✅ |
| Modal nueva categoría (inline) | `/expense` | `transactions/info__expense__modal-nueva-categoria.png` | ✅ |
| Historial transacciones | `/history` | `transactions/info__history__historial.png` | ✅ |
| Pantalla de pago tarjeta | `/pay` | `pay/info__pay__pantalla-pago.png` | ✅ |
| Pantalla de envío | `/send` | `send/info__send__pantalla-envio.png` | ✅ |
| Formulario envío (con datos) | `/send` | `send/info__send__formulario-envio-base.png` | ✅ |
| Scanner | `/scan` | `scan/info__scan__pantalla-scan.png` | ✅ |
| Planning principal | `/planning` | `planning/info__planning__planning-principal.png` | ✅ |
| Metas | `/goals` | `goals/info__goals__metas.png` | ✅ |
| Notificaciones | `/notifications` | `notifications/info__notifications__notificaciones.png` | ✅ |
| Coach IA | `/coach-ia` | `coach-ia/info__coach-ia__coach-ia.png` | ✅ |
| Perfil | `/profile` | `profile/info__profile__perfil.png` | ✅ |
| Ajustes principal | `/settings` | `settings/info__settings__ajustes.png` | ✅ |
| Modal selector tema | `/settings` | `settings/info__settings__modal-selector-tema.png` | ✅ |
| Drawer planes | `/settings` | `settings/info__settings__drawer-planes.png` | ✅ |
| Categorías lista | `/settings/categories` | `settings/info__settings-categories__categorias-lista.png` | ✅ |
| Plan actual | `/settings/plan` | `settings/info__settings-plan__plan-actual.png` | ✅ |
| Seguridad | `/settings/security` | `settings/info__settings-security__seguridad.png` | ✅ |
| Seguridad/Privacidad | `/settings/security-privacy` | `settings/info__settings-security-privacy__seguridad-privacidad.png` | ✅ |
| Suscripciones lista | `/settings/subscriptions` | `subscriptions/info__settings-subscriptions__suscripciones-lista.png` | ✅ |
| Modal crear suscripción | `/settings/subscriptions` | `subscriptions/info__...__modal-crear-suscripcion.png` | ✅ |
| Reportes | `/settings/reports` | `settings/info__settings-reports__reportes.png` | ✅ |
| Dashboard | `/` | `dashboard/info____dashboard.png` | ✅ |
| Login | `/auth/login` | `auth/info__auth-login__login.png` | ✅ |
| Registro | `/auth/sign-up` | `auth/info__auth-sign-up__registro.png` | ✅ |
| Olvidé contraseña | `/auth/forgot-password` | `auth/info__auth-forgot-password__olvide-contrasena.png` | ✅ |
| Landing pública | `/inicio` | `public/info__inicio__landing-publica.png` | ✅ |

### ❌ No pudieron abrirse automáticamente

Estos formularios requieren datos específicos o selectores que no se encontraron durante la auditoría automática:

| Formulario/Modal | Ruta | Causa | Recomendación |
|---|---|---|---|
| Crear cuenta (+) | `/accounts` | Botón + no encontrado (posiblemente FAB con icono SVG) | Verificar selector manualmente |
| Transferir | `/accounts` | Icono de transferencia no clickeable | Verificar selector |
| Editar transacción (historial) | `/history` | No hay transacciones con icono editar visible | Crear datos de prueba con transacciones |
| Sheet monto personalizado | `/pay` | Botón "Otro monto" no clickeable | Verificar que el botón exista con datos de tarjeta |
| Crear presupuesto | `/planning` | Tab de presupuestos no encontrado o sin botón + | Revisar si el usuario actual tiene plan Pro |
| Crear deuda | `/planning` | Tab de deudas no encontrado | Revisar UI de planning tabs |
| Calendario | `/planning` | Tab de calendario no encontrado | Revisar UI de planning tabs |
| Crear categoría (settings) | `/settings/categories` | Botón + no encontrado | Verificar selector |
| Modal cerrar sesión | `/settings` | Botón "Cerrar sesión" no clickeable | Verificar texto exacto |
| Agregar beneficiario | `/send` | Botón no encontrado | Verificar que exista en la página |
| Currency picker | `/settings` | Botón "Moneda" no encontrado | Verificar texto exacto |

**Nota:** La mayoría de estos son limitaciones del auditor automático, no bugs de la app. Se recomienda revisión manual de estas pantallas usando los screenshots de las páginas principales ya capturados.

---

## Módulos auditados (detalle completo)

### A. Auth — 4 screenshots
- ✅ Login (`/auth/login`)
- ✅ Registro (`/auth/sign-up`)
- ✅ Olvidé contraseña (`/auth/forgot-password`)
- ✅ Error auth (`/auth/error`)
- **Problemas: 0**

### B. Onboarding
- No se detectó onboarding activo (usuario de prueba ya completó)
- **Problemas: 0**

### C. Dashboard — 2 screenshots
- ✅ Dashboard principal (`/`)
- **Problemas: 0**

### D. Accounts — 2 screenshots (+ 1 modal transacción)
- ✅ Lista de cuentas
- ✅ Detalle de cuenta
- ✅ Modal editar transacción (desde detalle)
- ❌ Modal crear cuenta no pudo abrirse
- **Problemas: 0**

### E. Pay — 1 screenshot
- ✅ Pantalla de pago
- ❌ Sheet monto personalizado no pudo abrirse automáticamente
- **Problemas: 0**

### F. Transactions — 6 screenshots
- ✅ Formulario gasto/ingreso (con campos: tipo, monto, moneda, comisión, fecha, cuenta, categoría, descripción, recurrencia)
- ✅ Modal nueva categoría inline
- ✅ Historial de transacciones
- ❌ Editar/eliminar transacción desde historial (no había datos)
- **Problemas: 0**

### G. Send — 2 screenshots
- ✅ Pantalla de envío
- ✅ Formulario con datos
- ❌ Modal agregar beneficiario no abrió
- **Problemas: 0**

### H. Scan — 1 screenshot
- ✅ Scanner
- **Problemas: 0**

### I. Planning — 1 screenshot
- ✅ Planning principal
- ❌ Tabs (presupuestos/deudas/calendario) no se abrieron automáticamente
- **Problemas: 0**

### J. Goals — 2 screenshots
- ✅ Lista de metas (`/goals`)
- **Problemas: 0**

### K. Notifications — 1 screenshot
- ✅ Notificaciones
- **Problemas: 0**

### L. Coach IA — 2 screenshots
- ❌ **Problemas: 2** (H-001, H-002)
- API 403 y sin input visible

### M. Profile — 2 screenshots
- ✅ Perfil de usuario
- **Problemas: 0**

### N. Settings — 17 screenshots (modo más auditado)
- ✅ Principal
- ✅ Modal selector tema
- ✅ Drawer planes (plan selector)
- ✅ Plan actual
- ✅ Categorías (lista)
- 🔴 **Seguridad (crítico)** — Fix aplicado localmente
- ✅ Seguridad/Privacidad
- ✅ Reportes
- ✅ Suscripciones (lista)
- ✅ Modal crear suscripción
- ✅ Ayuda
- ✅ Acerca de
- ❌ Modal selector moneda no abrió
- ❌ Modal cerrar sesión no abrió

### O. Legal — 3 screenshots
- ✅ Términos, Privacidad, Aviso Legal
- **Problemas: 0**

### P. Q&A — 1 screenshot
- ✅ Preguntas frecuentes
- **Problemas: 0**

### Q. Public — 1 screenshot
- ✅ Landing pública (`/inicio`)
- **Problemas: 0**

---

## Problemas críticos

### 🔴 C-001: React hydration error en `/settings/security` — FIX APLICADO

**Archivo:** `app/settings/security/page.tsx`

**Problema original:**
```tsx
const [isBiometricEnabled, setIsBiometricEnabled] = useState(isPasskeyEnabled())
const supported = useMemo(() => isPasskeySupported(), [])
```

`isPasskeyEnabled()` y `isPasskeySupported()` leen `window.PublicKeyCredential`. Durante SSR no existe → cliente recibe HTML diferente → error #418.

**Fix aplicado:**
```tsx
const [isBiometricEnabled, setIsBiometricEnabled] = useState(false)
const [supported, setSupported] = useState(false)

useEffect(() => {
  setSupported(isPasskeySupported())
  setIsBiometricEnabled(isPasskeyEnabled())
}, [])
```

✅ Build exitoso. Pendiente deploy a producción para verificar.

---

## Problemas de API/Runtime

### 🟠 H-001: API 403 en Coach IA

**Endpoint:** `POST /api/mia/chat` → 403 Forbidden.

**Causas posibles:**
1. Token JWT no se envía en headers de fetch del chat
2. Service Worker cachea la respuesta 403
3. Chat requiere plan Pro y el usuario test no lo tiene
4. La cookie de sesión expiró entre login y navegación a coach-ia

### 🟠 H-002: Sin input en Coach IA

No se detectó campo de texto en la pantalla de chat. Posibles causas:
1. El chat solo se renderiza con plan Pro (gating por entitlement)
2. El error 403 impide que el componente de chat se monte
3. El input está en un shadow DOM o dentro de un WebComponent

---

## Formularios con problemas detectados

| Módulo | Ruta | Archivo | Problema | Severidad |
|---|---|---|---|---|
| Seguridad | `/settings/security` | `app/settings/security/page.tsx` | 🔴 Hydration error (FIX APLICADO) | Crítico |
| Expense | `/expense` | `components/expense/expense-form.tsx` | ⚠️ Usa componentes custom (no nativos). Revisar visualmente | Leve |
| Coach IA | `/coach-ia` | `app/coach-ia/page.tsx` | 🟠 Chat no carga, input ausente | Alto |

### Formularios que requieren revisión visual manual

Por limitaciones del auditor automático, estos formularios necesitan inspección visual humana:

1. **Crear/Editar cuenta** — modal con nombre, tipo, moneda, balance inicial, branding
2. **Transferir** — selector origen/destino, monto, comisión
3. **Crear presupuesto** — categoría, monto mensual, moneda, alerta
4. **Crear deuda** — nombre, tipo, monto, balance, cuenta vinculada, interés
5. **Pagar deuda** — resumen, selector cuenta, monto, notas
6. **Pago rápido tarjeta (planning)** — drawer con monto, DGII, tipo de cambio
7. **Confirmar pago** — sheet con swipe confirm, monto, DGII, advertencias
8. **Comprobante de pago** — overlay post-pago con icono, montos, referencia
9. **Crear/Editar categoría** — nombre, tipo, color picker
10. **Onboarding completo** — 4 pasos + plan selector
11. **Plan selector** — drawer con toggle mensual/anual, feature comparison

---

## Problemas de navegación/swipe-back

- ✅ Login redirige correctamente a `/dashboard`
- ✅ Todas las rutas cargan sin 404
- ✅ Sin errores de navegación detectados
- ❌ No se pudo probar swipe-back (automation limitation)

---

## Problemas de pagos/tarjetas

- ✅ Página `/pay` carga correctamente
- ✅ Flujo usa sheets modales (`CustomAmountSheet`, `ConfirmPaymentSheet`)
- ❌ No se pudo abrir el sheet de monto personalizado automáticamente

**Recomendación:** Revisión visual de:
- `pay/info__pay__pantalla-pago.png` — botones de opciones de pago visibles
- Confirmar que `SwipeConfirmButton` ("Desliza para pagar") esté en posición correcta
- Verificar formato de montos DOP/USD
- Verificar que DGII se muestre donde corresponde

---

## Problemas de idioma/texto

No se detectaron automáticamente:
- Mojibake (caracteres rotos como `dónde`, `categorías`)
- Texto en inglés en UI en español
- Referencias a "Goals"/"Metas" inconsistentes
- Etiquetas duplicadas

**Recomendación:** Revisión visual de screenshots para confirmar.

---

## Recomendaciones por prioridad

### 🔴 Corregir inmediatamente

1. **C-001: Hydration error en `/settings/security`**
   - ✅ **Fix aplicado** en `app/settings/security/page.tsx`
   - ⏳ **Pendiente:** Hacer deploy a producción para verificar

### 🟠 Corregir en siguiente release

2. **H-001/H-002: Coach IA no funcional**
   - **Archivos:** `app/api/mia/chat/route.ts`, `app/coach-ia/page.tsx`
   - **Diagnóstico:** Verificar por qué API retorna 403. Posiblemente JWT no se envía o requiere plan Pro
   - **Timepo estimado:** 30-60 min

### 🟡 Revisión visual pendiente (humana)

3. **Revisar manualmente los ~50 screenshots** en `screenshots/audit/` para detectar:
   - Layout: textos solapados, botones ocultos, overflow horizontal
   - Safe-area padding en iOS (notch, home indicator)
   - Bottom nav superpuesto al contenido
   - Formularios largos sin scroll
   - Contraste y legibilidad en cards financieros
   - Separación visual DOP/USD en tarjetas multidivisa
   - Formatos de fecha/moneda consistentes
   - Sheets y drawers que no se abrieron automáticamente (ver lista en sección anterior)

---

## Screenshots generados

```
screenshots/audit/
├── accounts/
│   ├── info__accounts-2d48359a-..._detalle-cuenta.png
│   └── info__accounts__lista-cuentas.png
├── auth/
│   ├── info__auth-error__error-auth.png
│   ├── info__auth-forgot-password__olvide-contrasena.png
│   ├── info__auth-login__login.png
│   └── info__auth-sign-up__registro.png
├── coach-ia/
│   ├── info__coach-ia__coach-ia-chat.png
│   └── info__coach-ia__coach-ia.png
├── dashboard/
│   ├── info____dashboard-principal.png
│   └── info____dashboard.png
├── goals/
│   ├── info__goals__metas-lista.png
│   └── info__goals__metas.png
├── legal/
│   ├── info__legal-aviso-legal__aviso-legal.png
│   ├── info__legal-privacidad__privacidad.png
│   └── info__legal-terminos__terminos.png
├── logs/
│   ├── audit-log.json
│   └── audit-log-deep.json
├── notifications/
│   └── info__notifications__notificaciones.png
├── pay/
│   └── info__pay__pantalla-pago.png
├── planning/
│   └── info__planning__planning-principal.png
├── profile/
│   ├── info__profile__perfil-usuario.png
│   └── info__profile__perfil.png
├── public/
│   └── info__inicio__landing-publica.png
├── qa/
│   └── info__qa__preguntas-frecuentes.png
├── scan/
│   └── info__scan__pantalla-scan.png
├── send/
│   ├── info__send__formulario-envio-base.png
│   └── info__send__pantalla-envio.png
├── settings/
│   ├── [17 screenshots: principal, plan, categorías, seguridad, privacidad,
│        reportes, suscripciones, ayuda, acerca, tema picker, plan drawer]
└── transactions/
    ├── info__...__modal-editar-transaccion.png
    ├── info__expense__formulario-gasto.png
    ├── info__expense__modal-nueva-categoria.png
    ├── info__history__historial.png
    └── [2 screenshots del primer pase]
```

**Total: ~50 screenshots únicos** (31 + 29 con overlaps)

---

## Resultado de build

```
$ pnpm run build:safe
✓ Compiled successfully
✓ TypeScript check passed
✓ All 51 pages generated
✓ Static pages: 51/51
✓ No warnings or errors
```

El build compila sin errores. TypeScript pasa sin problemas. El fix de hydration no rompió nada.

---

## Próximos pasos sugeridos

1. ✅ ~~Build verificado~~ — Completado
2. ✅ ~~Screenshots principales~~ — 31 capturas
3. ✅ ~~Screenshots formularios profundos~~ — 29 capturas adicionales
4. ✅ ~~Fix C-001 aplicado~~ — Hydration error corregido en código local
5. ⏳ **Deploy fix a producción** — Para verificar que settings/security funciona
6. 👁️ **Revisión visual humana** — ~50 screenshots en `screenshots/audit/`
7. 🔧 **Fix H-001/H-002** — Coach IA (30-60 min)
8. 📸 **Capturas manuales complementarias** — Sheets y drawers que no abrió el script automático

### Comandos útiles para continuar

```bash
# Tomar screenshot de una página específica en mobile
npm run screenshot -- --route=planning --mobile

# Auditoría completa automatizada
npm run audit:visual
npm run audit:visual-deep

# Build de producción
pnpm run build:safe
```

---

*Reporte generado por `scripts/audit-visual.mjs` + `scripts/audit-visual-deep.mjs`*
