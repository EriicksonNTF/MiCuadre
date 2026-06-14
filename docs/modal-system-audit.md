# Auditoría del Sistema Modal — MiCuadre Mobile

> **Fecha:** 2026-06-14
> **Alcance:** Toda la aplicación (components/, app/)
> **Propósito:** Identificar, documentar y evaluar cada implementación modal para asegurar consistencia, visibilidad y correcto funcionamiento.

---

## 1. Resumen Ejecutivo

Se auditaron **38 superficies modales** en toda la aplicación, distribuidas en:

| Categoría | Cantidad |
|---|---|
| Primitivas Radix (Dialog, AlertDialog, Popover, Tooltip, etc.) | 11 |
| Primitivas Vaul (Drawer) | 1 |
| Overlay/Scrim/Backdrop custom | 16 |
| Formularios modales (BaseModalForm) | 16 usos |
| Sheets modales (MobileSheetLayout) | 2 usos |
| Fullscreen forms (MobileFullscreenForm) | 16 usos (vía BaseModalForm) |
| Receipts portaleados | 1 |
| Floating widgets (CoachIA) | 1 |

**Hallazgos por severidad:**

| Severidad | Cantidad |
|---|---|
| 🔴 Critical | 1 |
| 🟠 High | 3 |
| 🟡 Medium | 4 |
| 🔵 Low | 3 |
| ℹ️ Informational | 5 |

**Problema principal:** 6 implementaciones custom renderizan overlays **inline** sin `createPortal`, lo que las hace vulnerables al CSS containing block creado por `transform: translateY(0) scale(1)` en la animación `page-enter` de `MobilePageShell`. Cualquier modal dentro de `MobilePageShell` puede posicionarse incorrectamente en dispositivos con navegación gestual o después de animaciones.

---

## 2. Inventario de Modales

### 2.1 Primitivas Compartidas (components/ui/)

| # | Componente | Archivo | Biblioteca | Portal | z-index | Scroll Lock |
|---|---|---|---|---|---|---|
| 1 | AlertDialog | alert-dialog.tsx | Radix | ✅ Radix Portal | z-50 | ✅ Radix |
| 2 | Dialog | dialog.tsx | Radix | ✅ Radix Portal | z-50 | ✅ Radix |
| 3 | Sheet | sheet.tsx | Radix (Dialog) | ✅ Radix Portal | z-50 | ✅ Radix |
| 4 | Drawer (Vaul) | drawer.tsx | Vaul | ✅ Vaul Portal | z-50 | ✅ Vaul |
| 5 | Popover | popover.tsx | Radix | ✅ Radix Portal | z-50 | ❌ No aplica |
| 6 | DropdownMenu | dropdown-menu.tsx | Radix | ✅ Radix Portal | z-50 | ❌ No aplica |
| 7 | ContextMenu | context-menu.tsx | Radix | ✅ Radix Portal | z-50 | ❌ No aplica |
| 8 | Tooltip | tooltip.tsx | Radix | ✅ Radix Portal | z-50 | ❌ No aplica |
| 9 | HoverCard | hover-card.tsx | Radix | ✅ Radix Portal | z-50 | ❌ No aplica |
| 10 | CommandDialog | command.tsx | cmdk + Radix | ✅ vía Dialog | z-50 | ✅ vía Dialog |

### 2.2 Implementaciones Custom (components/ui/)

| # | Componente | Archivo | Portal | z-index | Scroll Lock |
|---|---|---|---|---|---|
| 11 | ModalOverlay | modal-overlay.tsx | ✅ createPortal(body) | z-50 | ✅ modal-open |
| 12 | BaseModalForm | base-modal-form.tsx | ❌ Inline fixed | z-[90]/z-[100] | ✅ modal-open |
| 13 | MobileSheetLayout | mobile-sheet-layout.tsx | ❌ Inline fixed | z-50 | ✅ modal-open + mobile-form-open |
| 14 | MobileFullscreenForm | mobile-fullscreen-form.tsx | ❌ Inline fixed | z-[9999] | ✅ modal-open + mobile-form-open |
| 15 | Modal | modal.tsx | ❌ Inline fixed | z-50 | ❌ No |
| 16 | QuickModal | modal.tsx | ❌ Inline fixed | z-50 | ❌ No |

