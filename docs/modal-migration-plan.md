# Plan de Migración del Sistema Modal — MiCuadre

> **Versión:** 1.0
> **Basado en:** Auditoría del Sistema Modal (docs/modal-system-audit.md)
> **Estado:** Pendiente de aprobación

---

## 1. Resumen Ejecutivo

La auditoría identificó **38 superficies modales** con problemas sistémicos: renders inline vulnerables a CSS containing blocks, fragmentación de z-index, duplicación de implementaciones, comportamientos de backdrop inconsistentes, animaciones dispares y brechas de accesibilidad.

Este plan define la arquitectura objetivo, el estándar unificado y la estrategia de migración en **4 fases incrementales** con mínimo riesgo de regresión. La meta es eliminar los 6 componentes inline vulnerables al containing block, unificar z-index, estandarizar animaciones/backdrops, y garantizar accesibilidad — todo sin reescrituras masivas.

**Principios rectores:**
1. Toda superficie modal debe renderizarse vía portal a `document.body`.
2. Un solo estándar de backdrop, z-index, animación y scroll lock.
3. Migración por sustitución de wrapper, no por reescritura de contenido.
4. Cada fase es desplegable de forma independiente.

---

## 2. Arquitectura Objetivo Recomendada

### 2.1 Diagrama de Capas

