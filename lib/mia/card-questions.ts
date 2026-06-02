import { formatCurrency } from "@/lib/data"
import type { CoachResponse } from "@/lib/coach-ia"
import type { CardFinancialSnapshot, CardInfo } from "@/lib/mia/card-snapshot"

export type CardQuestionIntent =
  | "current_balance"
  | "available_credit"
  | "minimum_payment"
  | "total_debt"
  | "pay_full_statement"
  | "cycle_status"
  | "credit_utilization"
  | "interest_calculation"
  | "days_until_due"
  | "payment_recommendation"

export type CardQuestionMatch = {
  intent: CardQuestionIntent
  confidence: number
  matchedCard: CardInfo | null
}

type QuestionHandler = (
  snapshot: CardFinancialSnapshot,
  matchedCard: CardInfo | null,
) => CoachResponse

type CardQuestionDef = {
  id: CardQuestionIntent
  label: string
  patterns: RegExp[]
  handler: QuestionHandler
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function pickCard(snapshot: CardFinancialSnapshot, q: string): CardInfo | null {
  if (!snapshot.hasCards) return null
  const namedMatch = snapshot.cards.find((c) => {
    const name = normalizeText(c.name)
    const bank = normalizeText(c.bankName ?? "")
    return q.includes(name) || q.includes(bank)
  })
  if (namedMatch) return namedMatch
  const sorted = [...snapshot.cards].sort((a, b) => {
    const debtA = a.currentDebtDop + a.currentDebtUsd
    const debtB = b.currentDebtDop + b.currentDebtUsd
    return debtB - debtA
  })
  return sorted[0]
}

function findActiveCycle(card: CardInfo) {
  const openCycles = card.cycles.filter((c) => c.status === "open")
  if (openCycles.length > 0) return openCycles[0]
  return card.cycles[0] ?? null
}

function noCardsResponse(): CoachResponse {
  return {
    answer: "No tienes tarjetas de credito registradas todavia. Agrega una en Cuentas para que pueda ayudarte con tus consultas de tarjetas.",
    uiBlocks: [
      { type: "kpi_card", title: "Siguiente paso", value: "Agregar tarjeta de credito", tone: "info" },
    ],
    actions: [{ label: "Ir a cuentas", href: "/accounts", actionType: "navigate" }],
  }
}

function cardSummaryBlocks(card: CardInfo, snapshot: CardFinancialSnapshot) {
  return [
    {
      type: "kpi_card" as const,
      title: "Deuda total",
      value: `${formatCurrency(card.currentDebtDop)} DOP + ${formatCurrency(card.currentDebtUsd)} USD`,
      tone: "warning" as const,
    },
    {
      type: "kpi_card" as const,
      title: "Credito disponible",
      value: `${formatCurrency(card.availableCreditDop)} DOP / ${formatCurrency(card.availableCreditUsd)} USD`,
      tone: "success" as const,
    },
    {
      type: "kpi_card" as const,
      title: "Balance al corte",
      value: `${formatCurrency(card.statementBalanceDop)} DOP + ${formatCurrency(card.statementBalanceUsd)} USD`,
      tone: "info" as const,
    },
  ]
}

// --- 10 HANDLERS ---

const handleCurrentBalance: QuestionHandler = (snapshot, matchedCard) => {
  if (!snapshot.hasCards || !matchedCard) return noCardsResponse()
  const total = matchedCard.currentDebtDop + matchedCard.currentDebtUsd
  return {
    answer: `${matchedCard.name} tiene un saldo actual de ${formatCurrency(matchedCard.currentDebtDop)} DOP y ${formatCurrency(matchedCard.currentDebtUsd)} USD. En total: ${formatCurrency(total)} combinados.`,
    uiBlocks: [
      { type: "kpi_card", title: "Saldo actual DOP", value: formatCurrency(matchedCard.currentDebtDop), tone: "warning" },
      { type: "kpi_card", title: "Saldo actual USD", value: formatCurrency(matchedCard.currentDebtUsd), tone: "warning" },
    ],
    actions: [{ label: "Ver cuentas", href: "/accounts", actionType: "navigate" }],
  }
}

const handleAvailableCredit: QuestionHandler = (snapshot, matchedCard) => {
  if (!snapshot.hasCards || !matchedCard) return noCardsResponse()
  const totalDop = matchedCard.creditLimitDop
  const usedDop = matchedCard.currentDebtDop
  const availDop = matchedCard.availableCreditDop
  const usedPctDop = totalDop > 0 ? Math.round((usedDop / totalDop) * 100) : 0

  const totalUsd = matchedCard.creditLimitUsd
  const usedUsd = matchedCard.currentDebtUsd
  const availUsd = matchedCard.availableCreditUsd
  const usedPctUsd = totalUsd > 0 ? Math.round((usedUsd / totalUsd) * 100) : 0

  const lines: string[] = []
  if (totalDop > 0) lines.push(`${formatCurrency(availDop)} DOP disponibles de ${formatCurrency(totalDop)} (${usedPctDop}% usado)`)
  if (totalUsd > 0) lines.push(`${formatCurrency(availUsd)} USD disponibles de ${formatCurrency(totalUsd)} (${usedPctUsd}% usado)`)

  return {
    answer: `Credito disponible en ${matchedCard.name}:\n${lines.join("\n")}`,
    uiBlocks: [
      { type: "kpi_card", title: "Disponible DOP", value: formatCurrency(availDop), tone: "success" },
      { type: "kpi_card", title: "Disponible USD", value: formatCurrency(availUsd), tone: "success" },
    ],
    actions: [{ label: "Ver cuentas", href: "/accounts", actionType: "navigate" }],
  }
}

const handleMinimumPayment: QuestionHandler = (snapshot, matchedCard) => {
  if (!snapshot.hasCards || !matchedCard) return noCardsResponse()
  const pct = matchedCard.minimumPaymentPercentage
  const minDop = Math.round(matchedCard.statementBalanceDop * pct)
  const minUsd = Math.round(matchedCard.statementBalanceUsd * pct)
  const hasFinanced = matchedCard.financedBalanceDop > 0 || matchedCard.financedBalanceUsd > 0

  let answer = `El pago minimo de ${matchedCard.name} es ${formatCurrency(Math.max(minDop, 1))} DOP`
  if (minUsd > 0) answer += ` y ${formatCurrency(Math.max(minUsd, 1))} USD`
  answer += ` (${(pct * 100).toFixed(2)}% del saldo al corte).`
  if (hasFinanced) {
    answer += ` Incluye ${formatCurrency(matchedCard.financedBalanceDop)} DOP + ${formatCurrency(matchedCard.financedBalanceUsd)} USD en balance financiado.`
  }

  return {
    answer,
    uiBlocks: [
      { type: "kpi_card", title: "Pago minimo DOP", value: formatCurrency(Math.max(minDop, 1)), tone: "info" },
      { type: "kpi_card", title: "Pago minimo USD", value: formatCurrency(Math.max(minUsd, 1)), tone: "info" },
    ],
    actions: [{ label: "Pagar tarjeta", href: "/pay", actionType: "navigate" }],
  }
}

const handleTotalDebt: QuestionHandler = (snapshot) => {
  if (!snapshot.hasCards) return noCardsResponse()
  const cardCount = snapshot.cards.length
  const details = snapshot.cards.map((c) =>
    `${c.name}: ${formatCurrency(c.currentDebtDop)} DOP + ${formatCurrency(c.currentDebtUsd)} USD`
  ).join("\n")

  return {
    answer: `Tu deuda total en tarjetas de credito es ${formatCurrency(snapshot.totalDebtDop)} DOP + ${formatCurrency(snapshot.totalDebtUsd)} USD combinados en ${cardCount} tarjeta${cardCount > 1 ? "s" : ""}.\n\n${details}`,
    uiBlocks: [
      { type: "kpi_card", title: "Deuda total DOP", value: formatCurrency(snapshot.totalDebtDop), tone: "warning" },
      { type: "kpi_card", title: "Deuda total USD", value: formatCurrency(snapshot.totalDebtUsd), tone: "warning" },
    ],
    actions: [
      { label: "Ver cuentas", href: "/accounts", actionType: "navigate" },
      { label: "Pagar", href: "/pay", actionType: "navigate" },
    ],
  }
}

const handlePayFullStatement: QuestionHandler = (snapshot, matchedCard) => {
  if (!snapshot.hasCards || !matchedCard) return noCardsResponse()
  let answer: string
  let tone: "success" | "warning" | "info" = "info"

  const totalStatement = matchedCard.statementBalanceDop + matchedCard.statementBalanceUsd
  if (totalStatement === 0) {
    answer = `${matchedCard.name} no tiene saldo pendiente al corte. Estas al dia, no necesitas hacer pago para evitar intereses.`
    tone = "success"
  } else {
    const details: string[] = []
    if (matchedCard.statementBalanceDop > 0) details.push(`${formatCurrency(matchedCard.statementBalanceDop)} DOP`)
    if (matchedCard.statementBalanceUsd > 0) details.push(`${formatCurrency(matchedCard.statementBalanceUsd)} USD`)
    answer = `Para dejar ${matchedCard.name} en cero y evitar intereses, el pago del corte es ${details.join(" + ")}.`
    tone = "warning"
  }

  return {
    answer,
    uiBlocks: [
      { type: "kpi_card", title: "Pago para saldo en cero", value: `${formatCurrency(matchedCard.statementBalanceDop)} DOP + ${formatCurrency(matchedCard.statementBalanceUsd)} USD`, tone },
    ],
    actions: [{ label: "Pagar tarjeta", href: "/pay", actionType: "navigate" }],
  }
}

const handleCycleStatus: QuestionHandler = (snapshot, matchedCard) => {
  if (!snapshot.hasCards || !matchedCard) return noCardsResponse()
  const activeCycle = findActiveCycle(matchedCard)
  const closingDay = matchedCard.closingDay ?? "—"
  const dueDate = matchedCard.statementDueDate ?? "—"
  const lastCutoff = matchedCard.lastStatementCutoffDate ?? "—"

  let cycleInfo = `Ciclo de ${matchedCard.name}: corte los días ${closingDay}, pago ${matchedCard.dueDaysAfterCutoff ?? "—"} dias despues.`
  if (activeCycle) {
    cycleInfo += ` Ciclo actual: ${activeCycle.cycle_start_date} a ${activeCycle.cycle_end_date}. Vence: ${activeCycle.due_date}.`
  }
  cycleInfo += ` Ultimo corte: ${lastCutoff}. Proximo pago: ${dueDate}.`

  const statusLabel = activeCycle
    ? activeCycle.status === "open"
      ? "Ciclo en curso"
      : `Estado: ${activeCycle.status}`
    : "Sin ciclo activo"

  return {
    answer: cycleInfo,
    uiBlocks: [
      { type: "kpi_card", title: statusLabel, value: `Corte dia ${closingDay} · Pago: ${dueDate}`, tone: "info" },
    ],
    actions: [{ label: "Ver cuentas", href: "/accounts", actionType: "navigate" }],
  }
}

const handleCreditUtilization: QuestionHandler = (snapshot, matchedCard) => {
  if (!snapshot.hasCards || !matchedCard) return noCardsResponse()

  const utilDop = matchedCard.creditLimitDop > 0
    ? Math.round((matchedCard.currentDebtDop / matchedCard.creditLimitDop) * 100)
    : 0
  const utilUsd = matchedCard.creditLimitUsd > 0
    ? Math.round((matchedCard.currentDebtUsd / matchedCard.creditLimitUsd) * 100)
    : 0

  const avgUtil = (matchedCard.creditLimitDop + matchedCard.creditLimitUsd) > 0
    ? Math.round(((matchedCard.currentDebtDop + matchedCard.currentDebtUsd) / (matchedCard.creditLimitDop + matchedCard.creditLimitUsd)) * 100)
    : 0

  let advice = ""
  if (avgUtil > 80) advice = " Estas usando mas del 80% de tu limite, lo que puede afectar tu salud financiera. Intenta reducir tu saldo."
  else if (avgUtil > 50) advice = " Tu uso de credito es moderado (entre 50-80%). Mantenlo bajo control."
  else advice = " Excelente. Usas menos del 50% de tu credito. Buen manejo."

  return {
    answer: `Uso del credito en ${matchedCard.name}: ${utilDop}% DOP y ${utilUsd}% USD. En general: ${avgUtil}%.${advice}`,
    uiBlocks: [
      { type: "kpi_card", title: "Uso de credito DOP", value: `${utilDop}%`, tone: utilDop > 80 ? "warning" : "success" },
      { type: "kpi_card", title: "Uso de credito USD", value: `${utilUsd}%`, tone: utilUsd > 80 ? "warning" : "success" },
    ],
    actions: [{ label: "Ver cuentas", href: "/accounts", actionType: "navigate" }],
  }
}

const handleInterestCalculation: QuestionHandler = (snapshot, matchedCard) => {
  if (!snapshot.hasCards || !matchedCard) return noCardsResponse()
  const annualRate = matchedCard.annualInterestRate
  if (annualRate <= 0) {
    return {
      answer: `${matchedCard.name} no tiene tasa de interes configurada. No puedo calcular intereses.`,
      uiBlocks: [
        { type: "kpi_card", title: "Tasa de interes", value: "No configurada", tone: "info" },
      ],
      actions: [{ label: "Ver cuentas", href: "/accounts", actionType: "navigate" }],
    }
  }

  const monthlyRate = annualRate / 12
  const monthlyInterestDop = Math.round(matchedCard.financedBalanceDop * monthlyRate)
  const monthlyInterestUsd = Math.round(matchedCard.financedBalanceUsd * monthlyRate)

  return {
    answer: `${matchedCard.name} tiene una tasa de interes anual de ${(annualRate * 100).toFixed(2)}%.\nInteres mensual estimado sobre balance financiado: ${formatCurrency(monthlyInterestDop)} DOP y ${formatCurrency(monthlyInterestUsd)} USD.\nBalance financiado: ${formatCurrency(matchedCard.financedBalanceDop)} DOP + ${formatCurrency(matchedCard.financedBalanceUsd)} USD.`,
    uiBlocks: [
      { type: "kpi_card", title: "Interes mensual DOP", value: formatCurrency(monthlyInterestDop), tone: "warning" },
      { type: "kpi_card", title: "Interes mensual USD", value: formatCurrency(monthlyInterestUsd), tone: "warning" },
    ],
    actions: [
      { label: "Pagar tarjeta", href: "/pay", actionType: "navigate" },
      { label: "Ver cuentas", href: "/accounts", actionType: "navigate" },
    ],
    disclaimer: "Interes estimado. Tu tasa efectiva puede variar segun el ciclo y las compras del periodo.",
  }
}

const handleDaysUntilDue: QuestionHandler = (snapshot, matchedCard) => {
  if (!snapshot.hasCards || !matchedCard) return noCardsResponse()
  const dueDateStr = matchedCard.statementDueDate
  if (!dueDateStr) {
    return {
      answer: `${matchedCard.name} no tiene una fecha de pago registrada. Revisa la configuracion de la tarjeta.`,
      uiBlocks: [
        { type: "kpi_card", title: "Fecha de pago", value: "No configurada", tone: "info" },
      ],
      actions: [{ label: "Ir a cuentas", href: "/accounts", actionType: "navigate" }],
    }
  }

  const now = new Date()
  const dueDate = new Date(`${dueDateStr}T23:59:59`)
  const diffMs = dueDate.getTime() - now.getTime()
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  let message: string
  let tone: "success" | "warning" | "info"
  if (daysRemaining < 0) {
    const overdue = Math.abs(daysRemaining)
    message = `El pago de ${matchedCard.name} vencio hace ${overdue} dia${overdue > 1 ? "s" : ""}. Te recomiendo pagar cuanto antes para evitar cargos adicionales.`
    tone = "warning"
  } else if (daysRemaining <= 3) {
    message = `El pago de ${matchedCard.name} vence en ${daysRemaining} dia${daysRemaining > 1 ? "s" : ""}. Estas a tiempo, pero no lo dejes pasar.`
    tone = "warning"
  } else {
    message = `${matchedCard.name} tiene ${daysRemaining} dias para pagar antes del vencimiento (${dueDateStr}).`
    tone = "success"
  }

  return {
    answer: message,
    uiBlocks: [
      { type: "kpi_card", title: "Dias para pagar", value: daysRemaining < 0 ? `Vencido hace ${Math.abs(daysRemaining)} dias` : `${daysRemaining} dias`, tone },
    ],
    actions: [{ label: "Pagar ahora", href: "/pay", actionType: "navigate" }],
  }
}

const handlePaymentRecommendation: QuestionHandler = (snapshot, matchedCard) => {
  if (!snapshot.hasCards || !matchedCard) return noCardsResponse()

  const pct = matchedCard.minimumPaymentPercentage
  const minDop = Math.max(1, Math.round(matchedCard.statementBalanceDop * pct))
  const minUsd = Math.max(1, Math.round(matchedCard.statementBalanceUsd * pct))
  const fullStatementDop = matchedCard.statementBalanceDop
  const fullStatementUsd = matchedCard.statementBalanceUsd
  const hasFinanced = matchedCard.financedBalanceDop > 0 || matchedCard.financedBalanceUsd > 0

  const lines: string[] = []
  lines.push(`Recomendacion de pago para ${matchedCard.name}:\n`)
  lines.push(`- Pago minimo: ${formatCurrency(minDop)} DOP + ${formatCurrency(minUsd)} USD`)
  lines.push(`- Pago del corte: ${formatCurrency(fullStatementDop)} DOP + ${formatCurrency(fullStatementUsd)} USD`)
  if (hasFinanced) {
    lines.push(`- Pago total (corte + financiado): ${formatCurrency(fullStatementDop + matchedCard.financedBalanceDop)} DOP + ${formatCurrency(fullStatementUsd + matchedCard.financedBalanceUsd)} USD`)
  }

  let recommendation: string
  if (hasFinanced) {
    recommendation = `Recomiendo pagar el corte completo (${formatCurrency(fullStatementDop)} DOP + ${formatCurrency(fullStatementUsd)} USD) para detener nuevos intereses. Si puedes, aporta al balance financiado tambien.`
  } else if (fullStatementDop > 0 || fullStatementUsd > 0) {
    recommendation = `Recomiendo pagar el corte completo (${formatCurrency(fullStatementDop)} DOP + ${formatCurrency(fullStatementUsd)} USD) para evitar intereses este mes.`
  } else {
    recommendation = `No tienes saldo pendiente al corte. Solo mantente al dia.`
  }

  return {
    answer: `${lines.join("\n")}\n\n${recommendation}`,
    uiBlocks: [
      { type: "kpi_card", title: "Pago minimo", value: `${formatCurrency(minDop)} DOP + ${formatCurrency(minUsd)} USD`, tone: "info" },
      { type: "kpi_card", title: "Pago recomendado", value: `${formatCurrency(fullStatementDop)} DOP + ${formatCurrency(fullStatementUsd)} USD`, tone: "success" },
    ],
    actions: [
      { label: "Pagar tarjeta", href: "/pay", actionType: "navigate" },
      { label: "Ver cuentas", href: "/accounts", actionType: "navigate" },
    ],
    disclaimer: "Esta es una recomendacion general. Consulta con tu banco los terminos exactos de tu tarjeta.",
  }
}

// --- QUESTION DEFINITIONS ---

export const CARD_QUESTIONS: CardQuestionDef[] = [
  {
    id: "current_balance",
    label: "¿Cual es el saldo actual de mi tarjeta?",
    patterns: [
      /cual (es )?el saldo (actual )?(de )?(mi )?tarjeta/i,
      /cuanto (tengo|debo) (en|de) (mi )?(tarjeta|credito)/i,
      /saldo (actual )?(de )?(mi )?tarjeta/i,
      /cuanto (tengo )?que pagar (en )?(mi )?tarjeta/i,
    ],
    handler: handleCurrentBalance,
  },
  {
    id: "available_credit",
    label: "¿Cuanto credito disponible tengo?",
    patterns: [
      /credito disponible/i,
      /cuanto (me )?(queda|queda disponible|tengo disponible) (de )?(mi )?credito/i,
      /limite (de )?credito disponible/i,
      /cuanto (puedo |me queda de )?usar (de )?(mi )?tarjeta/i,
    ],
    handler: handleAvailableCredit,
  },
  {
    id: "minimum_payment",
    label: "¿Cuanto es el pago minimo de mi tarjeta?",
    patterns: [
      /pago minimo/i,
      /pago minimo (de )?(mi )?tarjeta/i,
      /cuanto (es )?el pago minimo/i,
      /minimo a pagar/i,
    ],
    handler: handleMinimumPayment,
  },
  {
    id: "total_debt",
    label: "¿Cuanto debo en total de mis tarjetas?",
    patterns: [
      /cuanto debo (en |de )?total/i,
      /deuda total (en )?tarjeta/i,
      /cuanto (debo|tengo) (en )?todas (mis )?tarjeta/i,
      /total de (mi )?deuda/i,
    ],
    handler: handleTotalDebt,
  },
  {
    id: "pay_full_statement",
    label: "¿Cuanto es el pago para mantener saldo en cero?",
    patterns: [
      /pago para saldo (en )?cero/i,
      /cuanto (necesito|tengo que|debo) pagar para (dejar|tener) (saldo )?cero/i,
      /pago (del|de )corte/i,
      /saldo al corte/i,
      /balance al corte/i,
    ],
    handler: handlePayFullStatement,
  },
  {
    id: "cycle_status",
    label: "¿Cual es el estado de mi ciclo de facturacion actual?",
    patterns: [
      /ciclo (de )?facturacion/i,
      /cuando (corta|cierra|empieza|termina) (mi )?tarjeta/i,
      /ciclo (actual )?(de )?(mi )?tarjeta/i,
      /corte (de )?(mi )?tarjeta/i,
    ],
    handler: handleCycleStatus,
  },
  {
    id: "credit_utilization",
    label: "¿Cuanto de mi limite de credito he usado?",
    patterns: [
      /(cuanto|que) (porcentaje|tanto) (de )?(mi )?limite (he )?usado/i,
      /uso (de )?credito/i,
      /cuanto (credito|porcentaje) (he )?usado/i,
      /utilizacion (de )?credito/i,
    ],
    handler: handleCreditUtilization,
  },
  {
    id: "interest_calculation",
    label: "¿A cuanto van los intereses de mi tarjeta?",
    patterns: [
      /interes.*tarjeta/i,
      /cuanto (pago|estoy pagando|seria) (de )?interes/i,
      /interes (mensual|anual|financiamiento)/i,
      /tasa (de )?interes/i,
    ],
    handler: handleInterestCalculation,
  },
  {
    id: "days_until_due",
    label: "¿Cuantos dias me quedan para pagar?",
    patterns: [
      /cuanto(s)? (dias|tiempo) (me )?queda/i,
      /dias para (pagar|vencer|el pago)/i,
      /cuando (vence|pago) (mi )?tarjeta/i,
      /cuanto (falta|resta) para (el )?pago/i,
    ],
    handler: handleDaysUntilDue,
  },
  {
    id: "payment_recommendation",
    label: "Recomendacion de pago para mi tarjeta",
    patterns: [
      /recomendacion de pago/i,
      /que me recomienda pagar/i,
      /cuanto deberia pagar/i,
      /pago (recomendado|sugerido)/i,
    ],
    handler: handlePaymentRecommendation,
  },
]

// --- INTENT DETECTION ---

export function detectCardQuestion(message: string): CardQuestionMatch | null {
  const q = normalizeText(message)
  let bestMatch: CardQuestionMatch | null = null

  for (const question of CARD_QUESTIONS) {
    for (const pattern of question.patterns) {
      if (pattern.test(q)) {
        const confidence = 0.8
        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = {
            intent: question.id,
            confidence,
            matchedCard: null,
          }
        }
        break
      }
    }
  }

  return bestMatch
}

export function resolveCardQuestion(
  intent: CardQuestionMatch,
  snapshot: CardFinancialSnapshot,
  message: string,
): CoachResponse {
  const matchedCard = pickCard(snapshot, message)
  intent.matchedCard = matchedCard
  const def = CARD_QUESTIONS.find((q) => q.id === intent.intent)
  if (!def) {
    return {
      answer: "No pude identificar la pregunta sobre tu tarjeta. Intenta ser mas especifico.",
      uiBlocks: [],
      actions: [],
    }
  }
  return def.handler(snapshot, matchedCard)
}