> **Nota:** `Modal` y `QuickModal` están definidos y exportados pero **no son usados** por ningún consumidor (dead code).

### 2.3 Vaul Drawers en Funcionalidades

| # | Archivo | Línea | dismissible | Scroll Content | Propósito |
|---|---|---|---|---|---|
| 17 | debt-form-sheet.tsx | 126 | ✅ **false** | ✅ overflow-y-auto | Crear/editar deuda |
| 18 | budget-form-sheet.tsx | 106 | ❌ true (default) | ❌ No | Crear/editar presupuesto |
| 19 | pay-debt-sheet.tsx | 104 | ❌ true (default) | ❌ No | Pagar deuda |
| 20 | quick-pay-card-sheet.tsx | 93 | ❌ true (default) | ❌ No | Pago rápido tarjeta |
| 21 | plan-selector-sheet.tsx | 96 | ❌ true (default) | ✅ overflow-y-auto | Selector de plan |

### 2.4 BaseModalForm — Usos en Funcionalidades (16 usos)

| # | Archivo | Línea | Título | Propósito |
|---|---|---|---|---|
| 22 | history-screen.tsx | 643 | "Editar transacción" | Editar transacción |
| 23 | history-screen.tsx | 662 | "Eliminar transacción" | Confirmar eliminación |
| 24 | accounts-screen.tsx | 606 | "Transferir dinero" | Transferencia entre cuentas |
| 25 | accounts-screen.tsx | 643 | "Nueva cuenta" | Crear cuenta |
| 26 | account-detail.tsx | 982 | "Editar transacción" | Editar transacción |
| 27 | account-detail.tsx | 1003 | "Eliminar transacción" | Confirmar eliminación |
| 28 | account-detail.tsx | 1019 | "Pagar tarjeta" | Pago de tarjeta |
| 29 | account-detail.tsx | 1174 | "Editar cuenta" | Editar cuenta |
| 30 | settings-screen.tsx | 503 | "Seleccionar tema" | Selector de tema |
| 31 | settings-screen.tsx | 533 | "Moneda principal" | Selector de moneda |
| 32 | settings-screen.tsx | 560 | "Idioma" | Selector de idioma |
| 33 | settings-screen.tsx | 589 | (sin título) | Confirmar cierre sesión |
| 34 | settings-screen.tsx | 615 | "Eliminar cuenta" | Eliminar cuenta de usuario |
| 35 | subscriptions-screen.tsx | 171 | "Nueva suscripción" | Crear suscripción |
| 36 | categories-screen.tsx | 148 | "Nueva categoría" | Crear/editar categoría |
| 37 | app/send/page.tsx | 470 | "Nuevo beneficiario" | Agregar beneficiario |

### 2.5 MobileSheetLayout — Usos en Funcionalidades (2 usos)

| # | Archivo | Línea | Propósito |
|---|---|---|---|
| 38 | confirm-payment-sheet.tsx | 25 | Confirmar pago con swipe |
| 39 | custom-amount-sheet.tsx | 25 | Ingresar monto personalizado |

---

## 3. Inventario de Overlays/Scrims/Backdrops

### 3.1 Overlays Fixed Inline (sin portal)

| # | Archivo | Línea | z-index | Backdrop onClick | Bloquea scroll body |
|---|---|---|---|---|---|
| O1 | bottom-nav.tsx (backdrop) | 64 | z-40 | ✅ setShowQuickMenu(false) | ❌ No |
| O2 | side-nav.tsx (backdrop) | 171 | z-50 | ✅ setShowQuickMenu(false) | ❌ No |
| O3 | financial-calendar-tab.tsx | 110 | z-[60] | ❌ No (cierra vía botón) | ❌ No |
| O4 | passkey-lock-gate.tsx | 60 | z-50 | ❌ No (debe desbloquear) | ✅ modal-open |
| O5 | base-modal-form.tsx (Desktop backdrop) | 72 | z-[90] | ✅ onClose | ✅ modal-open |
| O6 | mobile-sheet-layout.tsx | 25 | z-50 | ❌ No | ✅ modal-open |
| O7 | mobile-fullscreen-form.tsx | 35 | z-[9999] | ❌ No (es el contenido) | ✅ modal-open |
| O8 | modal.tsx (Modal) | 36 | z-50 | ✅ onClose | ❌ No |
| O9 | modal.tsx (QuickModal) | 105 | z-50 | ✅ onClose | ❌ No |

