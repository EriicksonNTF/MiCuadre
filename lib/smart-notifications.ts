import type { Account, Transaction, Goal } from "@/lib/types/database"
import { getLocalDateString } from "@/lib/data"
import { isReportableIncome } from "@/lib/transactions/reporting"
import type { BudgetWithUsage, DebtWithProgress } from "@/types/planning"

export type SmartNotificationType =
  | "daily_reminder"
  | "budget_warning"
  | "goal_progress"
  | "credit_cutoff"
  | "credit_payment"
  | "streak_alert"
  | "spending_insight"
  | "no_activity"
  | "budget_near_limit"
  | "budget_exceeded"
  | "subscription_due_tomorrow"
  | "debt_due_this_week"
  | "debt_overdue"

export type SmartNotification = {
  id: string
  type: SmartNotificationType
  title: string
  body: string
  action?: string
  priority: "high" | "medium" | "low"
  scheduled?: string
}

function getLast7Days(transactions: Transaction[]): Transaction[] {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 7)
  const cutoffStr = cutoff.toISOString().split("T")[0]
  return transactions.filter((t) => t.date && t.date >= cutoffStr)
}

function getDaysSinceLastTransaction(transactions: Transaction[]): number {
  if (transactions.length === 0) return 999
  const sorted = [...transactions].sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime())
  const lastDate = new Date(sorted[0].date!)
  const today = new Date()
  return Math.ceil((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
}

function getTotalIncome(transactions: Transaction[]): number {
  return transactions.filter((t) => t.type === "income" && isReportableIncome(t.metadata)).reduce((sum, t) => sum + Number(t.amount), 0)
}

function getTotalExpenses(transactions: Transaction[]): number {
  return transactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + Number(t.amount), 0)
}

export function generateSmartNotifications(
  transactions: Transaction[],
  accounts: Account[],
  goals: Goal[],
  planning?: {
    budgets?: BudgetWithUsage[]
    debts?: DebtWithProgress[]
    subscriptions?: Array<{ name: string; amount: number; currency: "DOP" | "USD"; next_payment_date: string | null }>
  }
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
    notifications.push({
      id: `${today}-daily-reminder-${daysSinceLast}`,
      type: "daily_reminder",
      title: "Sin actividad hoy",
      body: `Hace ${daysSinceLast} dias que no registras movimientos.`,
      action: "Registrar ahora",
      priority: daysSinceLast >= 3 ? "high" : "medium",
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
          title: "Tasa de ahorro positiva",
          body: `Esta semana estas ahorrando el ${savingsRate}% de tus ingresos.`,
          priority: "low",
        })
      }
    }
  }

  const activeGoals = goals.filter((g) => !g.is_completed)
  activeGoals.forEach((goal) => {
    const progress = Number(goal.current_amount) / Number(goal.target_amount)
    if (progress >= 0.75 && progress < 1) {
      notifications.push({
        id: `${today}-goal-near-${goal.id}`,
        type: "goal_progress",
        title: `Casi llegar a ${goal.name}`,
        body: `Llevas el ${Math.round(progress * 100)}% de tu objetivo.`,
        action: "Ver planificacion",
        priority: "medium",
      })
    }
  })

  const creditAccounts = accounts.filter((a) => a.type === "credit")
  const now = new Date()
  creditAccounts.forEach((account) => {
    const closingDay = Number(account.closing_day ?? 0)
    if (closingDay >= 1 && closingDay <= 31) {
      const cutoff = new Date(now.getFullYear(), now.getMonth(), Math.min(closingDay, 28))
      if (cutoff.getTime() < now.getTime()) cutoff.setMonth(cutoff.getMonth() + 1)
      const daysUntilCutoff = Math.ceil((new Date(cutoff.toDateString()).getTime() - new Date(now.toDateString()).getTime()) / (1000 * 60 * 60 * 24))
      if (daysUntilCutoff === 3) {
        notifications.push({
          id: `${today}-credit-cutoff-${account.id}`,
          type: "credit_cutoff",
          title: "Pago de tarjeta en 3 dias",
          body: `Tu tarjeta ${account.name} vence pronto.`,
          action: "Pagar tarjeta",
          priority: "high",
        })
      }
    }

    if (account.statement_due_date && Number(account.pending_amount ?? 0) > 0) {
      const due = new Date(`${account.statement_due_date}T12:00:00`)
      const daysUntilDue = Math.ceil((new Date(due.toDateString()).getTime() - new Date(now.toDateString()).getTime()) / (1000 * 60 * 60 * 24))
      if (daysUntilDue === 3) {
        notifications.push({
          id: `${today}-credit-payment-${account.id}`,
          type: "credit_payment",
          title: "Pago de tarjeta en 3 dias",
          body: `Pendiente: RD$${Number(account.pending_amount ?? 0).toLocaleString("es-DO")}.`,
          action: "Pagar tarjeta",
          priority: "high",
        })
      }
    }
  })

  const budgets = planning?.budgets || []
  budgets.forEach((budget) => {
    if (budget.percentage >= 100) {
      notifications.push({
        id: `${today}-budget-exceeded-${budget.id}`,
        type: "budget_exceeded",
        title: "Presupuesto excedido",
        body: `Te pasaste del presupuesto de ${budget.category_name} por RD$${Math.max(0, budget.spent - budget.amount).toLocaleString("es-DO")}.`,
        priority: "high",
      })
    } else if (budget.percentage >= 80) {
      notifications.push({
        id: `${today}-budget-near-${budget.id}`,
        type: "budget_near_limit",
        title: "Presupuesto cerca del limite",
        body: `${budget.category_name} va por ${Math.round(budget.percentage)}%.`,
        priority: "medium",
      })
    }
  })

  const subscriptions = planning?.subscriptions || []
  subscriptions.forEach((sub, i) => {
    if (!sub.next_payment_date) return
    const due = new Date(`${sub.next_payment_date}T12:00:00`)
    const days = Math.ceil((new Date(due.toDateString()).getTime() - new Date(now.toDateString()).getTime()) / (1000 * 60 * 60 * 24))
    if (days === 1) {
      notifications.push({
        id: `${today}-sub-tomorrow-${i}`,
        type: "subscription_due_tomorrow",
        title: "Suscripcion manana",
        body: `${sub.name} se cobrara manana.`,
        priority: "medium",
      })
    }
  })

  const debts = planning?.debts || []
  debts.forEach((debt) => {
    if (!debt.next_payment_date) return
    const due = new Date(`${debt.next_payment_date}T12:00:00`)
    const days = Math.ceil((new Date(due.toDateString()).getTime() - new Date(now.toDateString()).getTime()) / (1000 * 60 * 60 * 24))
    if (days < 0) {
      notifications.push({
        id: `${today}-debt-overdue-${debt.id}`,
        type: "debt_overdue",
        title: "Pago vencido",
        body: `Este pago de ${debt.name} esta vencido.`,
        priority: "high",
      })
    } else if (days <= 7) {
      notifications.push({
        id: `${today}-debt-week-${debt.id}`,
        type: "debt_due_this_week",
        title: "Deuda proxima",
        body: `Tu cuota de ${debt.name} vence en ${days} dias.`,
        action: "Pagar cuota",
        priority: "medium",
      })
    }
  })

  return notifications
}

