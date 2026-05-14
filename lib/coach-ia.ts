import { formatCurrency } from "@/lib/data"

export type CoachIntent = "query" | "mutation" | "analysis" | "advice"

export type CoachEntity = {
  amount?: number
  currency?: "DOP" | "USD"
  timeframe?: "today" | "week" | "month" | "last_month"
  category?: string
}

export type CoachUIBlock =
  | { type: "kpi_card"; title: string; value: string; tone?: "info" | "warning" | "success" }
  | { type: "warning_bar"; title: string; value: string }
  | { type: "category_list"; title: string; items: Array<{ label: string; value: string }> }
  | { type: "draft_tx"; title: string; amount: string; category: string }

export type CoachAction = {
  label: string
  href: string
  actionType: "navigate" | "confirm_draft"
  mutationType?: "create_transaction" | "create_goal"
  payload?: Record<string, unknown>
}

export type CoachResponse = {
  answer: string
  uiBlocks: CoachUIBlock[]
  actions: CoachAction[]
  disclaimer?: string
}

export type CoachContext = {
  totalIncomeMonth: number
  totalExpenseMonth: number
  totalExpenseLastMonth: number
  topCategories: Array<{ name: string; total: number }>
  finScore: number
  finScoreDrivers: Array<{ key: string; score: number }>
  activeGoals: Array<{ name: string; current: number; target: number }>
  daysRemainingInMonth: number
  estimatedRunwayDays: number
}

export const COACH_NAME = "MIA"

const INTENT_PATTERNS: Record<CoachIntent, RegExp[]> = {
  query: [
    /en que .*gast/, /donde .*dinero/, /cuanto .*gast/, /resumen/, /como voy/, /ver/, /cuanto llevo/,
  ],
  mutation: [
    /agrega/, /anade/, /añade/, /registr/, /crea/, /pon /, /guarda /,
  ],
  analysis: [
    /mes pasado/, /compar/, /proyecc/, /me alcanza/, /voy bien/, /ritmo/, /semana/,
  ],
  advice: [
    /como puedo/, /que gasto deberia/, /deberia/, /reducir/, /subir.*finscore/, /mejorar/, /que hago/,
  ],
}

export function detectIntent(message: string): CoachIntent {
  const q = normalizeText(message)
  const scores: Record<CoachIntent, number> = {
    query: 0,
    mutation: 0,
    analysis: 0,
    advice: 0,
  }

  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS) as Array<[CoachIntent, RegExp[]]>) {
    for (const pattern of patterns) {
      if (pattern.test(q)) scores[intent] += 1
    }
  }

  const best = (Object.keys(scores) as CoachIntent[]).sort((a, b) => scores[b] - scores[a])[0]
  if (scores[best] === 0) return "query"
  return best
}

export function extractEntities(message: string): CoachEntity {
  const q = normalizeText(message)
  const entity: CoachEntity = {}

  const amountMatch = q.match(/(\d+[\.,]?\d*)/)
  if (amountMatch) {
    entity.amount = Number(amountMatch[1].replace(",", "."))
  }

  if (q.includes("usd") || q.includes("dolar")) entity.currency = "USD"
  else if (q.includes("dop") || q.includes("peso")) entity.currency = "DOP"

  if (q.includes("hoy")) entity.timeframe = "today"
  else if (q.includes("semana")) entity.timeframe = "week"
  else if (q.includes("mes pasado")) entity.timeframe = "last_month"
  else if (q.includes("mes")) entity.timeframe = "month"

  if (/enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre/.test(q)) {
    entity.timeframe = "month"
  }

  const categoryHints = ["comida", "gasolina", "transporte", "ocio", "suscripciones", "restaurante", "supermercado"]
  const foundCategory = categoryHints.find((hint) => q.includes(hint))
  if (foundCategory) entity.category = foundCategory

  return entity
}