### 3.2 Overlays Portaleados

| # | Archivo | Línea | z-index | Destino | Backdrop onClick | Bloquea scroll body |
|---|---|---|---|---|---|---|
| O10 | movement-receipt.tsx (backdrop) | 60 | z-[90] | document.body | ✅ onClose | ✅ modal-open |
| O11 | movement-receipt.tsx (contenido) | 61 | z-[100] | document.body | ❌ No (card) | ✅ modal-open |
| O12 | modal-overlay.tsx | 37 | z-50 | document.body | ✅ (condicional) | ✅ modal-open |

### 3.3 Overlays vía Biblioteca (Radix/Vaul)

| # | Componente | z-index | Portal | Backdrop onClick |
|---|---|---|---|---|
| O13 | AlertDialogOverlay | z-50 | ✅ Radix | ✅ Radix |
| O14 | DialogOverlay | z-50 | ✅ Radix | ✅ Radix |
| O15 | SheetOverlay | z-50 | ✅ Radix (Dialog) | ✅ Radix |
| O16 | DrawerOverlay | z-50 | ✅ Vaul | ✅ Vaul |

---

## 4. Detalles de Implementación Actual

### 4.1 Mapa de z-index

```
z-[9999]  → MobileFullscreenForm, SmartToast container
z-[100]   → BaseModalForm content (desktop), MovementReceipt content, ToastViewport (Radix)
z-[90]    → BaseModalForm backdrop, MovementReceipt backdrop
z-[60]    → FinancialCalendarTab overlay, CoachIAWidget
z-50      → RADIX/VAUL STANDARD: AlertDialog, Dialog, Sheet, Drawer,
            Popover, DropdownMenu, ContextMenu, Tooltip, HoverCard,
            Menubar, CommandDialog, Sidebar (mobile), ModalOverlay,
            Modal, QuickModal, MobileSheetLayout, PasskeyLockGate,
            SideNav scrim
z-40      → BottomNav quick-menu backdrop
```

### 4.2 Patrón de Backdrop

La mayoría usa el patrón semántico:
```css
bg-foreground/18 backdrop-blur-[6px] dark:bg-black/45
```

Excepciones:
- **BottomNav/SideNav scrims:** `bg-foreground/12 backdrop-blur-[6px] dark:bg-black/35` (opacidad 12% vs 18%)
- **MobileFullscreenForm:** `bg-background` (sin backdrop, es fullscreen)
- **passkey-lock-gate (antes):** `bg-background/95` (ya corregido a estándar)

### 4.3 Gestión de Scroll Body

| Método | Componentes |
|---|---|
| `modal-open` class | ModalOverlay, BaseModalForm, MobileSheetLayout, MobileFullscreenForm, MovementReceipt, PasskeyLockGate |
| `modal-open` + `mobile-form-open` | MobileSheetLayout, MobileFullscreenForm |
| Radix/Vaul interno | AlertDialog, Dialog, Sheet, Drawer |
| ❌ Sin bloqueo | modal.tsx, QuickModal, bottom-nav, side-nav, financial-calendar-tab |

---

## 5. Problemas de Posicionamiento Detectados

### 🔴 CRITICAL: Inline Fixed vulnerable a CSS Containing Block

**Archivos afectados:** BaseModalForm, MobileSheetLayout, MobileFullscreenForm, modal.tsx, bottom-nav.tsx, side-nav.tsx, financial-calendar-tab.tsx

**Causa raíz:** `MobilePageShell` aplica una animación `page-enter` con:
```css
@keyframes page-enter {
  from { transform: translateY(8px) scale(0.98); opacity: 0; }
  to   { transform: translateY(0) scale(1); opacity: 1; }
}
.mobile-page { animation: page-enter 0.35s ease both; }
```

`animation-fill-mode: both` mantiene el `transform` después de la animación, creando un **CSS containing block**. Cualquier elemento con `position: fixed` dentro de `.mobile-page` se posiciona relativo al contenedor transformado, no al viewport. Los componentes que usan `createPortal` (ModalOverlay, MovementReceipt, Radix/Vaul) no tienen este problema porque renderizan fuera del árbol.

**Impacto:** En dispositivos con navegación gestual o cuando hay scroll excesivo, los modales inline pueden aparecer desplazados, cortados, o parcialmente fuera del viewport.

