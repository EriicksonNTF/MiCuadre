# 🎯 Cómo funciona MiCuadre de principio a fin (Explicación General)

MiCuadre es una **aplicación de finanzas personales para celular** que te ayuda a ver todo tu dinero en un solo lugar y tomar mejores decisiones. Funciona como un asistente financiero que está pendiente de ti.

### **El corazón de la app: El Dashboard**

Cuando abres MiCuadre, lo primero que ves es el **Dashboard**. Este es el "nervio central" que:

1. **Muestra tu balance total** de todas tus cuentas
2. **Da avisos inteligentes** cuando algo importante está por pasar
3. **Te motiva con estadísticas** sobre cómo gastas

---

## 📝 ¿QUÉ PASA CUANDO HACES UN GASTO?

### **Paso 1: Registras el gasto**
- Tocas el botón "+" o "Nueva transacción"
- Escribes cuánto gastaste (ej: RD$500)
- Seleccionas la categoría (Comida, Transporte, etc.)
- Eliges de qué cuenta sacas el dinero (Efectivo, Débito, etc.)
- Tocas **"Guardar"**

### **Paso 2: La app actualiza internamente**
Detrás de escenas, la app hace esto automáticamente:

```
Gasto registrado:
├─ Resta RD$500 del balance de tu cuenta
├─ Marca la transacción en el historial
├─ Calcula si te acercas al límite de tu presupuesto
├─ Generador de insights piensa: "Este mes gastaste mucho en Comida"
└─ Si estás offline, guarda el gasto localmente y lo sincroniza después
```

### **Paso 3: El Dashboard se actualiza**
- Ves un **aviso verde** diciendo "Gasto guardado - RD$500"
- El **balance de tu cuenta baja**
- Si tienes un presupuesto de Comida, la app **avanza la barra de progreso**

### **Paso 4: Si el presupuesto se excede**
Si ya gastaste RD$2,000 de un presupuesto de RD$1,500:
- Te aparece un **aviso de alerta en amarillo** en el Dashboard
- Dice algo como: "⚠️ Presupuesto excedido en Comida"
- En la sección de **Planificación → Presupuestos**, ves la barra en rojo

---

## 💰 ¿QUÉ PASA CUANDO REGISTRAS UN INGRESO?

Es casi igual pero al revés:

### **Paso 1: Registras el ingreso**
- Mismo proceso que un gasto, pero seleccionas **"Ingreso"** en lugar de gasto
- Ej: "Salario - RD$25,000"

### **Paso 2: La app actualiza**
```
Ingreso registrado:
├─ Suma RD$25,000 al balance de tu cuenta
├─ Lo marca como ingreso en el historial
├─ Actualiza el balance total en el Dashboard
└─ Si tienes metas de ahorro, la app ve si ayuda a alcanzarlas
```

### **Paso 3: Ves cambios en el Dashboard**
- Aviso verde: "Ingreso registrado - +RD$25,000"
- El balance de tu cuenta **sube**
- El balance total (arriba del Dashboard) **sube**

---

## 💳 ¿QUÉ PASA CON LAS TARJETAS DE CRÉDITO?

Las tarjetas son más complejas porque tienen **dos calendarios importantes**:

### **Concepto 1: El Ciclo de Tarjeta**
```
Ejemplo de tarjeta VISA:
- Corte (closing date): 15 de cada mes
- Fecha de pago: 20 de cada mes
- Días para pagar sin multa: 5 días
```

### **Concepto 2: Deuda vs. Saldo**
- **Deuda actual**: Todo lo que has gastado en esta tarjeta (se suma)
- **Saldo al corte**: Lo que adeudas según tu última factura
- **Deuda en USD y DOP**: La app maneja ambas monedas por separado

---

## ⏰ ¿QUÉ PASA CUANDO SE VENCE LA FECHA DE CORTE? (Ejemplo: Vence en 3 días)

### **Día X: Cuando faltan 3 días para el corte**

1. **La app calcula:**
   - Hoy es 12 de junio
   - Tu corte es el 15
   - Faltan 3 días

2. **La app envía un aviso:**
   - **Modal emergente** en el Dashboard
   - Título: "Corte próximo: VISA"
   - Mensaje: "Tu tarjeta VISA corta en 3 días. Revisa tus consumos antes del corte."
   - **Toast (notificación pequeña)** amarilla arriba de la pantalla

3. **Internamente:**
   - Marca este aviso para que **no vuelvas a verlo** ese día
   - Lo guarda en `localStorage` para recordar que ya te avisó
   - Este aviso solo aparece **una sola vez** por tarjeta, por día

4. **¿Qué significa el corte?**
   - El corte es la **última fecha** en la que puedes gastar sin que aparezca en la próxima factura
   - Todo lo que gastes después del corte, aparecerá en la siguiente factura

---

## 💸 ¿QUÉ PASA CUANDO SE VENCE LA FECHA DE PAGO? (Ejemplo: Pago vencido en 5 días)

### **Día Y: Cuando faltan 5 días para pagar**

1. **La app calcula:**
   - Hoy es 15 de junio
   - Tu pago vence el 20
   - Faltan 5 días
   - Tu saldo adeudado es RD$5,000

2. **La app envía un aviso:**
   - **Modal emergente** en el Dashboard
   - Título: "Pago próximo: VISA"
   - Mensaje: "Tu pago de VISA vence en 5 días. Balance pendiente: RD$5,000."
   - **Toast amarilla** arriba de la pantalla

3. **Internamente:**
   - Revisa que haya dinero adeudado
   - Calcula los días restantes
   - Marca el aviso para no repetirlo

4. **¿Qué significa?**
   - Es la fecha **límite para pagar** sin que te cobre intereses
   - Si no pagas para el 20, te cobra de más (intereses)

