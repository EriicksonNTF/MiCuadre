import type { SupabaseClient } from "@supabase/supabase-js"
import type { Account, Goal, Transaction, Subscription, CreditCardCycle } from "@/lib/types/database"

function toDate(value: string) {
  return new Date(`${value}T12:00:00`)
}

function getMonthBounds(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return { start, prevStart, next }
}

export async function getMonthlySpendingSummary(supabase: SupabaseClient, userId: string) {
  const { start, next } = getMonthBounds()
  
  const { data: txs } = await supabase
    .from("transactions")
    .select("amount, type, date")
    .eq("user_id", userId)
    .gte("date", start.toISOString().slice(0, 10))
    .lt("date", next.toISOString().slice(0, 10))

  const transactions = (txs || []) as Pick<Transaction, "amount" | "type" | "date">[]
  
  const income = transactions
    .filter((tx) => tx.type === "income")
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0)
  const expense = transactions
    .filter((tx) => tx.type === "expense")
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0)

  return { income, expense }
}

export async function getSpendingByCategory(supabase: SupabaseClient, userId: string, range?: { start: Date; end: Date }) {
  const bounds = getMonthBounds()
  const startDate = range ? range.start : bounds.start
  const endDate = range ? range.end : bounds.next

  const { data: txs } = await supabase
    .from("transactions")
    .select("amount, type, date, category:categories(name)")
    .eq("user_id", userId)
    .eq("type", "expense")
    .gte("date", startDate.toISOString().slice(0, 10))
    .lt("date", endDate.toISOString().slice(0, 10))

  const transactions = (txs || []) as any[]
  const categoryMap = new Map<string, number>()

  for (const tx of transactions) {
    const catName = Array.isArray(tx.category)
      ? tx.category[0]?.name
      : tx.category?.name;
    const key = catName || "Sin categoría"
    categoryMap.set(key, (categoryMap.get(key) || 0) + Number(tx.amount || 0))
  }

  return Array.from(categoryMap.entries())
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
}

export async function getRecurringExpenseSummary(supabase: SupabaseClient, userId: string) {
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")

  const activeSubs = (subs || []) as Subscription[]
  const total = activeSubs.reduce((sum, sub) => sum + Number(sub.amount || 0), 0)

  return {
    total,
    subscriptions: activeSubs.map((s) => ({
      name: s.name,
      amount: Number(s.amount),
      currency: s.currency,
      nextPaymentDate: s.next_payment_date,
    })),
  }
}

export async function getCreditCardDebtSummary(supabase: SupabaseClient, userId: string) {
  const { data: accounts } = await supabase
    .from("accounts")
    .select("name, balance, statement_balance, pending_amount, last_statement_cutoff_date, statement_due_date, currency")
    .eq("user_id", userId)
    .eq("type", "credit")
    .eq("is_active", true)

  const cards = (accounts || []) as Pick<Account, "name" | "balance" | "statement_balance" | "pending_amount" | "last_statement_cutoff_date" | "statement_due_date" | "currency">[]

  const totalDebt = cards.reduce((sum, card) => sum + Math.abs(Number(card.balance || 0)), 0)
  const statementDebt = cards.reduce((sum, card) => sum + Number(card.statement_balance || 0), 0)

  return {
    totalDebt,
    statementDebt,
    cards: cards.map((c) => ({
      name: c.name,
      balance: Number(c.balance || 0),
      statementBalance: Number(c.statement_balance || 0),
      pendingAmount: Number(c.pending_amount || 0),
      dueDate: c.statement_due_date,
      currency: c.currency,
    })),
  }
}

export async function getGoalProgressSummary(supabase: SupabaseClient, userId: string) {
  const { data: goalsRaw } = await supabase
    .from("goals")
    .select("name, target_amount, current_amount, currency, is_completed")
    .eq("user_id", userId)
    .eq("is_completed", false)

  const goals = (goalsRaw || []) as Goal[]

  return goals.map((g) => {
    const current = Number(g.current_amount || 0)
    const target = Number(g.target_amount || 0)
    const progress = target > 0 ? Math.round((current / target) * 100) : 0
    return {
      name: g.name,
      current,
      target,
      progress,
      currency: g.currency,
    }
  }).sort((a, b) => b.progress - a.progress)
}

export async function getFinancialHealthScore(supabase: SupabaseClient, userId: string) {
  // 1. Gather monthly summary
  const { income, expense } = await getMonthlySpendingSummary(supabase, userId)
  
  // 2. Gather accounts
  const { data: accountsRaw } = await supabase
    .from("accounts")
    .select("type, balance, is_active")
    .eq("user_id", userId)
    .eq("is_active", true)

  const accounts = (accountsRaw || []) as Account[]
  const cashAndDebit = accounts
    .filter((a) => a.type === "cash" || a.type === "debit")
    .reduce((sum, a) => sum + Number(a.balance || 0), 0)

  // 3. Card debt
  const { totalDebt: creditCardDebt } = await getCreditCardDebtSummary(supabase, userId)
  
  // 4. Recurring subscriptions
  const { total: recurringExpenses } = await getRecurringExpenseSummary(supabase, userId)

  // 5. Category spend
  const categorySpend = await getSpendingByCategory(supabase, userId)
  const topSpendingCategory = categorySpend.length > 0 ? categorySpend[0].name : "Ninguna"

  // Math
  const savingsRate = income > 0 ? Math.round(((income - expense) / income) * 100) : 0
  const debtToIncomeRatio = income > 0 ? Math.round((creditCardDebt / income) * 100) : 0
  const emergencyFundMonths = expense > 0 ? Number((cashAndDebit / expense).toFixed(1)) : 0

  const riskFlags: string[] = []
  const positiveSignals: string[] = []

  if (expense > income) {
    riskFlags.push("Gastos mensuales superan tus ingresos")
  }
  if (recurringExpenses > income * 0.15) {
    riskFlags.push("Gastos recurrentes en suscripciones altos")
  }
  if (emergencyFundMonths < 3) {
    riskFlags.push("Fondo de emergencia bajo (menos de 3 meses de gastos)")
  }
  if (debtToIncomeRatio > 35) {
    riskFlags.push("Nivel de deuda en tarjetas de crédito alto")
  }

  if (income > expense) {
    positiveSignals.push("Gastas menos de lo que ingresas")
  }
  if (savingsRate >= 20) {
    positiveSignals.push("Tasa de ahorro saludable (más del 20%)")
  }
  if (emergencyFundMonths >= 3) {
    positiveSignals.push("Fondo de emergencia adecuado")
  }

  return {
    monthlyIncome: income,
    monthlyExpenses: expense,
    savingsRate,
    debtToIncomeRatio,
    recurringExpenses,
    creditCardDebt,
    emergencyFundMonths,
    topSpendingCategory,
    riskFlags,
    positiveSignals,
  }
}
