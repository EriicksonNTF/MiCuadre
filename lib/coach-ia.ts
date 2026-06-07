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
  categoryBudgets: Array<{
    name: string
    categoryName: string
    limit: number
    spent: number
    currency: "DOP" | "USD"
  }>
  upcomingPayments: Array<{
    name: string
    amount: number
    currency: "DOP" | "USD"
    dueDate: string
    type: "subscription" | "debt" | "credit"
  }>
  monthlyBudget: {
    limit: number
    spent: number
    currency: "DOP" | "USD"
  } | null
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

  if (/(pago|pagos|cobro|cobros|vencimiento|vencimientos|cuota|cuotas|factura|facturas)/.test(q) &&
      /(esta\s+semana|estos\s+dias|proximos?|pr[oó]ximos?|7\s*dias|en\s+7)/.test(q)) {
    if (context.upcomingPayments.length === 0) {
      return {
        answer: "No tienes pagos programados para los proximos 7 dias. Buen momento para revisar suscripciones y cancelar las que no uses.",
        uiBlocks: [
          { type: "kpi_card", title: "Pagos esta semana", value: "0 vencimientos", tone: "info" },
        ],
        actions: [
          { label: "Ver suscripciones", href: "/settings/subscriptions", actionType: "navigate" },
        ],
      }
    }
    const totalByCurrency = context.upcomingPayments.reduce<Record<string, number>>((acc, p) => {
      acc[p.currency] = (acc[p.currency] || 0) + p.amount
      return acc
    }, {})
    const totalSummary = Object.entries(totalByCurrency)
      .map(([cur, amt]) => formatCurrency(amt, cur as "DOP" | "USD"))
      .join(" + ")
    return {
      answer: `Tienes ${context.upcomingPayments.length} pago(s) en los proximos 7 dias, total ${totalSummary}.`,
      uiBlocks: [
        {
          type: "category_list",
          title: "Proximos pagos",
          items: context.upcomingPayments.map((p) => ({
            label: `${p.name} - ${p.dueDate} (${p.type === "subscription" ? "suscripcion" : "deuda"})`,
            value: formatCurrency(p.amount, p.currency),
          })),
        },
      ],
      actions: [
        { label: "Ver suscripciones", href: "/settings/subscriptions", actionType: "navigate" },
        { label: "Ver deudas", href: "/planning", actionType: "navigate" },
      ],
    }
  }

  const budgetMatch = q.match(/presupuesto\s+(?:de|del|de\s+la)\s+([a-záéíóúñ][a-záéíóúñ\s]*?)(?:\?|$|\.|,)/)
  if (budgetMatch) {
    const query = budgetMatch[1].trim().toLowerCase()
    const budget = context.categoryBudgets.find((b) =>
      b.categoryName.toLowerCase().includes(query) || query.includes(b.categoryName.toLowerCase())
    )
    if (budget) {
      const remaining = Math.max(0, budget.limit - budget.spent)
      const pct = budget.limit > 0 ? Math.round((budget.spent / budget.limit) * 100) : 0
      const tone: "info" | "warning" | "success" =
        pct >= 100 ? "warning" : pct >= 80 ? "info" : "success"
      return {
        answer: `De tu presupuesto de ${budget.categoryName} te quedan ${formatCurrency(remaining, budget.currency)} este mes (has gastado ${formatCurrency(budget.spent, budget.currency)} de ${formatCurrency(budget.limit, budget.currency)}, ${pct}%).`,
        uiBlocks: [
          {
            type: "kpi_card",
            title: `Presupuesto ${budget.categoryName}`,
            value: `${formatCurrency(remaining, budget.currency)} restantes (${pct}%)`,
            tone,
          },
        ],
        actions: [
          { label: "Ver gastos", href: "/history", actionType: "navigate" },
          { label: "Ajustar presupuesto", href: "/planning", actionType: "navigate" },
        ],
      }
    }
    return {
      answer: `No veo un presupuesto activo para "${query}" este mes. Si quieres, creamos uno ahora y le pongo seguimiento semanal.`,
      uiBlocks: [
        { type: "kpi_card", title: "Sin presupuesto", value: `Crea uno para "${query}"`, tone: "info" },
      ],
      actions: [{ label: "Crear presupuesto", href: "/planning", actionType: "navigate" }],
    }
  }

  if (/(pasar(me)?|exceder|sobrepasar|rebasar|cerca\s+de\s+pasar|l[ií]mite\s+(?:del\s+)?presupuesto)/.test(q)) {
    if (!context.monthlyBudget || context.monthlyBudget.limit <= 0) {
      return {
        answer: "No tienes presupuestos activos definidos este mes. Crea al menos uno y te aviso en tiempo real si te acercas al limite.",
        uiBlocks: [
          { type: "kpi_card", title: "Sin presupuestos", value: "Crea uno para empezar", tone: "info" },
        ],
        actions: [{ label: "Crear presupuesto", href: "/planning", actionType: "navigate" }],
      }
    }
    const { limit, spent, currency } = context.monthlyBudget
    const pct = Math.round((spent / limit) * 100)
    const remaining = Math.max(0, limit - spent)
    const overBudget = pct >= 100
    const close = pct >= 80
    return {
      answer: overBudget
        ? `Ya te pasaste del presupuesto del mes: llevas ${formatCurrency(spent, currency)} de ${formatCurrency(limit, currency)} (${pct}%). Recorta una categoria variable hoy mismo.`
        : close
          ? `Ojo: llevas ${pct}% del presupuesto del mes (${formatCurrency(spent, currency)} de ${formatCurrency(limit, currency)}), con ${context.daysRemainingInMonth} dias por delante. A este ritmo te pasas.`
          : `Vas bien: ${pct}% del presupuesto del mes (${formatCurrency(spent, currency)} de ${formatCurrency(limit, currency)}), con ${formatCurrency(remaining, currency)} para los proximos ${context.daysRemainingInMonth} dias.`,
      uiBlocks: overBudget
        ? [
            {
              type: "warning_bar",
              title: "Presupuesto del mes",
              value: `${pct}% usado - ya excediste el limite`,
            },
          ]
        : [
            {
              type: "kpi_card",
              title: "Presupuesto del mes",
              value: `${pct}% usado`,
              tone: close ? "warning" : "success",
            },
          ],
      actions: [
        { label: "Ver gastos", href: "/history", actionType: "navigate" },
        { label: "Ajustar presupuesto", href: "/planning", actionType: "navigate" },
      ],
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

  if (q.includes("presupuesto") || q.includes("planificacion")) {
    const sortedGoals = context.activeGoals
      .map((goal) => ({
        ...goal,
        progress: goal.target > 0 ? Math.round((goal.current / goal.target) * 100) : 0,
      }))
      .sort((a, b) => b.progress - a.progress)

    if (sortedGoals.length === 0) {
      return {
        answer: "No veo planificacion activas ahora mismo. Si creas una hoy, te ayudo a darle seguimiento semanal.",
        uiBlocks: [{ type: "kpi_card", title: "presupuesto recomendada", value: "Fondo de emergencia", tone: "info" }],
        actions: [{ label: "Crear presupuesto", href: "/planning", actionType: "navigate" }],
      }
    }

    const main = sortedGoals[0]
    return {
      answer: `Tu presupuesto mas avanzada es "${main.name}" con ${main.progress}%. Vas bien, te faltan ${formatCurrency(Math.max(0, main.target - main.current))}.`,
      uiBlocks: [
        { type: "kpi_card", title: "presupuesto lider", value: `${main.progress}% completado`, tone: "success" },
      ],
      actions: [{ label: "Ver mis planificacion", href: "/planning", actionType: "navigate" }],
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
        ? `Esta semana puedes apartar alrededor de ${formatCurrency(suggestion)} sin forzarte. Hazlo en una presupuesto y te doy seguimiento.`
        : "Esta semana estas justo. Primero recorta una categoria variable y luego apartamos un monto realista.",
      uiBlocks: [
        { type: "kpi_card", title: "Ahorro sugerido semanal", value: formatCurrency(Math.max(0, suggestion)), tone: suggestion > 0 ? "success" : "warning" },
      ],
      actions: [{ label: "Crear presupuesto", href: "/planning", actionType: "navigate" }],
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
    answer: "Te puedo ayudar con gastos, planificacion, FinScore y comparativas del mes. Dime que quieres optimizar hoy.",
    uiBlocks: [{ type: "kpi_card", title: "Sugerencia", value: "Prueba: Como voy este mes", tone: "info" }],
    actions: [{ label: "Ver mis planificacion", href: "/planning", actionType: "navigate" }],
  }
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