```
┌──────────────────────────────────────────────────────────────────┐
│                      TOASTS (z-[9999])                           │
│  SmartToast (custom) ─── portal a body                          │
├──────────────────────────────────────────────────────────────────┤
│                   FULLSCREEN FORMS (z-[200])                     │
│  MobileFullscreenForm ─── portal a body                          │
│  (usado exclusivamente por BaseModalForm en mobile)              │
├──────────────────────────────────────────────────────────────────┤
│                   MODALES PRINCIPALES (z-50)                      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  ModalOverlay (portal a body) — wrapper universal          │  │
│  │  Usado por:                                                │  │
│  │  • expense-form (category modal)          ✅ ya migrado     │  │
│  │  • dashboard-content (credit reminder)    ✅ ya migrado     │  │
│  │  • scan page (scanning overlay)           ✅ ya migrado     │  │
│  │  • bottom-nav quick-menu (NUEVO)          ──→ migrar        │  │
│  │  • side-nav quick-menu (NUEVO)            ──→ migrar        │  │
│  │  • financial-calendar-tab (NUEVO)         ──→ migrar        │  │
│  │  • BaseModalForm desktop backdrop (NUEVO) ──→ migrar        │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Radix AlertDialog — Alertas/Confirmaciones (ya portal)    │  │
│  │  • accounts-screen delete confirm         ✅ ya migrado     │  │
│  │  • account-detail delete confirm          ✅ ya migrado     │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Vaul Drawer — Bottom sheets interactivas (ya portal)      │  │
│  │  • debt-form-sheet                                         │  │
│  │  • budget-form-sheet              ──→ fix dismissible      │  │
│  │  • pay-debt-sheet                                          │  │
│  │  • quick-pay-card-sheet                                    │  │
│  │  • plan-selector-sheet                                     │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Sheet (Radix Dialog) — Side panels (ya portal)            │  │
│  │  • Sidebar mobile variant                                  │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  ConfirmPaymentSheet / CustomAmountSheet                   │  │
│  │  (MobileSheetLayout — requiere portal)  ──→ migrar         │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  MovementReceipt (ya portal a body)                        │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  PasskeyLockGate (ya no vulnerable, fuera de MobilePage)   │  │
│  └────────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────┤
│                   WIDGETS FLOTANTES (z-[60])                     │
│  CoachIAWidget (no es overlay, no requiere portal)               │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 Mapa de Decisiones por Componente

| Componente | Decisión | Razón |
|---|---|---|
| ModalOverlay | ✅ **Preservar y expandir** | Único componente con createPortal + scroll lock + backdrop estandarizado. Debe convertirse en el wrapper universal para overlays simples. |
| AlertDialog (Radix) | ✅ **Preservar** | Ya portal, ya accesible, ya estandarizado. Úsalo para confirmaciones/alertas. |
| Dialog (Radix) | ✅ **Preservar** | Ya portal. Úsalo para modales centrados con formularios complejos. |
| Sheet (Radix) | ✅ **Preservar** | Ya portal. Úsalo para side panels. |
| Drawer (Vaul) | ✅ **Preservar** | Ya portal. Úsalo para bottom sheets interactivos. |
| BaseModalForm | 🔧 **Refactorizar** | Envolver DesktopModal en ModalOverlay en vez de render inline. MobileFullscreenForm queda igual (z-[200] es seguro). |
| MobileSheetLayout | 🔧 **Refactorizar** | Envolver en ModalOverlay o agregar createPortal directo. |
| MobileFullscreenForm | 🔧 **Refactorizar** | Agregar createPortal a body. z-index bajar de [9999] a [200]. |
| MovementReceipt | ✅ **Preservar** | Ya portal, ya scroll lock. Solo estandarizar backdrop (ya hecho). |
| Modal (modal.tsx) | 🗑️ **Eliminar (dead code)** | Sin consumidores. Si se necesita en futuro, usar ModalOverlay. |
| QuickModal (modal.tsx) | 🗑️ **Eliminar (dead code)** | Sin consumidores. Si se necesita en futuro, usar ModalOverlay. |
| bottom-nav scrim | 🔧 **Refactorizar** | Reemplazar div manual por ModalOverlay. |
| side-nav scrim | 🔧 **Refactorizar** | Reemplazar div manual por ModalOverlay. |
| financial-calendar-tab | 🔧 **Refactorizar** | Reemplazar overlay manual por ModalOverlay o Drawer. |
| PasskeyLockGate | ✅ **Preservar** | Fuera de MobilePageShell, no vulnerable. Backdrop ya estandarizado. |

---

## 3. Componentes a Preservar

| Componente | Archivo | Justificación |
|---|---|---|
| ModalOverlay | components/ui/modal-overlay.tsx | Único overlay genérico con portal, scroll lock y backdrop estandarizado |
| AlertDialog + variantes | components/ui/alert-dialog.tsx | Radix portal, focus trap, ARIA completo. Ya migrado en delete confirmations |
| Dialog + variantes | components/ui/dialog.tsx | Radix portal. Estándar para modales centrados |
| Sheet + variantes | components/ui/sheet.tsx | Radix portal. Estándar para side panels |
| Drawer + variantes | components/ui/drawer.tsx | Vaul portal. Estándar para bottom sheets |
| Popover + variantes | components/ui/popover.tsx | Radix portal. Para floating triggers |
| MovementReceipt | components/receipts/movement-receipt.tsx | Único receipt portaleado. Ya tiene scroll lock |
| PasskeyLockGate | components/security/passkey-lock-gate.tsx | Fuera de MobilePageShell. Backdrop ya estandarizado |
| CoachIAWidget | components/dashboard/coach-ia-widget.tsx | Floating widget, no overlay |

---

## 4. Componentes a Refactorizar

| Componente | Cambio Requerido | Esfuerzo |
|---|---|---|
| BaseModalForm (DesktopModal) | Envolver en `<ModalOverlay asPortal={true}>` en vez de backdrop inline | Media |
| MobileSheetLayout | Envolver en `<ModalOverlay asPortal={true}>` o agregar `createPortal` directo | Baja |
| MobileFullscreenForm | Agregar `createPortal(contenido, document.body)` + bajar z-index a `z-[200]` | Baja |
| bottom-nav scrim | Reemplazar backdrop manual + lista flotante por ModalOverlay + contenido | Baja |
| side-nav scrim | Ídem bottom-nav | Baja |
| financial-calendar-tab overlay | Reemplazar overlay manual por ModalOverlay o Drawer de Vaul | Media |
| budget-form-sheet.tsx | Agregar `dismissible={false}` + contenedor `overflow-y-auto` | Mínimo |

---

## 5. Componentes a Deprecar

| Componente | Razón | Reemplazo |
|---|---|---|
| modal.tsx (Modal + QuickModal) | Dead code, sin consumidores | ModalOverlay |

---

## 6. Componentes a Eliminar

| Componente | Archivo | Acción |
|---|---|---|
| Modal | components/ui/modal.tsx | Eliminar archivo completo y su re-export del barrel |
| QuickModal | components/ui/modal.tsx | Eliminar junto con Modal |

---

## 7. Estándar de Overlay

### 7.1 ModalOverlay como Wrapper Universal

`ModalOverlay` debe convertirse en el **único proveedor de backdrop** para toda la app. Su API actual es suficiente:

```tsx
<ModalOverlay open={true} onClose={handleClose} blocking={false}>
  {children}