### 🟠 HIGH: Z-index Fragmentado

**Problema:** No hay una jerarquía de z-index centralizada. Cada implementación usa su propio valor:
- `z-[60]` colisiona entre FinancialCalendarTab y CoachIAWidget
- `z-[90]`/`z-[100]` en BaseModalForm vs `z-50` en Radix/Vaul — si un Radix Dialog se abre encima de un BaseModalForm, aparecerá detrás
- `z-[9999]` en MobileFullscreenForm y SmartToast significa que las toasts aparecen detrás de un fullscreen form

### 🟠 HIGH: BottomNav Quick Menu — Sin Bloqueo de Scroll

**Archivo:** bottom-nav.tsx

El backdrop del menú rápido (`z-40`) no bloquea el scroll del body. Si el usuario abre el menú y hace scroll, el contenido detrás se mueve.

### 🟡 MEDIUM: FinancialCalendarTab Overlay — Sin Bloqueo de Scroll

**Archivo:** financial-calendar-tab.tsx (línea 110)

El overlay de eventos del día no bloquea el scroll body. Tampoco usa portal; es inline vulnerable al containing block.

### 🟡 MEDIUM: modal.tsx — Dead Code Sin Scroll Lock

**Archivo:** modal.tsx

`Modal` y `QuickModal` están definidos y exportados pero sin consumidores. Sin embargo, si alguien los usara, no bloquean el scroll body y son inline sin portal.

---

## 6. Problemas de Visibilidad Detectados

### 🔴 CRITICAL: Budget Form Sheet — `dismissible` por defecto

**Archivo:** budget-form-sheet.tsx (línea 106)

`dismissible` no está establecido (defaults a `true` en Vaul). Si el usuario está scrolleando dentro del formulario y toca cerca de `scrollTop === 0`, el drawer se cierra accidentalmente. Además, no tiene `overflow-y-auto` — si el contenido excede `max-h-[80vh]` (nativo de DrawerContent), el contenido se recorta sin scroll.

### 🟠 HIGH: Inconsistencia en Backdrops

**Archivos:** bottom-nav.tsx, side-nav.tsx

Usan `bg-foreground/12` (12% opacidad) vs el estándar `bg-foreground/18` (18%) de los demás componentes. Diferencia sutil pero inconsistente: los scrims de navegación son más transparentes que los de modales.

### 🟡 MEDIUM: Altura Máxima Inconsistente en Sheets

| Componente | max-height |
|---|---|
| MobileSheetLayout | `max-h-[88vh]` |
| BaseModalForm (desktop) | `max-h-[85dvh]` |
| Drawer (Vaul nativo) | `max-h-[80vh]` (no configurado) |
| PlanSelectorSheet | `max-h-[92dvh]` |

No hay un estándar unificado. `88vh` vs `85dvh` vs `80vh` vs `92dvh` — pequeñas diferencias que se notan en dispositivos específicos.

---

## 7. Problemas de Animación Detectados

### 🟡 MEDIUM: Duraciones de Animación Inconsistentes

| Componente | Duración | Easing |
|---|---|---|
| Modal, QuickModal | 500ms | ease-sheet-ios |
| BaseModalForm (desktop) | 500ms | ease-sheet-ios |
| MobileSheetLayout | 500ms | ease-sheet-ios |
| MobileFullscreenForm | 500ms | ease-sheet-ios |
| Radix Dialog/AlertDialog | 200ms | ease (default) |
| MovementReceipt backdrop | 200ms | ease (default) |
| ModalOverlay | 200ms | ease (default) |
| Drawer (Vaul) | gestual | Vaul spring |

**Problema:** Los modales custom usan 500ms con `ease-sheet-ios`, mientras que los Radix estándar usan 200ms. Diferencia notable pero no crítica. Sin embargo, los usuarios perciben que los modales Radix son más rápidos/responsivos.

### 🔵 LOW: ModalOverlay no tiene animación de slide

ModalOverlay solo tiene fade-in. Los demás modales custom (BaseModalForm, MobileSheetLayout) tienen slide-in-from-bottom.

---

## 8. Hallazgos de Accesibilidad

### 🔵 LOW: Falta `aria-modal` en overlays inline sin portal

**Archivos:** bottom-nav.tsx, side-nav.tsx, financial-calendar-tab.tsx

