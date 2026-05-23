import type { Account, FinancialSubscription, Goal, Transaction } from "@/lib/types/database"
import { formatCurrency } from "@/lib/data"

export type InsightType = "success" | "warning" | "info" | "danger"

export type FinancialInsight = {
  title: string
  message: string
  type: InsightType
  icon?: "spark" | "alert" | "chart" | "card" | "target"
}

type InsightInput = {
  transactions: Transaction[]
  previousTransactions?: Transaction[]
  accounts: Account[]
  subscriptions: FinancialSubscription[]
  goals?: Goal[]
}

export function generateFinancialInsights(input: InsightInput): FinancialInsight[] {
  const insights: FinancialInsight[] = []
  const expenses = input.transactions.filter((tx) => tx.type === "expense" && !(tx.metadata?.kind === "transfer" && tx.metadata?.transfer_type === "internal"))
  const incomes = input.transactions.filter((tx) => tx.type === "income" && !(tx.metadata?.kind === "transfer" && tx.metadata?.transfer_type === "internal"))
  const totalExpense = expenses.reduce((sum, tx) => sum + Number(tx.amount), 0)
  const totalIncome = incomes.reduce((sum, tx) => sum + Number(tx.amount), 0)
  const net = totalIncome - totalExpense

  if (input.transactions.length === 0) {
    return [{
      title: "Comienza tu control",
      message: "Agrega tus primeros movimientos para ver recomendaciones personalizadas.",
      type: "info",
      icon: "spark",
    }]
  }

  const expenseByCategory = new Map<string, number>()
  for (const tx of expenses) {
    const category = tx.category?.name || "Sin categoría"
    expenseByCategory.set(category, (expenseByCategory.get(category) || 0) + Number(tx.amount))
  }
  const topCategory = Array.from(expenseByCategory.entries()).sort((a, b) => b[1] - a[1])[0]
  const activeSubscriptions = input.subscriptions.filter((item) => item.status === "active")
  const monthlySubscriptions = activeSubscriptions.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  if (monthlySubscriptions > 0) {
    insights.push({
      title: "Suscripciones mensuales",
      message: `Tienes ${formatCurrency(monthlySubscriptions)} en suscripciones mensuales. Revisa si todas siguen siendo necesarias.`,
      type: monthlySubscriptions > Math.max(500, totalIncome * 0.15) ? "warning" : "info",
      icon: "card",
    })
  }

  const creditAccounts = input.accounts.filter((account) => account.type === "credit")
  for (const account of creditAccounts) {
    const limit = Number(account.credit_limit_dop || account.credit_limit || 0)
    const debt = Number(account.current_debt_dop || account.current_debt || 0)
    if (limit > 0 && debt / limit >= 0.7) {
      insights.push({
        title: "Uso alto de tarjeta",
        message: `Tu tarjeta ${account.name} está usando más del 70% del límite. Considera reducir el consumo.`,
        type: "warning",
        icon: "card",
      })
      break
    }
  }

  if (input.previousTransactions && input.previousTransactions.length > 0) {
    const prevExpenses = input.previousTransactions
      .filter((tx) => tx.type === "expense" && !(tx.metadata?.kind === "transfer" && tx.metadata?.transfer_type === "internal"))
      .reduce((sum, tx) => sum + Number(tx.amount), 0)
    if (prevExpenses > 0 && totalExpense < prevExpenses) {
      insights.push({
        title: "Buen progreso",
        message: "Buen progreso: estás ahorrando mejor que el período anterior.",
        type: "success",
        icon: "target",
      })
    }
  }

  return insights.slice(0, 5)
}