</ModalOverlay>
```

**Props finales:**

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| open | boolean | — | Controla visibilidad |
| onClose | (() => void) \| undefined | undefined | Callback al hacer clic fuera. Si no se provee, no hay cierre por backdrop |
| blocking | boolean | false | Si es true, no se cierra al hacer clic fuera |
| children | ReactNode | undefined | Contenido a renderizar dentro del overlay |
| asPortal | boolean | true | Renderizar vía createPortal a document.body |
| className | string | "" | Clases adicionales para el backdrop |

### 7.2 Apariencia Estándar de Backdrop

**Única clase para todos los overlays:**

```css
bg-foreground/18 backdrop-blur-[6px] dark:bg-black/45
```

**Sin excepciones.** bottom-nav y side-nav deben migrar de `12%` a `18%`.

### 7.3 Click-Outside

| Tipo de modal | Comportamiento |
|---|---|
| Informativo / Confirmación | Cierra al hacer clic fuera |
| Formulario / Datos no guardados | NO cierra al hacer clic fuera (`blocking`) |
| Alerta destructiva | NO cierra al hacer clic fuera (`blocking`) |
| Receipt / Éxito | Cierra al hacer clic fuera |
| Passkey / Auth | No aplica (es pantalla completa) |

### 7.4 Body Scroll Lock

**Regla:** Todo overlay abierto debe agregar `modal-open` al `<body>`. Implementación:

```tsx
useEffect(() => {
  document.body.classList.add("modal-open")
  return () => document.body.classList.remove("modal-open")
}, [open])
```

`ModalOverlay` ya lo implementa. Radix/Vaul lo manejan internamente. Los componentes refactorizados heredarán este comportamiento al usar `ModalOverlay`.

---

## 8. Estándar de Z-Index

### 8.1 Mapa Definitivo

| Token | Valor | Uso | Responsabilidad |
|---|---|---|---|
| `--z-overlay-nav` | `40` | Overlays de navegación secundaria (quick-menus) | Debe estar debajo de overlays principales |
| `--z-overlay` | `50` | **TODOS** los modales, dialogs, sheets, drawers, popovers, tooltips | Capa estándar universal |
| `--z-floating` | `60` | Widgets flotantes (CoachIA) | Solo para elementos siempre visibles que no son overlays |
| `--z-fullscreen` | `200` | Fullscreen forms (MobileFullscreenForm) | Suficientemente alto sin llegar a toast territory |
| `--z-toast` | `9999` | Toasts (SmartToast, sonner) | Siempre visibles, nunca obstruidos |

### 8.2 Implementación

css
```css
@theme inline {
  --z-overlay-nav: 40;
  --z-overlay: 50;
  --z-floating: 60;
  --z-fullscreen: 200;
  --z-toast: 9999;
}
```

Uso en componentes: `z-[--z-overlay]`, `z-[--z-floating]`, etc.

### 8.3 Reglas de Jerarquía

1. **Nunca** usar valores bracket arbitrarios (`z-[90]`, `z-[100]`) para overlays.
2. Si un componente necesita estar sobre otro overlay, ambos deben estar en `z-50` y el orden DOM determina la prioridad (o usar `ModalOverlay` con composición anidada).
3. Los Radix/Vaul portals ya manejan su propio stacking dentro de `z-50`.
4. La excepción `z-[60]` existe solo para CoachIAWidget (flotante, no overlay).

---

## 9. Estándar de Animación

### 9.1 Tabla Unificada

| Tipo de Modal | Animación | Duración | Easing | Notas |
|---|---|---|---|---|
| Centro (AlertDialog, Dialog, ModalOverlay) | fade-in + zoom-in | 200ms | ease | Rápido, no obstructivo |
| Bottom sheet (Drawer, MobileSheetLayout) | slide-in-from-bottom | gestual (Vaul) | Vaul spring | Para Vaul: gestual nativo. Para MobileSheetLayout: 300ms ease-sheet-ios |
| Fullscreen form | fade-in + slide-in-from-bottom | 300ms | ease-sheet-ios | Transición suave a pantalla completa |
| Receipt (MovementReceipt) | fade-in + zoom-in | 200ms | ease | Consistente con modales centrados |
| Overlay simple (ModalOverlay) | fade-in | 200ms | ease | Solo backdrop, sin slide |
| Navigation overlay | fade-in | 150ms | ease | Rápido, no debe sentirse pesado |

### 9.2 Principios de Movimiento

1. **Duración corta para overlays utilitarios** (150-200ms). El usuario no debe esperar.
2. **Duración media para cambios de contexto** (300ms fullscreen). Transición natural.
3. **Gestual para bottom sheets** (Vaul). El arrastre sigue al dedo.
4. **Sin animación para estados críticos** si el usuario necesita actuar rápido.
5. **Respetar `prefers-reduced-motion`** en todos los casos.

---

## 10. Estándar de Accesibilidad

### 10.1 Requisitos por Tipo de Modal

| Requisito | Center Dialog | Bottom Sheet | Fullscreen | Overlay Simple | Navigation |
|---|---|---|---|---|---|
| role="dialog" | ✅ | ✅ | ✅ | ❌ (decorativo) | ❌ (decorativo) |
| aria-modal="true" | ✅ | ✅ | ✅ | ❌ | ❌ |
| aria-labelledby | ✅ | ✅ | ✅ | ❌ | ❌ |
| Focus trapping | ✅ | ✅ | ❌ (fullscreen ya captura) | ❌ | ❌ |
| Escape to close | ✅ | ✅ | ✅ | ✅ (si onClose existe) | ✅ |
| Inert background | ✅ (Radix) | ✅ (Vaul) | ✅ (fullscreen) | ❌ | ❌ |
| Close button visible | Opcional | ✅ | ✅ | Opcional | ✅ |

### 10.2 Implementación de Focus Trapping

Para componentes custom que no usan Radix/Vaul:

```tsx
// Ya existe: lib/a11y/use-modal-a11y.ts
useModalA11y({ containerRef, onClose, enabled: true, trapFocus: true })
```

**Regla:** `trapFocus: true` para modales centrados y bottom sheets. `trapFocus: false` para fullscreen forms (el usuario puede querer interactuar con notificaciones del sistema).

### 10.3 Screen Reader

- Al abrir un modal, el foco debe moverse al primer elemento interactivo dentro del modal.
- Al cerrar, el foco debe volver al elemento que disparó el modal.
- El backdrop debe tener `aria-hidden="true"` para que el screen reader no lo anuncie.
- Radix y Vaul manejan esto automáticamente. Para componentes custom, `useModalA11y` lo cubre parcialmente y debe extenderse.

---

## 11. Plan de Migración

### Fase 1 — Correcciones Inmediatas (Riesgo Bajo, Alto Impacto)

**Objetivo:** Arreglar bugs críticos sin refactorizar arquitectura.

| # | Tarea | Archivos | Esfuerzo | Riesgo |
|---|---|---|---|---|
| 1.1 | Agregar `dismissible={false}` + `overflow-y-auto` a budget-form-sheet | budget-form-sheet.tsx | 🟢 Mínimo | Bajo |
| 1.2 | Agregar scroll lock a bottom-nav quick-menu | bottom-nav.tsx | 🟢 Mínimo | Bajo |
| 1.3 | Agregar scroll lock a side-nav quick-menu | side-nav.tsx | 🟢 Mínimo | Bajo |
| 1.4 | Agregar scroll lock a financial-calendar-tab overlay | financial-calendar-tab.tsx | 🟢 Mínimo | Bajo |

**Validación:** Compilación exitosa + scroll bloqueado en iOS simulator.
**Rollback:** Revertir commits individuales.

---

### Fase 2 — Portalización de Overlays (Riesgo Medio, Impacto Crítico)

**Objetivo:** Eliminar la vulnerabilidad del CSS containing block envolviendo overlays inline en `ModalOverlay`.

| # | Tarea | Archivos | Esfuerzo | Riesgo |
|---|---|---|---|---|
| 2.1 | Envolver bottom-nav backdrop + menú en ModalOverlay | bottom-nav.tsx | 🟡 Medio | Medio — requiere reestructurar el menú flotante |
| 2.2 | Envolver side-nav backdrop + menú en ModalOverlay | side-nav.tsx | 🟡 Medio | Medio — mismo caso que bottom-nav |
| 2.3 | Envolver financial-calendar-tab overlay en ModalOverlay | financial-calendar-tab.tsx | 🟡 Medio | Medio — overlay con contenido dinámico |
| 2.4 | Envolver DesktopModal de BaseModalForm en ModalOverlay | base-modal-form.tsx | 🔴 Alto | Alto — 16 usos, probar cada formulario |
| 2.5 | Envolver MobileSheetLayout en ModalOverlay | mobile-sheet-layout.tsx + confirm-payment, custom-amount | 🟡 Medio | Medio — 2 usos, probar flujo de pago |

**Validación:**
- Cada modal debe verse idéntico antes y después (comparación visual).
- Probar cada formulario en desktop y mobile.
- Verificar que ningún modal aparezca fuera del viewport.

**Rollback:** Revertir por componente individual (no todo en un solo commit).

---

### Fase 3 — Estandarización (Riesgo Bajo, Consistencia)

**Objetivo:** Unificar z-index, backdrops, animaciones.

| # | Tarea | Esfuerzo | Riesgo |
|---|---|---|---|
| 3.1 | Migrar z-index bracket a tokens CSS | 🟢 Bajo | Bajo |
| 3.2 | Unificar backdrop opacity (12% → 18%) en bottom/side-nav | 🟢 Mínimo | Bajo |
| 3.3 | Unificar animaciones de ModalOverlay (200ms fade) | 🟢 Bajo | Bajo |
| 3.4 | Bajar z-index de MobileFullscreenForm de [9999] a [200] | 🟢 Mínimo | Bajo |
| 3.5 | Agregar createPortal a MobileFullscreenForm | 🟡 Medio | Bajo — contenido ya es fullscreen |
| 3.6 | Agregar role="dialog" + aria-modal a quick-menus | 🟢 Mínimo | Bajo |

**Validación:** TypeScript compile + auditoría visual en Chrome DevTools.

---

### Fase 4 — Limpieza y Accesibilidad (Riesgo Bajo, Polishing)

**Objetivo:** Eliminar dead code y cerrar brechas de accesibilidad.

| # | Tarea | Esfuerzo | Riesgo |
|---|---|---|---|
| 4.1 | Eliminar modal.tsx y su export del barrel | 🟢 Mínimo | Bajo — dead code |
| 4.2 | Agregar focus trapping a MobileSheetLayout | 🟡 Medio | Bajo |
| 4.3 | Agregar focus trapping a ModalOverlay (opcional, vía prop) | 🟢 Bajo | Bajo |
| 4.4 | Agregar aria-hidden="true" a backdrops faltantes | 🟢 Mínimo | Bajo |

**Validación:** Lighthouse audit + screen reader test.

---

## 12. Estrategia de Testing

### 12.1 Escenarios Manuales QA

| Escenario | Pasos | Expected Result |
|---|---|---|
| Apertura de modal centrado | Tap en botón que abre modal | Modal centrado, backdrop visible, scroll body bloqueado |
| Cierre por backdrop | Tap fuera del modal | Modal se cierra (excepto blocking modals) |
| Cierre por Escape | Presionar Escape en teclado | Modal se cierra |
| Bottom sheet drag | Arrastrar sheet hacia abajo | Sheet sigue al dedo (Vaul) o se cierra si supera threshold |
| Formulario en sheet | Scrollear dentro del sheet | Scroll interno funciona, sheet no se cierra |
| Modal dentro de MobilePageShell | Abrir cualquier modal desde una página con page-enter animation | Modal aparece centrado, no desplazado |
| Notch / Dynamic Island | Abrir modal en iPhone 14 Pro/15 Pro | Modal respeta safe areas |
| Teclado + modal | Abrir modal con input, focus en input | Modal no se reposiciona incorrectamente |
| Rotación | Abrir modal, rotar dispositivo | Modal se re-centra |
| Multiple modals | Abrir modal, luego otro encima | Stacking correcto (z-index, cierre secuencial) |

### 12.2 Pruebas Cross-Device

| Dispositivo | Viewport | Riesgo |
|---|---|---|
| iPhone SE (gen 3) | 375×667 | Bottom sheets pueden ocupar mucho espacio |
| iPhone 15 Pro Max | 430×932 | Estándar |
| iPad Mini (gen 6) | 744×1133 | Modales centrados deben tener max-width |
| Android Pixel 7 | 412×915 | Gesture navigation overlap |
| Galaxy Fold (inner) | 712×1536 | Foldable safe areas |

### 12.3 Pruebas de Regresión

Para cada fase, ejecutar:
1. `npx tsc --noEmit` — sin errores nuevos.
2. Auditoría visual de cada modal afectado (before/after screenshots).
3. Revisión manual de los 16 usos de BaseModalForm después de Fase 2.4.

### 12.4 Pruebas de Accesibilidad

1. Navegar por tabulación a través de cada modal.
2. Verificar que el foco no escape del modal abierto.
3. VoiceOver / TalkBack: verificar que se anuncie "dialog" y el título.
4. Verificar que el backdrop tenga `aria-hidden="true"`.
5. Verificar que Escape cierre el modal.

---

## 13. Métricas de Éxito

| Métrica | Objetivo | Cómo se Mide |
|---|---|---|
| Modales fuera del viewport | 0 | Auditoría visual manual + screenshots |
| Overlays detrás de navegación | 0 | Inspección visual en dispositivo físico |
| Adopción de portal en overlays | 100% | grep de createPortal + fixed inset-0 inline |
| Cumplimiento de z-index tokens | 100% | grep de valores bracket (z-[) |
| Consistencia de backdrop | 100% | grep de clases de backdrop |
| Scroll lock en overlays | 100% | grep de modal-open en useEffect + Radix/Vaul |
| role="dialog" + aria-modal | 100% | grep en componentes overlay |
| Focus trapping en modales | 100% | grep de useModalA11y con trapFocus: true |
| Duraciones de animación estándar | 100% | grep de duration en clases de animación |
| Sin dead code (modal.tsx) | Archivo eliminado | ls components/ui/modal.tsx → no existe |

---

## 14. Riesgos y Mitigación

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Portalizar BaseModalForm rompe 16 formularios | Alta | Crítico | Probar CADA formulario individualmente. Hacer Fase 2.4 al final de Fase 2, con QA dedicado. |
| ModalOverlay cambia comportamiento visual de overlays existentes | Media | Alto | Congelar la apariencia de ModalOverlay antes de empezar Fase 2. Comparar screenshots antes/después. |
| budget-form-sheet con dismissible={false} pierde gesto de cierre | Baja | Medio | El formulario tiene botón Cancelar explícito. Usuario no pierde funcionalidad. |
| Z-index tokens causan conflictos con valores bracket existentes | Media | Bajo | Los tokens CSS coexisten con bracket. Migrar gradualmente. |
| createPortal en MobileFullscreenForm rompe medición de viewport (100dvh) | Baja | Medio | El portal mantiene `fixed inset-0`, no hay cambio en el layout del contenido. |
| Regresión en flujo de pago (ConfirmPaymentSheet / CustomAmountSheet) | Media | Alto | QA manual de flujo completo: seleccionar monto → confirmar → swipe → receipt. |

### 14.1 Estrategia de Rollback por Fase

| Fase | Rollback |
|---|---|
| Fase 1 | `git revert <commit>` por tarea. Sin dependencias. |
| Fase 2 | `git revert <commit>` por componente. Si 2.4 (BaseModalForm) falla, los demás commits pueden mantenerse. |
| Fase 3 | `git revert <commit>` por tarea. Ninguna dependencia entre tareas de Fase 3. |
| Fase 4 | `git revert <commit>`. Si se elimina modal.tsx y algo dependía, restaurar archivo. |

---

*Fin del plan de migración. Pendiente de aprobación para comenzar implementación.*
