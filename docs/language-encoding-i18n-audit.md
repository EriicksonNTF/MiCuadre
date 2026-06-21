# Auditoría de idioma, encoding e i18n

Fecha: 2026-05-28

## Hallazgos

Se encontraron textos con mojibake UTF-8/Latin-1 en:

- `components/landing/public-landing.tsx`: textos de hero, reportes, tarjetas, planificación, precios, FAQ y footer.
- `app/onboarding/page.tsx`: textos de facturación, Stripe, efectivo/débito, tarjeta de crédito y próximos pagos.
- `app/legal/privacidad/page.tsx`: política de privacidad completa.
- `app/api/mia/chat/route.ts`, `app/coach-ia/page.tsx`, `components/dashboard/coach-ia-widget.tsx`: prompts, mensajes de MIA y acciones.
- `components/settings/settings-screen.tsx`, `app/settings/about/page.tsx`: ajustes, moneda, sesión y textos legales.
- `lib/coach-ia.ts`, `lib/mia/agent.ts`: patrones y mensajes internos visibles por MIA.

Patrones corregidos:

- `á`, `é`, `í`, `ó`, `ú`
- `ñ`, `Ñ`, `ü`
- `¿`, `¡`, `©`, `·`
- `"“`, `”`, `’`, `–`, `—`, `…`
- `❤️`

Ejemplos corregidos:

- `hacia dónde` -> `hacia dónde`
- `gráficos` -> `gráficos`
- `resúmenes` -> `resúmenes`
- `Tarjeta de crédito` -> `Tarjeta de crédito`
- `Iniciar sesión` -> `Iniciar sesión`
- `¿Cerrar sesión?` -> `¿Cerrar sesión?`

## Textos en inglés

Se corrigieron textos genéricos visibles en componentes base:

- `Previous` -> `Anterior`
- `Next` -> `Siguiente`
- `More pages` -> `Más páginas`
- `Loading` -> `Cargando`
- `Search for a command to run...` -> `Buscar comando...`
- `Dashboard MiCuadre` -> `Panel MiCuadre`

Quedan apariciones en comentarios, nombres de tipos, logs técnicos, dependencias y traducciones inglesas válidas.

## Estado i18n

La app ya tenía `profile.language`, pero no una capa de traducciones integral. Se agregó una estructura ligera:

- `lib/i18n/translations.ts`
- `lib/i18n/use-translations.ts`

Se conectó en `components/settings/reports-screen.tsx` como primer paso typed para Español/Inglés sin añadir librerías.

## Pendientes

La UI no está completamente migrada a i18n. La mayor parte de la app sigue con textos hardcoded en español. Para asegurar inglés completo, falta migrar pantallas como dashboard, historial, cuentas, planificación, ajustes, auth, onboarding, MIA y billing a la misma estructura.