Estos overlays no tienen `role="dialog"` ni `aria-modal="true"`. Los lectores de pantalla no identificarán estos paneles como modales.

### 🔵 LOW: focus trapping implementado solo en algunos

- BaseModalForm (desktop): ✅ `useModalA11y({ trapFocus: true })`
- BaseModalForm/Fullscreen (mobile): ❌ `trapFocus: false`
- MobileSheetLayout: ❌ Sin focus trapping
- ModalOverlay: ❌ Sin focus trapping

Radix y Vaul manejan focus trapping internamente ✅

### ℹ️: Radix primitives (AlertDialog, Dialog, Sheet, Drawer) manejan todo correctamente — roles ARIA, focus trapping, Escape key, inert background.

---

## 9. Análisis de Causa Raíz

### 9.1 ¿Por qué los modales aparecen detrás de la navegación?

**Causa:** Los componentes que NO usan `createPortal` se renderizan dentro del árbol DOM de `MobilePageShell`. La animación `page-enter` con `transform` en `.mobile-page` crea un nuevo stacking context. Cualquier `position: fixed` dentro se posiciona relativo al transform, no al viewport.

Si un modal inline tiene `bottom-0`, se posiciona relativo al contenedor transformado, que puede tener offset debido a la animación. En dispositivos con notchs o barras de navegación gestual, este offset puede ser suficiente para que el modal aparezca parcialmente detrás de la UI persistente.

### 9.2 ¿Por qué los z-index son inconsistentes?

**Causa histórica:** Cada implementación custom fue creada en momentos diferentes sin una convención centralizada. `BaseModalForm` usa `z-[90]`/`z-[100]` porque se creó antes de que existiera `ModalOverlay`. `MobileFullscreenForm` usa `z-[9999]` para asegurarse de estar sobre todo lo demás. No hubo un `design token` de z-index.

### 9.3 ¿Por qué falta scroll blocking en algunos overlays?

**Causa:** Los overlays de navegación (bottom-nav menú, side-nav) y el calendario se implementaron como "livianos" — el desarrollador asumió que al ser de corta duración, no necesitaban bloquear scroll. Sin embargo, en iOS, la inercia del scroll puede continuar incluso después de abrir el overlay, causando que el contenido se desplace bajo el modal.

---

## 10. Evaluación de Severidad

### 🔴 Critical (1)

| ID | Hallazgo | Archivo | Impacto |
|---|---|---|---|
| C1 | Inline fixed vulnerable a CSS containing block de MobilePageShell | BaseModalForm, MobileSheetLayout, MobileFullscreenForm, modal.tsx, bottom-nav, side-nav, financial-calendar-tab | Modales pueden aparecer fuera del viewport o detrás de navegación. 6 implementaciones afectadas. |

### 🟠 High (3)

| ID | Hallazgo | Archivo | Impacto |
|---|---|---|---|
| H1 | Z-index fragmentado — colisiones potenciales | Múltiples | Overlays pueden renderizarse en orden incorrecto |
| H2 | Budget form sheet sin `dismissible={false}` y sin scroll | budget-form-sheet.tsx | Cierre accidental al hacer scroll |
| H3 | BottomNav/SideNav scrim sin bloqueo de scroll | bottom-nav.tsx, side-nav.tsx | Scroll fantasma en iOS |

### 🟡 Medium (4)

| ID | Hallazgo | Archivo | Impacto |
|---|---|---|---|
| M1 | Calendar overlay sin bloqueo de scroll ni portal | financial-calendar-tab.tsx | Scroll fantasma + posicionamiento frágil |
| M2 | Backdrop opacidad inconsistente (12% vs 18%) | bottom-nav.tsx, side-nav.tsx | Inconsistencia visual leve |
| M3 | Altura máxima de sheets no estandarizada | Múltiples | Comportamiento visual inconsistente |
| M4 | Duraciones de animación inconsistentes (200ms vs 500ms) | Múltiples | Percepción de velocidad diferente |

### 🔵 Low (3)

| ID | Hallazgo | Archivo | Impacto |
|---|---|---|---|
| L1 | Falta role="dialog"/aria-modal en overlays inline | bottom-nav, side-nav, calendar-tab | Accesibilidad reducida |
| L2 | Focus trapping ausente en MobileSheetLayout y ModalOverlay | mobile-sheet-layout.tsx, modal-overlay.tsx | Usuarios de teclado pueden tabular fuera del modal |
| L3 | modal.tsx dead code sin scroll lock | modal.tsx | Código huérfano, riesgo de reuso incorrecto |

