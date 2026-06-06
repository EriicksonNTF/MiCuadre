# MiCuadre Design Overhaul - Batch 1 y Batch 2

Fecha: 2026-06-03

## Alcance

Este pase cubre solo Batch 1 y Batch 2:

- Batch 1: auditoria visual mobile/iOS/PWA con revision de codigo y capturas existentes.
- Batch 2: base de diseno reutilizable para layout, cards, formularios, sheets, estados y accesibilidad.

No se corrigieron modulos completos. No se hicieron cambios destructivos ni mutaciones de datos.

## Evidencia visual revisada

Capturas organizadas para este pase:

- `screenshots/design-overhaul/dashboard/medium__dashboard__dense-but-usable.png`
- `screenshots/design-overhaul/forms/medium__expense__sticky-cta-visible.png`
- `screenshots/design-overhaul/payments/high__pay-card__initial-screen-too-empty.png`
- `screenshots/design-overhaul/planning/medium__planning__plan-sheet-crowded.png`
- `screenshots/design-overhaul/notifications/medium__notifications__cards-repeat-dense.png`
- `screenshots/design-overhaul/reports/medium__reports__charts-low-signal.png`
- `screenshots/design-overhaul/landing/ok__landing__mobile-hero.png`

Tambien se reviso la carpeta previa `screenshots/audit/`, que ya contiene evidencia por modulo y logs de auditoria.

## Nota sobre tooling de screenshots

El script `scripts/screenshot.mjs` fallaba en este entorno al esperar `networkidle` en `/auth/login`. Se agrego soporte para:

- `--wait=<estado>`
- `SCREENSHOT_WAIT_UNTIL`

El comportamiento por defecto sigue siendo `networkidle`, pero ahora Batch 1 puede usar `--wait=domcontentloaded` cuando el servidor mantiene conexiones abiertas.

En esta sesion, Playwright tambien requirio ejecucion fuera del sandbox porque la lectura de `node_modules/.pnpm/playwright...` fallo con `EPERM`.

## Problemas visuales encontrados

### Alta prioridad

- Pay card empieza con mucho espacio muerto cuando solo muestra tarjetas elegibles. La pantalla se siente incompleta y empuja decisiones importantes fuera del contexto.
- Hay mojibake visible en codigo y textos (`PlanificaciÃ³n`, `prÃ³ximo`, `dÃ­as`, `suscripciÃ³n`). Esto impacta confianza, calidad percibida y consistencia de idioma.
- Algunos flujos usan `BaseModalForm`, otros `MobileSheetLayout` y otros layouts manuales. El resultado es parecido, pero no completamente uniforme para formularios largos.
- El servidor dev/captura puede quedarse esperando indefinidamente si el script usa `networkidle`, lo que dificulta QA repetible.

### Media prioridad

- Dashboard mobile esta funcional, pero mezcla cards grandes, listas largas, alertas e insights en una sola columna muy densa.
- Reportes muestra graficas con poco valor visual cuando hay pocos datos; se ve mucho espacio en blanco dentro de cards.
- Notificaciones repite cards con estructura correcta, pero la densidad y los chips superiores pueden sentirse apretados en pantallas pequenas.
- Planning Pro sheet concentra mucha informacion en una sola vista; requiere revisar jerarquia y altura de acciones en Batch 5.

### Baja prioridad

- Landing mobile tiene una primera pantalla fuerte y clara; conviene revisar secciones posteriores en Batch 6.
- El CTA sticky de gasto existe y se mantiene visible; hay que extender ese patron a formularios equivalentes antes de tocar contenido especifico.

## Problemas repetidos por categoria

### Layout y spacing

- Uso desigual de `mobile-page`, `pb-nav-safe`, `px-6`, `px-5` y wrappers manuales.
- Cards con radios y padding similares pero no siempre iguales.
- Secciones con densidad alta cuando combinan metricas, acciones y listas largas.

### Formularios y sheets

- El patron correcto existe: header fijo, cuerpo scrolleable y footer visible.
- La migracion aun no es total: algunos formularios usan wrappers manuales o variantes distintas.
- El bottom nav se oculta cuando `mobile-form-open` esta activo, lo cual es correcto y debe mantenerse.

### Movimiento

- Hay tokens de easing iOS y `prefers-reduced-motion`.
- Falta verificar que todos los nuevos patrones compartan las mismas duraciones y que los forms no introduzcan saltos al abrir/cerrar.

### Accesibilidad