export function getNotificationPreferences(): Record<SmartNotificationType, { label: string; description: string; defaultEnabled: boolean }> {
  return {
    daily_reminder: { label: "Recordatorios diarios", description: "Mensajes para mantener tu actividad", defaultEnabled: true },
    budget_warning: { label: "Alertas de presupuesto", description: "Cuando te acercas a gastar de mas", defaultEnabled: true },
    goal_progress: { label: "Progreso de objetivos", description: "Cuando un objetivo esta cerca", defaultEnabled: true },
    credit_cutoff: { label: "Corte de tarjeta", description: "Dias antes del cierre del ciclo", defaultEnabled: true },
    credit_payment: { label: "Pago de tarjeta", description: "Recordatorio antes de la fecha de pago", defaultEnabled: true },
    streak_alert: { label: "Alertas de racha", description: "Cuando tu racha esta en riesgo", defaultEnabled: false },
    spending_insight: { label: "Insights de gasto", description: "Analisis semanal de gasto", defaultEnabled: false },
    no_activity: { label: "Reactivacion", description: "Cuando llevas dias sin registrar", defaultEnabled: true },
    budget_near_limit: { label: "Presupuesto cerca del limite", description: "Cuando un presupuesto pasa 80%", defaultEnabled: true },
    budget_exceeded: { label: "Presupuesto excedido", description: "Cuando te pasas del presupuesto", defaultEnabled: true },
    subscription_due_tomorrow: { label: "Suscripcion manana", description: "Aviso un dia antes", defaultEnabled: true },
    debt_due_this_week: { label: "Cuota esta semana", description: "Cuando una deuda vence en 7 dias", defaultEnabled: true },
    debt_overdue: { label: "Pago vencido", description: "Cuando una deuda queda atrasada", defaultEnabled: true },
  }
}

export function filterEnabledNotifications(notifications: SmartNotification[], enabledTypes: Set<SmartNotificationType>): SmartNotification[] {
  return notifications.filter((n) => enabledTypes.has(n.type))
}