---

## 🔔 EJEMPLO COMPLETO: UNA TARJETA EN ACCIÓN

```
JUNIO 2026:

Día 12 (Lunes - Aviso 1):
  - Recibas: "Corte próximo: VISA en 3 días"
  - ¿Qué haces? Revisas qué gastaste

Día 15 (Jueves - SE CORTA):
  - Ya no puedes agregar gastos a esta factura
  - Todo lo que gastes a partir de ahora va para el próximo ciclo

Día 20 (Martes - Aviso 2):
  - Recibas: "Pago próximo: VISA en 5 días. Balance: RD$5,000"
  - ¿Qué haces? Decides cuánto pagar:
    * "Cuota mínima" (sugerida por el banco)
    * "Otro monto" (tú escribes cuánto)

Día 25 (Domingo - VENCE):
  - Último día para pagar sin intereses
  - Si pagaste, la deuda baja
  - Si no pagaste, te cobran intereses y multa
```

---

## 🎯 FLUJO DE PAGO DE TARJETA DESDE LA APP

### **Paso 1: Tocas "Pagar Tarjeta"**
Puedes iniciar desde:
- El **Dashboard** → botón de la tarjeta
- **Planificación → Calendario** → botón de la tarjeta
- **Cuentas** → selecciona la tarjeta → "Pagar"

### **Paso 2: Eliges la cantidad**
```
Modal "Pagar deuda":
├─ Monto sugerido (cuota mínima recomendada)
├─ O escribes otro monto manualmente
├─ La app te muestra cuánto quedaría adeudado después
└─ Seleccionas de qué cuenta pagar (Débito, Efectivo, etc.)
```

### **Paso 3: Confirmas con desliz**
- Modal final: "Desliza para pagar"
- Deslizas el botón de izquierda a derecha para confirmar
- Se ejecuta el pago

### **Paso 4: Después del pago**
```
La app:
├─ Reduce la deuda de tu tarjeta
├─ Reduce el balance de tu cuenta de origen
├─ Registra el movimiento en el historial
├─ Te muestra un recibo que dice:
│  ✓ Pago registrado
│  - Deuda anterior: RD$5,000
│  - Nuevo pendiente: RD$2,000
│  - Tu cuenta: -RD$3,000
└─ Green checkmark + "Pago guardado"
```

---

## 📅 SUSCRIPCIONES AUTOMÁTICAS (Netflix, Spotify, etc.)

### **¿Cómo la app las maneja?**

```
NETFLIX - Suscripción activa:
├─ Cobro: RD$199 cada mes
├─ Fecha de cobro: 1 de cada mes
├─ Estado: Auto-procesado

SPOTIFY - Próximo cobro mañana:
├─ Recibas aviso: "Suscripción mañana"
├─ Mensaje: "Spotify se cobrará mañana (RD$99)"
├─ ¿Qué pasa? Si tocas "Registrar pago", la app automáticamente:
│  ├─ Resta el dinero de tu cuenta
│  ├─ Registra el gasto en Suscripciones
│  ├─ Marca la suscripción como "pagada este mes"
│  └─ Te muestra un recibo
```

### **Procesamiento automático**
Cuando entras al Dashboard cada día:
1. La app **revisa todas tus suscripciones**
2. Si una está vencida hoy, puede **auto-registrarse** si lo configuraste
3. O te muestra un aviso diciendo "Spotify se cobrará hoy"

---

## ⚠️ RESUMEN DE AVISOS QUE RECIBAS

| Aviso | Cuándo aparece | Acción sugerida |
|-------|---|---|
| **Gasto guardado** | Tras registrar un gasto | Nada, es confirmación |
| **Ingreso registrado** | Tras registrar ingreso | Nada, es confirmación |
| **Corte próximo (3 días)** | Cuando faltan 3 días para el corte | Revisa qué gastaste |
| **Pago próximo (5 días)** | Cuando faltan 5 días para pagar | Prepárate para pagar |
| **Presupuesto excedido** | Si pasas el límite de una categoría | Reduce gastos en esa categoría |
| **Suscripción mañana** | Cuando falta 1 día para cobro | Verifica que tengas fondos |
| **Deuda vencida** (Planes Pro) | Si no pagaste a tiempo | Paga inmediatamente para evitar intereses |

---

## 🏗️ CÓMO FUNCIONA INTERNAMENTE (Arquitectura Simple)

```
USUARIO EN EL CELULAR
        ↓
   [Toca un botón]
        ↓
   [Componente React captura la acción]
        ↓
   [Validación local: ¿Es válido?]
        ↓
   [¿Estás online?]
   ├─ SÍ → Envía a Supabase (base de datos)
   └─ NO → Guarda localmente en el celular + sincroniza después
        ↓
   [Supabase actualiza tu perfil]
        ↓
   [La app recarga los datos]
        ↓
   [Dashboard se actualiza automáticamente]
        ↓
   [Ves los cambios en pantalla]
```

---

## 🎯 CONCLUSIÓN: LA INTELIGENCIA DE MICUADRE

La app es "inteligente" porque:

1. **Está pendiente del tiempo**: Calcula días para cortes y pagos automáticamente
2. **Te avisa a tiempo**: 3 días antes del corte, 5 días antes del pago
3. **Nunca te olvida**: Guarda los avisos y no te los repite
4. **Trabaja sin internet**: Guarda en tu celular si no hay conexión
5. **Todo se sincroniza**: Cuando vuelves online, todo se actualiza
6. **Evita errores**: Valida que tengas fondos antes de dejar pagar
7. **Registra todo**: Cada movimiento queda en el historial

Básicamente, **MiCuadre es como tener un contador personal en tu bolsillo** que te va diciendo qué hacer y cuándo hacerlo.