export function buildCoachReply(message: string, context: CoachContext): CoachResponse {
  const intent = detectIntent(message)
  const entities = extractEntities(message)
  const q = normalizeText(message)

  if (context.totalIncomeMonth === 0 && context.totalExpenseMonth === 0) {
    return {
      answer: `Todavia no tengo suficientes datos tuyos. Soy ${COACH_NAME}, y cuando agregues tu primera transaccion te digo exactamente en que se te va el dinero.`,
      uiBlocks: [
        { type: "kpi_card", title: "Siguiente paso", value: "Registra 1 ingreso y 1 gasto", tone: "info" },
      ],
      actions: [{ label: "Agregar transaccion", href: "/expense", actionType: "navigate" }],
    }
  }

  if (intent === "mutation") {
    const amount = entities.amount ?? 0
    const category = entities.category ?? "Sin categoria"
    return {
      answer: `Perfecto. Te preparo un borrador para registrar ${formatCurrency(amount || 0)} en ${category}.`,
      uiBlocks: [
        {
          type: "draft_tx",
          title: "Borrador de transaccion",
          amount: formatCurrency(amount || 0),
          category,
        },
      ],
      actions: [{ label: "Confirmar en Agregar", href: "/expense", actionType: "navigate" }],
      disclaimer: "Revisa el monto y la categoria antes de guardar.",
    }
  }

  if (/(en que .*gast|donde .*dinero|que gasto deberia reducir)/.test(q)) {
    const top = context.topCategories.slice(0, 3)
    if (top.length === 0) {
      return {
        answer: "Aun no veo categorias claras. Registra 3 movimientos mas y te digo exactamente cual recortar.",
        uiBlocks: [{ type: "kpi_card", title: "Siguiente paso", value: "Registrar mas movimientos", tone: "info" }],
        actions: [{ label: "Agregar transaccion", href: "/expense", actionType: "navigate" }],
      }
    }
    const topOne = top[0]
    const quickCut = Math.round(topOne.total * 0.1)
    return {
      answer: `Ahora mismo tu mayor fuga es ${topOne.name} con ${formatCurrency(topOne.total)}. Si recortas ${formatCurrency(quickCut)} esta semana, mejoras tu balance de inmediato.`,
      uiBlocks: [
        {
          type: "category_list",
          title: "Categorias que mas pesan",
          items: top.map((item) => ({ label: item.name, value: formatCurrency(item.total) })),
        },
      ],
      actions: [
        { label: "Ver gastos", href: "/history", actionType: "navigate" },
        { label: "Agregar transaccion", href: "/expense", actionType: "navigate" },
      ],
    }
  }

  if (q.includes("finscore") || q.includes("subir")) {
    const lowest = [...context.finScoreDrivers].sort((a, b) => a.score - b.score)[0]
    const areaLabel =
      lowest?.key === "budget"
        ? "presupuesto"
        : lowest?.key === "consistency"
          ? "consistencia"
          : lowest?.key === "debt"
            ? "deuda"
            : "ahorro"

    return {
      answer: `Tu FinScore va por ${context.finScore}/100. Para subirlo rapido hoy: enfocate en ${areaLabel} y haz una mejora concreta antes de terminar el dia.`,
      uiBlocks: [
        { type: "kpi_card", title: "FinScore actual", value: `${context.finScore}/100`, tone: context.finScore >= 65 ? "success" : "warning" },
      ],
      actions: [
        { label: "Ver FinScore", href: "/", actionType: "navigate" },
        { label: "Revisar gastos", href: "/history", actionType: "navigate" },
      ],
      disclaimer: "Analisis educativo: no constituye asesoria financiera certificada.",
    }
  }

  if (q.includes("meta") || q.includes("metas")) {
    const sortedGoals = context.activeGoals
      .map((goal) => ({
        ...goal,
        progress: goal.target > 0 ? Math.round((goal.current / goal.target) * 100) : 0,
      }))
      .sort((a, b) => b.progress - a.progress)

    if (sortedGoals.length === 0) {
      return {
        answer: "No veo metas activas ahora mismo. Si creas una hoy, te ayudo a darle seguimiento semanal.",
        uiBlocks: [{ type: "kpi_card", title: "Meta recomendada", value: "Fondo de emergencia", tone: "info" }],
        actions: [{ label: "Crear meta", href: "/goals", actionType: "navigate" }],
      }
    }

    const main = sortedGoals[0]
    return {
      answer: `Tu meta mas avanzada es "${main.name}" con ${main.progress}%. Vas bien, te faltan ${formatCurrency(Math.max(0, main.target - main.current))}.`,
      uiBlocks: [
        { type: "kpi_card", title: "Meta lider", value: `${main.progress}% completado`, tone: "success" },
      ],
      actions: [{ label: "Ver mis metas", href: "/goals", actionType: "navigate" }],
    }
  }

  if (q.includes("mes pasado") || q.includes("compar")) {
    const diff = context.totalExpenseMonth - context.totalExpenseLastMonth
    const increasing = diff > 0
    return {
      answer: increasing
        ? `Este mes llevas ${formatCurrency(diff)} mas en gastos que el mes pasado. Ajustando hoy una categoria, lo corriges a tiempo.`
        : `Vas mejor que el mes pasado: llevas ${formatCurrency(Math.abs(diff))} menos en gastos. Buen ritmo.`,
      uiBlocks: [
        {
          type: "kpi_card",
          title: "Comparativa mensual",
          value: increasing ? `+${formatCurrency(diff)}` : `-${formatCurrency(Math.abs(diff))}`,
          tone: increasing ? "warning" : "success",
        },
      ],
      actions: [{ label: "Ver gastos", href: "/history", actionType: "navigate" }],
    }
  }

  if (q.includes("cuanto puedo ahorrar") || q.includes("ahorrar esta semana")) {
    const freeCash = Math.max(0, context.totalIncomeMonth - context.totalExpenseMonth)
    const suggestion = Math.round(freeCash * 0.25)
    return {
      answer: suggestion > 0
        ? `Esta semana puedes apartar alrededor de ${formatCurrency(suggestion)} sin forzarte. Hazlo en una meta y te doy seguimiento.`
        : "Esta semana estas justo. Primero recorta una categoria variable y luego apartamos un monto realista.",
      uiBlocks: [
        { type: "kpi_card", title: "Ahorro sugerido semanal", value: formatCurrency(Math.max(0, suggestion)), tone: suggestion > 0 ? "success" : "warning" },
      ],
      actions: [{ label: "Crear meta", href: "/goals", actionType: "navigate" }],
    }
  }

  if (q.includes("gastando") || q.includes("reducir") || q.includes("categoria")) {
    const top = context.topCategories.slice(0, 3)
    if (top.length > 0) {
      return {
        answer: `Donde mas se te va el dinero es en ${top[0].name}. Si bajas eso 10% esta semana, ya se siente en tu balance.`,
        uiBlocks: [
          {
            type: "category_list",
            title: "Top categorias del mes",
            items: top.map((item) => ({ label: item.name, value: formatCurrency(item.total) })),
          },
        ],
        actions: [
          { label: "Ver gastos", href: "/history", actionType: "navigate" },
          { label: "Agregar transaccion", href: "/expense", actionType: "navigate" },
        ],
      }
    }
  }

  if (q.includes("voy bien") || q.includes("como voy") || q.includes("resumen")) {
    const healthy = context.totalIncomeMonth >= context.totalExpenseMonth
    return {
      answer: healthy
        ? `Vas bien este mes: ingresos ${formatCurrency(context.totalIncomeMonth)} vs gastos ${formatCurrency(context.totalExpenseMonth)}.`
        : `Ojo: este mes tus gastos (${formatCurrency(context.totalExpenseMonth)}) ya superan tus ingresos (${formatCurrency(context.totalIncomeMonth)}).`,
      uiBlocks: [
        {
          type: "warning_bar",
          title: "Ritmo estimado",
          value: `A este ritmo te alcanzaria para ${context.estimatedRunwayDays} dias`,
        },
      ],
      actions: [
        { label: "Ver resumen", href: "/", actionType: "navigate" },
        { label: "Revisar gastos", href: "/history", actionType: "navigate" },
      ],
    }
  }

  return {
    answer: "Te puedo ayudar con gastos, metas, FinScore y comparativas del mes. Dime que quieres optimizar hoy.",
    uiBlocks: [{ type: "kpi_card", title: "Sugerencia", value: "Prueba: Como voy este mes", tone: "info" }],
    actions: [{ label: "Ver mis metas", href: "/goals", actionType: "navigate" }],
  }
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}
