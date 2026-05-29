import { formatCurrency } from "@/lib/data"
import { isReportableIncome } from "@/lib/transactions/reporting"
import type { Account, Goal, Transaction } from "@/lib/types/database"

export type MiaSnapshot = {
  accounts: Account[]
  goals: Goal[]
  transactions: Transaction[]
}

export type MonthSummary = {
  income: number
  expense: number
  remainingDays: number
  runwayDays: number
}

function toDate(value: string) {
  return new Date(`${value}T12:00:00`)
}

function getMonthBounds(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return { start, prevStart, next }
}

export function getMonthSummary(snapshot: MiaSnapshot): MonthSummary {
  const { start, next } = getMonthBounds(new Date())
  const thisMonth = snapshot.transactions.filter((tx) => {
    const date = toDate(tx.date)
    return date >= start && date < next
  })

  const income = thisMonth
    .filter((tx) => tx.type === "income" && isReportableIncome(tx.metadata))
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0)
  const expense = thisMonth
    .filter((tx) => tx.type === "expense")
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0)

  const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()
  const today = new Date().getDate()
  const remainingDays = Math.max(1, daysInMonth - today)
  const avgDailyExpense = expense / Math.max(1, today)
  const available = Math.max(0, income - expense)
  const runwayDays = avgDailyExpense > 0 ? Math.round(available / avgDailyExpense) : remainingDays

  return { income, expense, remainingDays, runwayDays }
}

export function getExpenseComparison(snapshot: MiaSnapshot) {
  const { start, prevStart, next } = getMonthBounds(new Date())
  const thisMonth = snapshot.transactions.filter((tx) => {
    const date = toDate(tx.date)
    return date >= start && date < next && tx.type === "expense"
  })
  const lastMonth = snapshot.transactions.filter((tx) => {
    const date = toDate(tx.date)
    return date >= prevStart && date < start && tx.type === "expense"
  })

  const currentExpense = thisMonth.reduce((sum, tx) => sum + Number(tx.amount || 0), 0)
  const previousExpense = lastMonth.reduce((sum, tx) => sum + Number(tx.amount || 0), 0)

  return {
    currentExpense,
    previousExpense,
    diff: currentExpense - previousExpense,
  }
}

export function getTopCategories(snapshot: MiaSnapshot, limit = 3) {
  const { start, next } = getMonthBounds(new Date())
  const categoryMap = new Map<string, number>()

  for (const tx of snapshot.transactions) {
    const date = toDate(tx.date)
    if (date < start || date >= next || tx.type !== "expense") continue
    const key = tx.category?.name || "Sin categoria"
    categoryMap.set(key, (categoryMap.get(key) || 0) + Number(tx.amount || 0))
  }

  return Array.from(categoryMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, total]) => ({ name, total }))
}

export function getCreditCards(snapshot: MiaSnapshot) {
  return snapshot.accounts
    .filter((account) => account.type === "credit")
    .map((card) => ({
      name: card.name,
      currentBalance: Number(card.balance || 0),
      statementBalance: Number(card.statement_balance || 0),
      available: Number(
        card.currency === "USD"
          ? (card.available_credit_usd ?? card.credit_limit_usd ?? 0)
          : (card.available_credit_dop ?? card.credit_limit_dop ?? 0)
      ),
      statementDate: card.last_statement_cutoff_date || null,
      statementDueDate: card.statement_due_date || null,
    }))
}

export function getGoalProgress(snapshot: MiaSnapshot) {
  return snapshot.goals
    .filter((goal) => !goal.is_completed)
    .map((goal) => {
      const current = Number(goal.current_amount || 0)
      const target = Number(goal.target_amount || 0)
      const progress = target > 0 ? Math.round((current / target) * 100) : 0
      return {
        name: goal.name,
        current,
        target,
        progress,
        missing: Math.max(0, target - current),
      }
    })
    .sort((a, b) => b.progress - a.progress)
}

export function formatTopCategoryList(items: Array<{ name: string; total: number }>) {
  return items.map((item) => ({ label: item.name, value: formatCurrency(item.total) }))
}