- Se detecto oportunidad fundacional en dialogs/sheets: deben declarar `role="dialog"`, `aria-modal` y titulo asociado.
- Los elementos con footer sticky necesitan `scroll-margin-bottom` para que el foco no quede cubierto.
- Icon buttons de cierre deben tener nombre accesible consistente.

### Texto e idioma

- El mojibake sigue siendo el problema de copy mas importante.
- Hay frases en ingles dentro de movimientos o categorias del test data, pero el foco de Batch 2 es no corregir data real.

## Base de diseno creada o ajustada

Se agrego `components/ui/mobile-foundation.tsx` con componentes reutilizables:

- `MobilePageShell`: wrapper mobile con scroll, safe area y `mobile-page`.
- `MobileCard`: card mobile basada en el token visual existente.
- `MobileSectionHeader`: encabezado compacto con eyebrow, titulo, descripcion y accion.
- `StickyFormFooter`: footer sticky con safe-area para acciones primarias.
- `IconBadge`: contenedor de icono consistente.
- `FinancialAmount`: bloque para montos grandes con line-height y wrapping estable.
- `EmptyState`: estado vacio mobile.
- `LoadingState`: estado de carga con `role="status"` y `aria-live`.
- `AlertCard`: alerta compacta para informacion financiera o avisos.

Tambien se reforzaron fundamentos existentes:

- `app/globals.css`: `:focus-visible` ahora usa `scroll-margin-top` y `scroll-margin-bottom`.
- `components/ui/base-modal-form.tsx`: boton de cierre desktop con `aria-label`.
- `components/ui/mobile-sheet-layout.tsx`: bottom sheet con `role="dialog"`, `aria-modal` y `aria-labelledby`.
- `components/ui/mobile-fullscreen-form.tsx`: fullscreen form mobile con `role="dialog"`, `aria-modal` y `aria-labelledby`.

## Estandar recomendado para Batch 3

Antes de corregir modulos completos, migrar cada pantalla problematica a este orden:

1. Wrapper de pagina: `MobilePageShell` o clase `mobile-page` existente.
2. Secciones repetidas: `MobileSectionHeader`.
3. Cards repetidas: `MobileCard` o `Card` existente, pero no mezclar estilos sin razon.
4. Formularios largos: `BaseModalForm` o `MobileFullscreenForm` con footer fuera del scroll.
5. Bottom sheets de confirmacion: `MobileSheetLayout`.
6. Estados vacios/carga/error: componentes fundacionales.

## Prioridades recomendadas para Batch 3

1. Pay card: reducir pantalla vacia inicial y mejorar contexto de tarjetas.
2. Edit/create transaction: confirmar que todos los CTAs quedan visibles con teclado y scroll.
3. Debt/subscription forms: migrar al mismo patron de footer fijo.
4. Send/transfer: revisar confirmacion, receipt y feedback visual.
5. Mojibake visible: hacer pase de encoding/copy antes de afirmar pulido final.

## Batch 3 - Progreso aplicado

Fecha: 2026-06-03

Cambios realizados:

- `app/pay/page.tsx`: se agrego seleccion derivada de primera tarjeta, resumen compacto de tarjeta, metricas clave visibles, footer compartido y mejor jerarquia para opciones de pago.
- `components/credit-cards/pay-card/payment-option-card.tsx`: se reemplazo el texto `OK` por un icono accesible de check.
- `app/send/page.tsx`: se elimino lectura de ref durante render en la pantalla de confirmacion y se corrigio el label visible `Recipient` a `Destino`.

Validacion:

- `node node_modules\next\dist\bin\next build`: correcto.
- `node node_modules\eslint\bin\eslint.js app\pay\page.tsx app\send\page.tsx components\credit-cards\pay-card\payment-option-card.tsx components\ui\mobile-foundation.tsx`: 0 errores; quedan 3 warnings preexistentes en `app/pay/page.tsx` por `setState` dentro de effects.

Pendiente dentro de Batch 3:

- Revisar formularios de deuda y suscripciones con capturas nuevas cuando el tooling de screenshots responda sin timeout.
- Hacer pase de copy/encoding para mojibake visible antes de cerrar pulido mobile.
- Corregir los warnings React Compiler de `app/pay/page.tsx` si se decide limpiar calidad interna en este batch.

## Batch 3 - Siguiente paso y resultados encontrados

Fecha: 2026-06-03

Resultados encontrados:

- `components/planning/debt-form-sheet.tsx` ya tenia una estructura correcta de header, cuerpo scrolleable y footer fijo, pero necesitaba mas altura util, touch targets de 48px y copy con acentos.
- `components/settings/subscriptions-screen.tsx` ya usaba `BaseModalForm`, pero el formulario permitia un CTA visualmente activo aunque faltaran campos requeridos.
- El guard de suscripciones Pro hacia `setShowCreate(false)` dentro de un effect, generando warning del React Compiler. Se cambio a render condicional sin debilitar el gating.
- En los formularios revisados no se detecto necesidad de mutar datos ni tocar Supabase.

Cambios aplicados:

- Deuda: `Préstamo`, `día`, `Interés`, altura `90dvh`, inputs de 48px, padding mas consistente y footer mobile mas comodo.
- Suscripción: labels por campo, CTA deshabilitado hasta monto/cuenta/dia validos, copy de registro automatico mas claro y reset de cuenta vinculada al guardar.
- Validacion local: `node node_modules\eslint\bin\eslint.js components\planning\debt-form-sheet.tsx components\settings\subscriptions-screen.tsx` sin errores ni warnings.

Pendiente recomendado:

- Capturas manuales nuevas de `planning -> nueva deuda` y `settings/subscriptions -> nueva suscripción`.
- Pase de mojibake/copy global antes de avanzar a dashboards/historias, porque varias pantallas aun muestran texto con encoding roto en codigo o screenshots previos.
- Limpieza de warnings React Compiler en `app/pay/page.tsx` si se quiere dejar el flujo de pago tambien limpio internamente, no solo visualmente.

## Batch 4 - Rediseño visible del dashboard

Fecha: 2026-06-03

Resultado aplicado:

- `components/dashboard/balance-card.tsx`: reemplazo visual completo por una tarjeta principal tipo fintech, con fondo premium, monto mas protagonista y metricas compactas de disponible/tarjetas.
- `components/dashboard/quick-actions.tsx`: acciones convertidas en comandos grandes, con una accion primaria para enviar y dos tiles secundarios para pagar/scan.
- `components/dashboard/accounts-list.tsx`: secciones rehechas con titulos mas claros, copy corregido y controles de expansion mas visibles.
- `components/dashboard/transactions-list.tsx`: lista reconstruida como card agrupada por fecha, con headers compactos, iconos consistentes, montos alineados y estado vacio mejorado.
- `app/dashboard/page.tsx`: espaciado vertical reducido para que el dashboard se sienta como una pantalla de app, no como una pagina larga de cards separadas.

Resultados encontrados:

- El dashboard tenia buena base tecnica, pero visualmente leia como una lista vertical de componentes independientes.
- Las acciones rapidas eran demasiado pequenas para una home mobile; ahora tienen jerarquia de accion primaria/secundaria.
- La lista de movimientos tenia buena informacion, pero los items competian entre si; agruparlos dentro de una card mejora escaneo y densidad.
- Persisten warnings React Compiler preexistentes en `app/dashboard/page.tsx` por `setState` dentro de effects.

Validacion:

- `node node_modules\eslint\bin\eslint.js app\dashboard\page.tsx components\dashboard\balance-card.tsx components\dashboard\quick-actions.tsx components\dashboard\accounts-list.tsx components\dashboard\transactions-list.tsx`: 0 errores; 3 warnings preexistentes en `app/dashboard/page.tsx`.
- `node node_modules\next\dist\bin\next build`: correcto tras reintento. El primer intento fallo por descarga/resolucion temporal de Google Fonts de Next.

## Batch 4 - Continuación cuentas, tarjetas e historial

Fecha: 2026-06-03

Resultado aplicado:

- `components/accounts/branded-account-card.tsx`: tarjeta bancaria reconstruida con capas de luz, profundidad, estados de pago y copy corregido para tipos de cuenta/tarjeta.
- `components/accounts/accounts-screen.tsx`: header ampliado con resumen de disponible, cuentas y tarjetas; skeleton centrado; helper de interacción convertido en bloque visible.
- `components/history/history-screen.tsx`: cabecera convertida en panel de pulso financiero con neto del filtro, ingresos y gastos; se eliminaron cards duplicadas de resumen.
- `components/history/history-screen.tsx`: se retiraron imports muertos introducidos por la versión anterior del módulo.

Resultados encontrados:

- La pantalla de cuentas ya tenía estructura funcional sólida, pero necesitaba una capa de “centro financiero” para que no fuera solo una lista de tarjetas.
- `BrandedAccountCard` era la pieza más crítica porque se reutiliza en dashboard, cuentas y previews de creación.
- Historial necesitaba que el resumen viviera arriba como contexto de lectura; antes quedaba separado de la intención principal de la pantalla.

