import { formatCurrency } from "@/lib/data"
import { COACH_NAME, type CoachResponse } from "@/lib/coach-ia"
import {
  formatTopCategoryList,
  getCreditCards,
  getExpenseComparison,
  getGoalProgress,
  getMonthSummary,
  getTopCategories,
  type MiaSnapshot,
} from "@/lib/mia/tools"
import { draftGoalSchema, draftTransactionSchema } from "@/lib/mia/schemas"

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

export function runMiaPhase1Agent(message: string, snapshot: MiaSnapshot): CoachResponse {
  const q = normalizeText(message)

  if (/(agrega|anade|añade|registra|crear|crea|guarda)/.test(q) && /(gasto|ingreso|transaccion)/.test(q)) {
    const amountMatch = q.match(/(\d+[\.,]?\d*)/)
    const amount = amountMatch ? Number(amountMatch[1].replace(",", ".")) : 0
    const currency = q.includes("usd") || q.includes("dolar") ? "USD" : "DOP"
    const hintedCategory = ["comida", "gasolina", "transporte", "suscripciones", "ocio", "supermercado"].find((c) => q.includes(c)) || "Sin categoria"

    const parsedDraft = draftTransactionSchema.safeParse({
      amount,
      category: hintedCategory,
      currency,
    })

    if (!parsedDraft.success || parsedDraft.data.amount <= 0) {
      return {
        answer: "Te preparo el borrador, pero necesito un monto valido. Ejemplo: Registra gasto de 1200 en comida.",
        uiBlocks: [{ type: "kpi_card", title: "Formato sugerido", value: "Gasto de 1200 en comida", tone: "info" }],
        actions: [{ label: "Intentar de nuevo", href: "/coach-ia", actionType: "navigate" }],
      }
    }

    return {
      answer: `Listo. Te prepare un borrador de ${formatCurrency(parsedDraft.data.amount, parsedDraft.data.currency)} en ${parsedDraft.data.category}.`,
      uiBlocks: [
        {
          type: "draft_tx",
          title: "Borrador de transaccion",
          amount: formatCurrency(parsedDraft.data.amount, parsedDraft.data.currency),
          category: parsedDraft.data.category,
        },
      ],
      actions: [
        {
          label: "Confirmar y guardar",
          href: "/coach-ia",
          actionType: "confirm_draft",
          mutationType: "create_transaction",
          payload: {
            amount: parsedDraft.data.amount,
            currency: parsedDraft.data.currency,
            category: parsedDraft.data.category,
            type: "expense",
          },
        },
        { label: "Editar en Agregar", href: "/expense", actionType: "navigate" },
      ],
      disclaimer: "MIA no guarda movimientos automaticamente en Fase 2. Debes confirmar en la pantalla de Agregar.",
    }
  }

  if (/(crea|crear|nueva|nueva presupuesto|presupuesto de)/.test(q) && q.includes("presupuesto")) {
    const amountMatch = q.match(/(\d+[\.,]?\d*)/)
    const targetAmount = amountMatch ? Number(amountMatch[1].replace(",", ".")) : 0
    const currency = q.includes("usd") || q.includes("dolar") ? "USD" : "DOP"
    const name = q.includes("emergencia")
      ? "Fondo de emergencia"
      : q.includes("viaje")
        ? "Viaje"
        : q.includes("iphone")
          ? "Nuevo iPhone"
          : "Nueva presupuesto"

    const parsedGoal = draftGoalSchema.safeParse({ name, targetAmount, currency })
    if (!parsedGoal.success) {
      return {
        answer: "Para crear la presupuesto necesito el monto objetivo. Ejemplo: Crea una presupuesto de 50000 para viaje.",
        uiBlocks: [{ type: "kpi_card", title: "Formato sugerido", value: "presupuesto de 50000 para viaje", tone: "info" }],
        actions: [{ label: "Intentar de nuevo", href: "/coach-ia", actionType: "navigate" }],
      }
    }

    return {
      answer: `Perfecto. Te deje un borrador de presupuesto "${parsedGoal.data.name}" por ${formatCurrency(parsedGoal.data.targetAmount, parsedGoal.data.currency)}.`,
      uiBlocks: [{ type: "kpi_card", title: "Borrador de presupuesto", value: `${parsedGoal.data.name} · ${formatCurrency(parsedGoal.data.targetAmount, parsedGoal.data.currency)}`, tone: "success" }],
      actions: [
        {
          label: "Confirmar y crear",
          href: "/coach-ia",
          actionType: "confirm_draft",
          mutationType: "create_goal",
          payload: {
            name: parsedGoal.data.name,
            targetAmount: parsedGoal.data.targetAmount,
            currency: parsedGoal.data.currency,
          },
        },
        { label: "Editar en planificacion", href: "/planning", actionType: "navigate" },
      ],
      disclaimer: "MIA no crea la presupuesto automaticamente en Fase 2. Debes confirmarla en la pantalla de planificacion.",
    }
  }

  if (q.includes("tarjeta") || q.includes("credito") || q.includes("corte") || q.includes("pago")) {
    const cards = getCreditCards(snapshot)
    if (cards.length === 0) {
      return {
        answer: "No veo tarjetas de credito registradas todavia. Si agregas una, te ayudo a vigilar corte y pago.",
        uiBlocks: [{ type: "kpi_card", title: "Siguiente paso", value: "Registrar tarjeta", tone: "info" }],
        actions: [{ label: "Ir a cuentas", href: "/accounts", actionType: "navigate" }],
      }
    }

    const card = cards[0]
    return {
      answer: `Tu tarjeta ${card.name} esta clara: balance actual ${formatCurrency(card.currentBalance)}, balance al corte ${formatCurrency(card.statementBalance)} y disponible ${formatCurrency(card.available)}.`,
      uiBlocks: [
        { type: "kpi_card", title: "Balance actual", value: formatCurrency(card.currentBalance), tone: "warning" },
        { type: "kpi_card", title: "Disponible", value: formatCurrency(card.available), tone: "success" },
        {
          type: "warning_bar",
          title: "Fechas de tarjeta",
          value: `Corte: ${card.statementDate || "Sin fecha"} · Pago: ${card.statementDueDate || "Sin fecha"}`,
        },
      ],
      actions: [{ label: "Ver cuentas", href: "/accounts", actionType: "navigate" }],
    }
  }

  if (q.includes("presupuesto") || q.includes("planificacion")) {
    const goals = getGoalProgress(snapshot)
    if (goals.length === 0) {
      return {
        answer: "No tienes planificacion activas ahora mismo. Si creas una, te acompano con seguimiento semanal.",
        uiBlocks: [{ type: "kpi_card", title: "presupuesto recomendada", value: "Fondo de emergencia", tone: "info" }],
        actions: [{ label: "Crear presupuesto", href: "/planning", actionType: "navigate" }],
      }
    }

    const topGoal = goals[0]
    return {
      answer: `Tu presupuesto mas avanzada es "${topGoal.name}" con ${topGoal.progress}%. Te faltan ${formatCurrency(topGoal.missing)} para completarla.`,
      uiBlocks: [{ type: "kpi_card", title: "presupuesto lider", value: `${topGoal.progress}% completado`, tone: "success" }],
      actions: [{ label: "Ver planificacion", href: "/planning", actionType: "navigate" }],
    }
  }

  if (q.includes("mes pasado") || q.includes("compar")) {
    const comparison = getExpenseComparison(snapshot)
    const increasing = comparison.diff > 0
    return {
      answer: increasing
        ? `Este mes llevas ${formatCurrency(comparison.diff)} mas en gastos que el mes pasado.`
        : `Vas mejor que el mes pasado: llevas ${formatCurrency(Math.abs(comparison.diff))} menos en gastos.`,
      uiBlocks: [
        {
          type: "kpi_card",
          title: "Comparativa mensual",
          value: increasing ? `+${formatCurrency(comparison.diff)}` : `-${formatCurrency(Math.abs(comparison.diff))}`,
          tone: increasing ? "warning" : "success",
        },
      ],
      actions: [{ label: "Ver historial", href: "/history", actionType: "navigate" }],
    }
  }

  if (q.includes("gasto") || q.includes("categoria") || q.includes("dinero")) {
    const top = getTopCategories(snapshot, 3)
    if (top.length > 0) {
      const topOne = top[0]
      const cut = Math.round(topOne.total * 0.1)
      return {
        answer: `Tu mayor categoria este mes es ${topOne.name} con ${formatCurrency(topOne.total)}. Si recortas ${formatCurrency(cut)} esta semana, mejoras tu balance rapido.`,
        uiBlocks: [{ type: "category_list", title: "Top categorias del mes", items: formatTopCategoryList(top) }],
        actions: [{ label: "Ver gastos", href: "/history", actionType: "navigate" }],
      }
    }
  }

  const summary = getMonthSummary(snapshot)
  const healthy = summary.income >= summary.expense

  if (summary.income === 0 && summary.expense === 0) {
    return {
      answer: `Soy ${COACH_NAME}. Todavia no tengo suficientes datos. Registra tu primer ingreso y tu primer gasto, y te doy un diagnostico real.`,
      uiBlocks: [{ type: "kpi_card", title: "Siguiente paso", value: "Agregar 1 ingreso y 1 gasto", tone: "info" }],
      actions: [{ label: "Agregar transaccion", href: "/expense", actionType: "navigate" }],
    }
  }

  return {
    answer: healthy
      ? `Vas bien este mes: ingresos ${formatCurrency(summary.income)} vs gastos ${formatCurrency(summary.expense)}.`
      : `Atencion: este mes tus gastos (${formatCurrency(summary.expense)}) superan tus ingresos (${formatCurrency(summary.income)}).`,
    uiBlocks: [
      {
        type: "warning_bar",
        title: "Ritmo estimado",
        value: `A este ritmo te alcanzaria para ${summary.runwayDays} dias`,
      },
    ],
    actions: [
      { label: "Ver historial", href: "/history", actionType: "navigate" },
      { label: "Ir a planificacion", href: "/planning", actionType: "navigate" },
    ],
    disclaimer: "Analisis educativo: no constituye asesoria financiera certificada.",
  }
}

