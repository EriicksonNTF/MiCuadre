import type { Account, Transaction, Goal } from "@/lib/types/database"

type ScoreBreakdown = {
  consistency: number
  savings: number
  budget: number
  debt: number
  goals: number
  total: number
}

const MAX_DAYS_TRACKED = 30
const CONSISTENCY_WEIGHT = 25
const SAVINGS_WEIGHT = 25
const BUDGET_WEIGHT = 20
const DEBT_WEIGHT = 15
const GOALS_WEIGHT = 15

function getUniqueDaysWithTransactions(transactions: Transaction[]): number {
  const days = new Set<string>()
  transactions.forEach((t) => {
    if (t.date) {
      days.add(t.date.split("T")[0])
    }
  })
  return days.size
}

function getTransactionDaysInRange(transactions: Transaction[], days: number): number {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().split("T")[0]

  const days2 = new Set<string>()
  transactions.forEach((t) => {
    if (t.date && t.date >= cutoffStr) {
      days2.add(t.date.split("T")[0])
    }
  })
  return days2.size
}

function calculateConsistencyScore(transactions: Transaction[]): number {
  if (transactions.length === 0) return 0

  const last7 = getTransactionDaysInRange(transactions, 7)
  const last14 = getTransactionDaysInRange(transactions, 14)
  const last30 = getUniqueDaysWithTransactions(transactions)

  const score7 = Math.min(last7 / 7, 1) * 40
  const score14 = Math.min(last14 / 14, 1) * 30
  const score30 = Math.min(last30 / MAX_DAYS_TRACKED, 1) * 30

  return Math.round(score7 + score14 + score30)
}

function calculateSavingsScore(transactions: Transaction[], accounts: Account[]): number {
  if (transactions.length === 0) return 0

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)
  const cutoffStr = cutoff.toISOString().split("T")[0]

  const recentTx = transactions.filter((t) => t.date && t.date >= cutoffStr)

  let totalIncome = 0
  let totalExpenses = 0

  recentTx.forEach((t) => {
    if (t.type === "income") {
      totalIncome += Number(t.amount)
    } else {
      totalExpenses += Number(t.amount)
    }
  })

  if (totalIncome === 0) return totalExpenses === 0 ? 50 : 10

  const savingsRate = (totalIncome - totalExpenses) / totalIncome
  const score = Math.max(0, Math.min(savingsRate * 100, 100))
  return Math.round(score)
}

function calculateBudgetScore(transactions: Transaction[]): number {
  if (transactions.length === 0) return 0

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)
  const cutoffStr = cutoff.toISOString().split("T")[0]

  const recentTx = transactions.filter((t) => t.date && t.date >= cutoffStr)
  if (recentTx.length === 0) return 50

  const byCategory = new Map<string, { income: number; expense: number }>()
  recentTx.forEach((t) => {
    const key = t.category_id ?? "other"
    const existing = byCategory.get(key) ?? { income: 0, expense: 0 }
    if (t.type === "income") {
      existing.income += Number(t.amount)
    } else {
      existing.expense += Number(t.amount)
    }
    byCategory.set(key, existing)
  })

  const totalExpenses = Array.from(byCategory.values()).reduce(
    (sum, cat) => sum + cat.expense,
    0
  )
  if (totalExpenses === 0) return 75

  let overBudgetCategories = 0
  let categoryCount = 0

  byCategory.forEach((cat) => {
    if (cat.expense > 0) {
      categoryCount++
      if (cat.income > 0 && cat.expense > cat.income * 0.9) {
        overBudgetCategories++
      }
    }
  })

  const budgetAdherence = categoryCount > 0
    ? (categoryCount - overBudgetCategories) / categoryCount
    : 1

  return Math.round(budgetAdherence * 100)
}

function calculateDebtScore(accounts: Account[]): number {
  const creditAccounts = accounts.filter((a) => a.type === "credit")

  if (creditAccounts.length === 0) return 100

  let totalUtilization = 0
  let creditCount = 0

  creditAccounts.forEach((account) => {
    const limitDOP = Number(account.credit_limit_dop ?? 0)
    const limitUSD = Number(account.credit_limit_usd ?? 0)
    const debtDOP = Number(account.current_debt_dop ?? 0)
    const debtUSD = Number(account.current_debt_usd ?? 0)

    const limit = limitDOP + limitUSD
    const debt = debtDOP + debtUSD

    if (limit > 0) {
      totalUtilization += Math.min(debt / limit, 1)
      creditCount++
    }
  })

  if (creditCount === 0) return 100

  const avgUtilization = totalUtilization / creditCount

  if (avgUtilization <= 0.3) return 100
  if (avgUtilization <= 0.5) return 80
  if (avgUtilization <= 0.7) return 60
  if (avgUtilization <= 0.85) return 40
  if (avgUtilization <= 0.95) return 20
  return 5
}

function calculateGoalsScore(goals: Goal[], accounts: Account[]): number {
  if (goals.length === 0) {
    return accounts.length > 0 ? 40 : 0
  }

  const activeGoals = goals.filter((g) => !g.completed_at)
  if (activeGoals.length === 0) return 100

  let totalProgress = 0
  let hasProgress = false

  activeGoals.forEach((goal) => {
    const progress = Number(goal.current_amount) / Number(goal.target_amount)
    if (progress > 0) hasProgress = true
    totalProgress += Math.min(progress, 1)
  })

  const avgProgress = totalProgress / activeGoals.length
  const baseScore = avgProgress * 100

  return hasProgress ? Math.round(baseScore + 10) : Math.round(baseScore)
}

export function calculateFinScore(
  transactions: Transaction[],
  accounts: Account[],
  goals: Goal[]
): ScoreBreakdown {
  const consistency = calculateConsistencyScore(transactions)
  const savings = calculateSavingsScore(transactions, accounts)
  const budget = calculateBudgetScore(transactions)
  const debt = calculateDebtScore(accounts)
  const goalsScore = calculateGoalsScore(goals, accounts)

  const total = Math.round(
    (consistency * CONSISTENCY_WEIGHT +
      savings * SAVINGS_WEIGHT +
      budget * BUDGET_WEIGHT +
      debt * DEBT_WEIGHT +
      goalsScore * GOALS_WEIGHT) /
      100
  )

  return {
    consistency,
    savings,
    budget,
    debt,
    goals: goalsScore,
    total,
  }
}

export function getFinScoreLabel(score: number): string {
  if (score >= 85) return "Excelente"
  if (score >= 70) return "Muy bien"
  if (score >= 55) return "En camino"
  if (score >= 40) return "Mejorando"
  return "Empezando"
}

export function getFinScoreColor(score: number): string {
  if (score >= 70) return "text-emerald-600 dark:text-emerald-400"
  if (score >= 55) return "text-amber-600 dark:text-amber-400"
  return "text-red-600 dark:text-red-400"
}

export function getFinScoreBg(score: number): string {
  if (score >= 70) return "bg-emerald-100 dark:bg-emerald-900/40"
  if (score >= 55) return "bg-amber-100 dark:bg-amber-900/40"
  return "bg-red-100 dark:bg-red-900/40"
}