### ℹ️ Informational (5)

| ID | Hallazgo | Archivo |
|---|---|---|
| I1 | MovementReceipt usa createPortal + modal-open ✅ | movement-receipt.tsx |
| I2 | ModalOverlay usa createPortal + modal-open ✅ | modal-overlay.tsx |
| I3 | Radix/Vaul primitives manejan portal, scroll, ARIA correctamente ✅ | Múltiples |
| I4 | AlertDialog reemplazó correctamente ModalOverlay en delete confirmations | accounts-screen, account-detail |
| I5 | PlanSelectorSheet usa Drawer con max-h-[92dvh] (mayor que estándar) — intencional para mostrar planes | plan-selector-sheet.tsx |

---

## 11. Recomendaciones para Arquitectura Estandarizada

### 11.1 Principio Rector

**Todo overlay/modal debe renderizarse vía portal a `document.body`.**

Esto elimina el problema del CSS containing block de `MobilePageShell` de raíz.

### 11.2 Arquitectura Propuesta

```
┌──────────────────────────────────────────────────────────┐
│                    TOASTS (z-[9999])                      │
│  SmartToastContainer ─── portal a body                   │
├──────────────────────────────────────────────────────────┤
│              FULLSCREEN (z-[200])                          │
│  MobileFullscreenForm ─── portal a body                   │
├──────────────────────────────────────────────────────────┤
│              OVERLAYS PRINCIPALES (z-50)                   │
│  ModalOverlay ─── portal a body                           │
│  MovementReceipt ─── portal a body                        │
│  AlertDialog ─── portal vía Radix                         │
│  Dialog ─── portal vía Radix                              │
│  Sheet ─── portal vía Radix                               │
│  Drawer ─── portal vía Vaul                               │
│  BaseModalForm ─── portal a body (desktop mode)           │
│  MobileSheetLayout ─── portal a body                      │
├──────────────────────────────────────────────────────────┤
│              OVERLAYS DE NAVEGACIÓN (z-40)                 │
│  BottomNav quick-menu ─── portal a body                   │
│  SideNav quick-menu ─── portal a body                     │
│  FinancialCalendarTab ─── portal a body                   │
├──────────────────────────────────────────────────────────┤
│              WIDGETS FLOTANTES (z-[60])                    │
│  CoachIAWidget (no es overlay, no necesita cambio)        │
└──────────────────────────────────────────────────────────┘
```

### 11.3 Estándar de z-index (Propuesto)

| z-index | Uso |
|---|---|
| z-40 | Overlays de navegación secundaria (quick-menus) |
| z-50 | **ESTÁNDAR**: Todos los modales, dialogs, sheets, drawers, popovers |
| z-[60] | Widgets flotantes (CoachIA) |
| z-[100] | Backdrop de BaseModalForm (contenido en z-50 también, no necesita más) |
| z-[200] | Fullscreen forms |
| z-[9999] | Toasts (siempre visibles) |

### 11.4 Estándar de Backdrop (Propuesto)

```css
bg-foreground/18 backdrop-blur-[6px] dark:bg-black/45
```

Sin excepciones. Todos los scrims deben usar esta misma clase.

### 11.5 Estándar de Animación (Propuesto)

| Tipo | Duración | Easing | Componentes |
|---|---|---|---|
| Fade + scale (centrados) | 200ms | ease | AlertDialog, Dialog, ModalOverlay |
| Slide from bottom (sheets) | gestual (Vaul) o 300ms ease | ease-sheet-ios | Drawer, MobileSheetLayout, BaseModalForm |
| Fullscreen form | 300ms | ease-sheet-ios | MobileFullscreenForm |

### 11.6 Estándar de Scroll Lock

Toda implementación debe activar `modal-open` en `<body>` mientras esté abierta. Los Radix/Vaul lo manejan internamente. Para componentes custom, usar el mismo patrón de `useEffect` que ya usa `ModalOverlay`.

---

## 12. Plan de Remediación Priorizado

### Fase 1 — Correcciones Críticas (Prioridad Máxima)

