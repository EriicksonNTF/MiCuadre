---
name: antes-de
description: Ejecuta un diagnóstico obligatorio en dos pasos (comprensión + causa raíz) antes de escribir, modificar o sugerir cualquier línea de código. Actívala siempre que vayas a proponer un cambio, arreglar un bug, refactorizar, añadir una feature o modificar archivos. No importa si el usuario ya describió el problema — igual ejecuta el flujo. Si el usuario describe explícitamente el bug o pide directamente una solución y ya dio contexto suficiente, puedes integrar el diagnóstico en la respuesta sin pedir confirmación explícita después de cada paso, siempre que muestres ambos pasos de forma clara y estructurada antes del código. Si hay ambigüedad o falta información clave, DETENTE y pregunta antes de continuar.
---

# Antes de — Diagnóstico obligatorio de dos pasos

## Objetivo

Garantizar que **ningún cambio de código se realiza sin entender primero el problema y su causa raíz**. Este skill previene modificaciones impulsivas, reduce regresiones y asegura que cada línea de código responde a un diagnóstico verificado.

## Regla principal

**No escribas, modifiques ni sugieras código sin completar ambos pasos.** Tu output debe contener siempre el diagnóstico completo antes del código.

---

## Paso 1 — Comprensión y contexto ("Qué" y "Por qué")

Antes de tocar cualquier archivo, responde estas preguntas por escrito:

### 1.1 Re-formulación del problema
- Explica **con tus propias palabras** qué entendiste del problema que el usuario describió.
- Si el usuario no lo describió explícitamente, dedúcelo del contexto de la conversación.

### 1.2 Mapa de impacto
Identifica qué se ve afectado:
- **Componentes/archivos involucrados:** ¿Qué archivos, componentes o módulos están implicados?
- **Estados y datos:** ¿Qué estados de React, SWR keys, stores de IndexedDB o consultas a Supabase se ven afectados?
- **Dependencias externas:** ¿Hay dependencias (Radix UI, Vaul, Recharts, Stripe, etc.) involucradas?
- **Flujos:** ¿Qué flujos de datos o rutas de navegación toca el cambio?

### 1.3 Punto de detención por falta de información
Si no puedes responder a 1.1 o 1.2 con claridad porque falta información:
- **DETENTE.**
- Haz preguntas específicas al usuario para obtener la información faltante.
- No adivines ni asumas.

---

## Paso 2 — Hipótesis de causa raíz

### 2.1 Diagnóstico
Determina cuál es el origen real del problema:
- ¿Es un estado que no se actualiza?
- ¿Es un `useEffect` con dependencias incorrectas?
- ¿Es un evento que no se propaga?
- ¿Es un error de tipado o de schema (Zod/TypeScript)?
- ¿Es un problema de RLS en Supabase?
- ¿Es un race condition entre online/offline (outbox/sync)?
- ¿Es un problema de layout o stacking context (CSS)?
- ¿Es una mala configuración de entitlements o feature gates?
- ¿Es un error en el middleware de autenticación?

### 2.2 Conclusión de causa raíz
Presenta una conclusión breve y clara. Ejemplo:
> **Causa raíz:** `new Date(transaction.date)` interpreta la fecha como UTC midnight, y en UTC-4 esto desplaza la fecha un día atrás. Fix: `new Date(\`${transaction.date}T12:00:00\`)`.

---

## Reglas para proponer código

1. **Primero el diagnóstico, después el código.** El código nunca debe preceder al diagnóstico en tu respuesta.
2. **Cuando el contexto es suficiente y el usuario es explícito** (describe el bug, da detalles, menciona archivos), puedes ejecutar ambos pasos de forma integrada y presentar diagnóstico + solución en un solo mensaje, siempre que el diagnóstico esté antes del código.
3. **No te extiendas innecesariamente en el diagnóstico.** Sé preciso, breve y técnico.
4. **Si hay ambigüedad importante en la comprensión del problema, no la ignores.** Pregunta.
5. **Después del código, no añadas explicaciones no solicitadas.** El diagnóstico ya fue entregado antes.

---

## Ejemplos de aplicación

### Ejemplo 1 — Bug claro con contexto suficiente

**Usuario:** "Al editar una transacción, la fecha se desplaza un día atrás"

**Diagnóstico (Paso 1 + 2 integrados):**
> **Comprensión:** Al abrir `EditTransactionSheet`, la fecha `"2026-07-09"` se muestra como `"2026-07-08"`. Afecta al componente `EditTransactionSheet`, al campo `date` de la transacción.
> **Causa raíz:** `new Date("2026-07-09")` → UTC midnight → UTC-4 lo desplaza a `2026-07-08T20:00:00`. Fix: `new Date("${transaction.date}T12:00:00")`.

**Código:** [solución]

### Ejemplo 2 — Problema ambiguo

**Usuario:** "Las transacciones no se guardan a veces"

**Diagnóstico:**
> **Comprensión:** No está claro si falla online, offline o ambos. Afecta al hook `use-data.ts`, al outbox de IndexedDB, y a la mutación de SWR.
> **Falta información:** ¿El error ocurre con o sin conexión? ¿Hay algún error en consola? ¿Aparece el toast de error?

**→ Pregunta al usuario antes de continuar.**

---

## Errores que debes evitar

- Escribir código sin haber mostrado el diagnóstico.
- Ignorar ambigüedades y adivinar la solución.
- Diagnosticar de forma genérica sin identificar el componente o archivo concreto.
- Saltarte el paso de comprensión e ir directamente a la causa raíz.
- Asumir que conoces el código mejor de lo que realmente lo conoces — verifica siempre con búsquedas (grep/glob/read).
- Hacer preguntas cuando el usuario ya dio contexto suficiente para un diagnóstico claro.

---

## Criterios de calidad

- El diagnóstico es verificable: otro desarrollador podría leerlo y confirmar que coincide con el código.
- La causa raíz identifica el mecanismo concreto (no "es un bug de fechas" sino "el constructor Date() interpreta ISO dates como UTC").
- El código propuesto se deriva lógicamente del diagnóstico.
- No hay cambios no relacionados al diagnóstico en el mismo mensaje.
