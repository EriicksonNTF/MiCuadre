import type { Account, Transaction, Goal } from "@/lib/types/database"
import { getLocalDateString } from "@/lib/data"

export type SmartNotificationType =
  | "daily_reminder"
  | "budget_warning"
  | "goal_progress"
  | "credit_cutoff"
  | "credit_payment"
  | "streak_alert"
  | "spending_insight"
  | "no_activity"

export type SmartNotification = {
  id: string
  type: SmartNotificationType
  title: string
  body: string
  action?: string
  priority: "high" | "medium" | "low"
  scheduled?: string
}

const TYPES_ENABLED = {
  daily_reminder: true,
  budget_warning: true,
  goal_progress: true,
  credit_cutoff: true,
  credit_payment: true,
  streak_alert: true,
  spending_insight: true,
  no_activity: true,
}

function getLast7Days(transactions: Transaction[]): Transaction[] {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 7)
  const cutoffStr = cutoff.toISOString().split("T")[0]

  return transactions.filter((t) => t.date && t.date >= cutoffStr)
}

function getLast30Days(transactions: Transaction[]): Transaction[] {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)
  const cutoffStr = cutoff.toISOString().split("T")[0]

  return transactions.filter((t) => t.date && t.date >= cutoffStr)
}

function getDaysSinceLastTransaction(transactions: Transaction[]): number {
  if (transactions.length === 0) return 999

  const sorted = [...transactions].sort(
    (a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime()
  )
  const lastDate = new Date(sorted[0].date!)
  const today = new Date()
  return Math.ceil(
    (today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
  )
}

function getDaysWithTransactionsInRange(
  transactions: Transaction[],
  days: number
): number {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().split("T")[0]

  const uniqueDays = new Set<string>()
  transactions
    .filter((t) => t.date && t.date >= cutoffStr)
    .forEach((t) => uniqueDays.add(t.date!.split("T")[0]))

  return uniqueDays.size
}

function getTotalByCategory(
  transactions: Transaction[],
  categoryId: string
): number {
  return transactions
    .filter((t) => t.category_id === categoryId && t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0)
}

function getTopSpendingCategory(
  transactions: Transaction[],
  days: number
): { name: string; amount: number; percentOfTotal: number } | null {
  const range = days === 7 ? getLast7Days(transactions) : getLast30Days(transactions)
  const expenses = range.filter((t) => t.type === "expense")

  if (expenses.length === 0) return null

  const total = expenses.reduce((sum, t) => sum + Number(t.amount), 0)

  const byCategory = new Map<string, number>()
  expenses.forEach((t) => {
    const key = t.category_id ?? "other"
    byCategory.set(key, (byCategory.get(key) ?? 0) + Number(t.amount))
  })

  let maxCategory = ""
  let maxAmount = 0
  byCategory.forEach((amount, categoryId) => {
    if (amount > maxAmount) {
      maxAmount = amount
      maxCategory = categoryId
    }
  })

  if (!maxCategory || maxAmount === 0) return null

  const categoryName = expenses.find(
    (t) => t.category_id === maxCategory
  )?.category?.name ?? "otra categoría"

  return {
    name: categoryName,
    amount: maxAmount,
    percentOfTotal: Math.round((maxAmount / total) * 100),
  }
}

function getTotalIncome(transactions: Transaction[]): number {
  return transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0)
}

function getTotalExpenses(transactions: Transaction[]): number {
  return transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0)
}