| # | Tarea | Esfuerzo | Dependencias |
|---|---|---|---|
| 1.1 | Migrar BaseModalForm desktop mode a `createPortal(document.body)` para eliminar vulnerabilidad containing block | Media | — |
| 1.2 | Migrar MobileSheetLayout a `createPortal(document.body)` | Baja | — |
| 1.3 | Agregar `dismissible={false}` + scroll container a budget-form-sheet.tsx | Baja | — |
| 1.4 | Agregar `overflow-y-auto` explícito en budget-form-sheet.tsx | Baja | — |

### Fase 2 — Correcciones High

| # | Tarea | Esfuerzo |
|---|---|---|
| 2.1 | Normalizar z-index: mover BaseModalForm de z-[90/100] a z-50 (usar ModalOverlay como wrapper) | Media |
| 2.2 | Agregar scroll lock a bottom-nav.tsx y side-nav.tsx quick-menus | Baja |
| 2.3 | Unificar backdrop opacidad: cambiar bottom-nav y side-nav de 12% a 18% | Mínimo |

### Fase 3 — Correcciones Medium

| # | Tarea | Esfuerzo |
|---|---|---|
| 3.1 | Migrar financial-calendar-tab overlay a ModalOverlay (portal + scroll lock) | Media |
| 3.2 | Unificar max-height de sheets (estandarizar en 85dvh) | Baja |
| 3.3 | Unificar duraciones de animación (200ms centrados, 300ms sheets) | Baja |

### Fase 4 — Correcciones Low + Housekeeping

| # | Tarea | Esfuerzo |
|---|---|---|
| 4.1 | Agregar role="dialog" + aria-modal a quick-menus y calendar overlay | Baja |
| 4.2 | Agregar focus trapping a MobileSheetLayout y ModalOverlay | Media |
| 4.3 | Eliminar dead code (modal.tsx) o migrarlo a estándar | Baja |

---

## Apéndice A: Diagrama de Stacking Actual

```
z-[9999]  ┌─────────────────────────────────────┐
          │  MobileFullscreenForm               │
          │  SmartToast container                │
          └─────────────────────────────────────┘
z-[100]   ┌─────────────────────────────────────┐
          │  BaseModalForm content (desktop)     │
          │  MovementReceipt content              │
          │  ToastViewport (Radix)               │
          └─────────────────────────────────────┘
z-[90]    ┌─────────────────────────────────────┐
          │  BaseModalForm backdrop              │
          │  MovementReceipt backdrop            │
          └─────────────────────────────────────┘
z-[60]    ┌─────────────────────────────────────┐
          │  FinancialCalendarTab overlay        │
          │  CoachIAWidget (floating, no modal)  │
          └─────────────────────────────────────┘
z-50      ┌─────────────────────────────────────┐
          │  AlertDialog, Dialog, Sheet, Drawer  │
          │  ModalOverlay, MobileSheetLayout     │
          │  Popover, Tooltip, DropdownMenu      │
          │  PasskeyLockGate, SideNav            │
          └─────────────────────────────────────┘
z-40      ┌─────────────────────────────────────┐
          │  BottomNav quick-menu backdrop       │
          └─────────────────────────────────────┘
z-10      ┌─────────────────────────────────────┐
          │  Sidebar (desktop)                   │
          └─────────────────────────────────────┘
```

## Apéndice B: Resumen de Overlays que NO usan Portal

| Componente | Archivo | Solución Propuesta |
|---|---|---|
| BaseModalForm (desktop) | base-modal-form.tsx | Envolver en ModalOverlay o agregar createPortal |
| MobileSheetLayout | mobile-sheet-layout.tsx | Envolver en ModalOverlay o agregar createPortal |
| MobileFullscreenForm | mobile-fullscreen-form.tsx | z-[200] es seguro (suficientemente alto), pero idealmente portal |
| bottom-nav scrim | bottom-nav.tsx | Usar ModalOverlay para backdrop |
| side-nav scrim | side-nav.tsx | Usar ModalOverlay para backdrop |
| financial-calendar-tab | financial-calendar-tab.tsx | Usar ModalOverlay o Drawer de Vaul |
| passkey-lock-gate | passkey-lock-gate.tsx | Ya no es vulnerable (no está dentro de MobilePageShell) |
| modal.tsx (dead code) | modal.tsx | Eliminar o migrar a ModalOverlay |

---

*Fin del reporte de auditoría.*