Pendiente recomendado:

- Revisar screenshots móviles de `accounts` e `history` con datos reales para ajustar densidad y contrastes finos.
- Hacer un pase posterior de `account-detail.tsx`, que es más grande y conviene tratar como módulo completo para no romper edición/eliminación.

## Batch 5 - Detalle de cuenta

Fecha: 2026-06-03

Resultado aplicado:

- `components/accounts/account-detail.tsx`: hero superior reforzado con atmósfera, capas decorativas, acciones flotantes y tarjeta bancaria integrada dentro del mismo lenguaje visual.
- `components/accounts/account-detail.tsx`: resumen de tarjeta convertido en bloque tipo statement con chip de contexto, paneles DOP/USD más suaves y fecha de pago destacada.
- `components/accounts/account-detail.tsx`: resumen mensual refinado con card más densa, bordes suaves y mejor continuidad con el resto del sistema.
- `components/accounts/account-detail.tsx`: sección de movimientos actualizada con helper táctil, buscador más consistente y filas con borde, sombra y mejor alineación de montos.

Resultados encontrados:

- `account-detail` ya tenía buena cobertura funcional: edición, eliminación, pagos, filtros y swipe actions. Por eso se hizo un rediseño focal, no una reescritura.
- El módulo conserva warnings React Compiler preexistentes por `setState` dentro de effects y una dependencia de memo, pero no introduce errores.

Validación:

- `node node_modules\eslint\bin\eslint.js components\accounts\account-detail.tsx`: 0 errores; 3 warnings preexistentes.
- `node node_modules\next\dist\bin\next build`: correcto.

Pendiente recomendado:

- Capturar `accounts/[id]` con una cuenta débito y una tarjeta crédito para ajustar contrastes del hero según branding real.
- Si se quiere limpiar calidad interna, resolver los effects de auto-edición y moneda de pago en `account-detail.tsx`.

## Batch 6 - Planning

Fecha: 2026-06-03

Resultado aplicado:

- `components/planning/planning-shell.tsx`: la pantalla principal ahora abre con un hero tipo centro de mando mensual, con lenguaje visual consistente con dashboard/historial.
- `components/planning/planning-shell.tsx`: tabs de presupuestos/calendario/deudas más altos y más táctiles.
- `components/planning/planning-summary-cards.tsx`: resumen de presupuesto convertido en card con estado, progreso visual y lectura de uso mensual.
- `components/planning/planning-summary-cards.tsx`: deuda pendiente dividida por moneda en subcards, con contexto de próximos 7 días.
- `components/planning/planning-pro-lock-screen.tsx`: pantalla Pro rediseñada como hero premium, con módulos visuales y CTAs más claros.

Resultados encontrados:

- Planning tenía buena estructura funcional, pero la pantalla leía como una colección de módulos sueltos.
- La card de presupuesto no comunicaba urgencia visual; ahora muestra estado `Controlado`, `Vigila` o `Al límite`.
- El lock Pro era correcto pero demasiado plano para una función clave de monetización.

Validación:

- `node node_modules\eslint\bin\eslint.js components\planning\planning-shell.tsx components\planning\planning-summary-cards.tsx components\planning\planning-pro-lock-screen.tsx`: 0 errores; 1 warning preexistente en `planning-shell.tsx` por `setState` dentro de effect al leer query param.
- `node node_modules\next\dist\bin\next build`: no ejecutado en este batch porque el entorno rechazó la acción por límite de uso externo.

Pendiente recomendado:

- Reintentar build cuando el límite externo lo permita.
- Capturar `planning?tab=calendar`, `planning?tab=budgets` y `planning?tab=debts` para ajustar densidad del hero frente a listas largas.

## Riesgos pendientes

- No se debe declarar la app "pulida" hasta revisar screenshots nuevos generados en la sesion sin timeouts.
- El mojibake requiere un batch propio o sub-batch de copy/encoding para no mezclarlo con redisenos.
- Algunos problemas pueden venir de datos de prueba, pero el UI debe manejar nombres largos, montos extremos y listas repetidas sin deformarse.
- El servidor dev necesita QA adicional: el bloqueo por `networkidle` puede esconder errores de carga o requests persistentes.

## Validacion esperada

Para cerrar Batch 2 de forma completa:

- `npm.cmd run build:safe`
- `npm.cmd run lint` si el entorno permite lectura de `node_modules`
- Capturas mobile con `node scripts/screenshot.mjs --route=<ruta> --mobile --fullpage --wait=domcontentloaded`