export function generateSmartNotifications(
  transactions: Transaction[],
  accounts: Account[],
  goals: Goal[]
): SmartNotification[] {
  const notifications: SmartNotification[] = []
  const today = getLocalDateString()

  if (transactions.length === 0) {
    notifications.push({
      id: `${today}-no-activity`,
      type: "no_activity",
      title: "Empieza hoy",
      body: "Registra tu primer gasto o ingreso para ver tu actividad en MiCuadre.",
      action: "Agregar movimiento",
      priority: "high",
    })
    return notifications
  }

  const daysSinceLast = getDaysSinceLastTransaction(transactions)

  if (daysSinceLast >= 2) {
    const streak = getDaysWithTransactionsInRange(transactions, 7)
    notifications.push({
      id: `${today}-daily-reminder-${daysSinceLast}`,
      type: "daily_reminder",
      title: streak > 0 ? `🔥 ${streak} días activos` : "Sin actividad hoy",
      body:
        daysSinceLast === 2
          ? "Hace 2 días que no registras. Agrega un gasto para mantener tu racha."
          : `Hace ${daysSinceLast} días. Tu actividad reciente está tranquila.`,
      action: "Registrar ahora",
      priority: daysSinceLast >= 3 ? "high" : "medium",
    })
  }

  const top7 = getTopSpendingCategory(transactions, 7)
  if (top7) {
    notifications.push({
      id: `${today}-spending-insight`,
      type: "spending_insight",
      title: `📊 ${top7.name} lidera`,
      body: `Esta semana has gastado RD$${top7.amount.toLocaleString(
        "es-DO"
      )} en ${top7.name}, el ${top7.percentOfTotal}% de tus gastos.`,
      priority: "low",
    })
  }

  const last7 = getLast7Days(transactions)
  if (last7.length >= 3) {
    const income7 = getTotalIncome(last7)
    const expenses7 = getTotalExpenses(last7)
    if (income7 > 0) {
      const savingsRate = Math.round(((income7 - expenses7) / income7) * 100)
      if (savingsRate > 10) {
        notifications.push({
          id: `${today}-good-savings`,
          type: "spending_insight",
          title: "💰 Tasa de ahorro positiva",
          body: `Esta semana estás ahorrando el ${savingsRate}% de tus ingresos. ¡Sigue así!`,
          priority: "low",
        })
      }
    }
  }

  const activeGoals = goals.filter((g) => !g.completed_at)
  if (activeGoals.length > 0) {
    activeGoals.forEach((goal) => {
      const progress = Number(goal.current_amount) / Number(goal.target_amount)
      if (progress >= 0.75 && progress < 1) {
        notifications.push({
          id: `${today}-goal-near-${goal.id}`,
          type: "goal_progress",
          title: `🎯 Casi llegar a ${goal.name}`,
          body: `Llevas el ${Math.round(
            progress * 100
          )}% de tu meta. ¡Ya casi llegas!`,
          action: "Ver meta",
          priority: "medium",
        })
      }
    })
  }

  const creditAccounts = accounts.filter((a) => a.type === "credit")
  if (creditAccounts.length > 0) {
    const now = new Date()
    creditAccounts.forEach((account) => {
      const closingDay = Number(account.closing_day ?? 0)
      if (closingDay >= 1 && closingDay <= 31) {
        const cutoff = new Date(now.getFullYear(), now.getMonth(), Math.min(closingDay, 28))
        if (cutoff.getTime() < now.getTime()) cutoff.setMonth(cutoff.getMonth() + 1)
        const daysUntilCutoff = Math.ceil(
          (new Date(cutoff.toDateString()).getTime() -
            new Date(now.toDateString()).getTime()) /
            (1000 * 60 * 60 * 24)
        )
        if (daysUntilCutoff === 3) {
          notifications.push({
            id: `${today}-credit-cutoff-${account.id}`,
            type: "credit_cutoff",
            title: `⚠️ Corte de ${account.name} en 3 días`,
            body: `Tu tarjeta ${account.name} cierra pronto. Revisa los consumos antes del corte.`,
            action: "Ver tarjeta",
            priority: "high",
          })
        }
      }

      if (
        account.statement_due_date &&
        Number(account.pending_amount ?? 0) > 0
      ) {
        const due = new Date(`${account.statement_due_date}T12:00:00`)
        const daysUntilDue = Math.ceil(
          (new Date(due.toDateString()).getTime() -
            new Date(now.toDateString()).getTime()) /
            (1000 * 60 * 60 * 24)
        )
        if (daysUntilDue === 5) {
          notifications.push({
            id: `${today}-credit-payment-${account.id}`,
            type: "credit_payment",
            title: `💳 Pago de ${account.name} en 5 días`,
            body: `Pendiente: RD$${Number(
              account.pending_amount ?? 0
            ).toLocaleString("es-DO")}. No olvides pagar a tiempo.`,
            action: "Pagar tarjeta",
            priority: "high",
          })
        }
      }
    })
  }

  return notifications
}

export function getNotificationPreferences(): Record<
  SmartNotificationType,
  { label: string; description: string; defaultEnabled: boolean }
> {
  return {
    daily_reminder: {
      label: "Recordatorios diarios",
      description: "Mensajes para mantener tu actividad de tracking",
      defaultEnabled: true,
    },
    budget_warning: {
      label: "Alertas de presupuesto",
      description: "Cuando te acercas a gastar de más",
      defaultEnabled: true,
    },
    goal_progress: {
      label: "Progreso de metas",
      description: "Cuando una meta está cerca de completarse",
      defaultEnabled: true,
    },
    credit_cutoff: {
      label: "Corte de tarjeta",
      description: "Días antes del cierre del ciclo",
      defaultEnabled: true,
    },
    credit_payment: {
      label: "Pago de tarjeta",
      description: "Recordatorio antes de la fecha de pago",
      defaultEnabled: true,
    },
    streak_alert: {
      label: "Alertas de racha",
      description: "Cuando tu racha de actividad está en riesgo",
      defaultEnabled: false,
    },
    spending_insight: {
      label: "Insights de gasto",
      description: "Análisis semanal de tus patrones de gasto",
      defaultEnabled: false,
    },
    no_activity: {
      label: "Reactivación",
      description: "Cuando llevas días sin registrar nada",
      defaultEnabled: true,
    },
  }
}

export function filterEnabledNotifications(
  notifications: SmartNotification[],
  enabledTypes: Set<SmartNotificationType>
): SmartNotification[] {
  return notifications.filter((n) => enabledTypes.has(n.type))
}
