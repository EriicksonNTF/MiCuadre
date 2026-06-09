import type { SupabaseClient } from "@supabase/supabase-js"
import { isReportableIncome } from "@/lib/transactions/reporting"
import type { Account, Currency, Goal, Transaction, Subscription, CreditCardCycle } from "@/lib/types/database"

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
    .select("amount, type, date, metadata")
    .eq("user_id", userId)
    .gte("date", start.toISOString().slice(0, 10))
    .lt("date", next.toISOString().slice(0, 10))

  const transactions = (txs || []) as Pick<Transaction, "amount" | "type" | "date" | "metadata">[]
  
  const income = transactions
    .filter((tx) => tx.type === "income" && isReportableIncome(tx.metadata))
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
    .select(`
      name, balance, currency,
      current_debt, current_debt_dop, current_debt_usd,
      statement_balance, statement_balance_dop, statement_balance_usd,
      pending_amount, paid_amount,
      paid_statement_amount_dop, paid_statement_amount_usd,
      available_credit_dop, available_credit_usd,
      credit_limit_dop, credit_limit_usd,
      last_statement_cutoff_date, statement_due_date,
      closing_day, minimum_payment_percentage, annual_interest_rate
    `)
    .eq("user_id", userId)
    .eq("type", "credit")
    .eq("is_active", true)

  const cards = (accounts || []) as any[]

  const totalDebtDop = cards.reduce((sum, card) => sum + Number(card.current_debt_dop ?? card.current_debt ?? 0), 0)
  const totalDebtUsd = cards.reduce((sum, card) => sum + Number(card.current_debt_usd ?? 0), 0)

  return {
    totalDebt: totalDebtDop + totalDebtUsd,
    totalDebtDop,
    totalDebtUsd,
    cards: cards.map((c) => ({
      name: c.name,
      currency: c.currency,
      balance: Number(c.current_debt ?? c.balance ?? 0),
      balanceDop: Number(c.current_debt_dop ?? 0),
      balanceUsd: Number(c.current_debt_usd ?? 0),
      statementBalance: Number(c.statement_balance ?? 0),
      statementBalanceDop: Number(c.statement_balance_dop ?? 0),
      statementBalanceUsd: Number(c.statement_balance_usd ?? 0),
      pendingAmount: Number(c.pending_amount ?? 0),
      paidAmount: Number(c.paid_amount ?? 0),
      paidStatementAmountDop: Number(c.paid_statement_amount_dop ?? 0),
      paidStatementAmountUsd: Number(c.paid_statement_amount_usd ?? 0),
      availableCreditDop: Number(c.available_credit_dop ?? 0),
      availableCreditUsd: Number(c.available_credit_usd ?? 0),
      creditLimitDop: Number(c.credit_limit_dop ?? 0),
      creditLimitUsd: Number(c.credit_limit_usd ?? 0),
      dueDate: c.statement_due_date,
      cutoffDate: c.last_statement_cutoff_date,
      closingDay: c.closing_day,
      minPaymentPct: Number(c.minimum_payment_percentage ?? 0.05),
      annualRate: Number(c.annual_interest_rate ?? 0),
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
  
  // 2-5. Gather accounts, card debt, subscriptions, categories in parallel
  const [{ data: accountsRaw }, { totalDebt: creditCardDebt }, { total: recurringExpenses }, categorySpend] = await Promise.all([
    supabase
      .from("accounts")
      .select("type, balance, is_active")
      .eq("user_id", userId)
      .eq("is_active", true),
    getCreditCardDebtSummary(supabase, userId),
    getRecurringExpenseSummary(supabase, userId),
    getSpendingByCategory(supabase, userId),
  ])

  const accounts = (accountsRaw || []) as Account[]
  const cashAndDebit = accounts
    .filter((a) => a.type === "cash" || a.type === "debit")
    .reduce((sum, a) => sum + Number(a.balance || 0), 0)
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

export type CategoryBudgetSummary = {
  budgetId: string
  name: string
  categoryName: string
  limit: number
  spent: number
  currency: "DOP" | "USD"
}

export async function getCategoryBudgetsSummary(
  supabase: SupabaseClient,
  userId: string
): Promise<CategoryBudgetSummary[]> {
  const { data: budgetsRaw } = await supabase
    .from("budgets")
    .select("id, name, category_id, category_name, amount, currency")
    .eq("user_id", userId)
    .eq("is_active", true)

  const budgets = (budgetsRaw || []) as Array<{
    id: string
    name: string
    category_id: string | null
    category_name: string
    amount: number
    currency: "DOP" | "USD"
  }>

  if (budgets.length === 0) return []

  const { start, next } = getMonthBounds()
  const startStr = start.toISOString().slice(0, 10)
  const endStr = next.toISOString().slice(0, 10)

  const { data: txs } = await supabase
    .from("transactions")
    .select("amount, category_id, category:categories(id, name)")
    .eq("user_id", userId)
    .eq("type", "expense")
    .gte("date", startStr)
    .lt("date", endStr)

  const transactions = (txs || []) as Array<{
    amount: number
    category_id: string | null
    category: { id: string; name: string } | { id: string; name: string }[] | null
  }>

  return budgets.map((budget) => {
    const cat = budget.category_name.trim().toLowerCase()
    const spent = transactions.reduce((sum, tx) => {
      const txCat = Array.isArray(tx.category) ? tx.category[0] : tx.category
      const txCatName = txCat?.name?.trim().toLowerCase()
      const matchesById =
        budget.category_id && tx.category_id && budget.category_id === tx.category_id
      const matchesByName = cat && txCatName && txCatName.includes(cat)
      if (matchesById || matchesByName) {
        return sum + Number(tx.amount || 0)
      }
      return sum
    }, 0)

    return {
      budgetId: budget.id,
      name: budget.name,
      categoryName: budget.category_name,
      limit: Number(budget.amount || 0),
      spent: Math.round(spent * 100) / 100,
      currency: budget.currency,
    }
  })
}

export type UpcomingPayment = {
  name: string
  amount: number
  currency: "DOP" | "USD"
  dueDate: string
  type: "subscription" | "debt" | "credit"
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function nextOccurrenceInDays(paymentDay: number, daysAhead: number): Date | null {
  if (!paymentDay || paymentDay < 1 || paymentDay > 31) return null
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const candidate = new Date(now.getFullYear(), now.getMonth(), paymentDay)
  if (candidate < today) {
    candidate.setMonth(candidate.getMonth() + 1)
  }
  const diffDays = Math.floor((candidate.getTime() - today.getTime()) / 86_400_000)
  if (diffDays < 0 || diffDays > daysAhead) return null
  return candidate
}

export async function getUpcomingPaymentsSummary(
  supabase: SupabaseClient,
  userId: string,
  daysAhead = 30
): Promise<UpcomingPayment[]> {
  const today = new Date()
  const todayStr = isoDate(today)
  const future = new Date(today)
  future.setDate(future.getDate() + daysAhead)
  const futureStr = isoDate(future)

  const [{ data: subsRaw }, { data: debtsRaw }, { data: ccRaw }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("name, amount, currency, next_payment_date, status")
      .eq("user_id", userId)
      .eq("status", "active")
      .gte("next_payment_date", todayStr)
      .lte("next_payment_date", futureStr)
      .order("next_payment_date", { ascending: true }),
    supabase
      .from("debts")
      .select("name, fixed_payment_amount, currency, payment_day, is_active")
      .eq("user_id", userId)
      .eq("is_active", true),
    supabase
      .from("accounts")
      .select("name, statement_balance_dop, statement_balance_usd, pending_amount, statement_due_date, currency")
      .eq("user_id", userId)
      .eq("type", "credit")
      .eq("is_active", true),
  ])

  const payments: UpcomingPayment[] = []

  for (const s of subsRaw || []) {
    payments.push({
      name: s.name,
      amount: Number(s.amount || 0),
      currency: s.currency as "DOP" | "USD",
      dueDate: s.next_payment_date,
      type: "subscription",
    })
  }

  for (const d of debtsRaw || []) {
    const due = nextOccurrenceInDays(Number(d.payment_day || 0), daysAhead)
    if (!due) continue
    const amount = Number(d.fixed_payment_amount || 0)
    if (amount <= 0) continue
    payments.push({
      name: d.name,
      amount,
      currency: d.currency as "DOP" | "USD",
      dueDate: isoDate(due),
      type: "debt",
    })
  }

  for (const cc of ccRaw || []) {
    if (!cc.statement_due_date) continue
    const dueDate = new Date(cc.statement_due_date)
    if (dueDate < today || dueDate > future) continue
    const amountDop = Number(cc.statement_balance_dop ?? cc.pending_amount ?? 0)
    const amountUsd = Number(cc.statement_balance_usd ?? 0)

    const balanceDue = cc.currency === "USD"
      ? Math.max(amountUsd, amountDop)
      : amountDop + amountUsd

    if (balanceDue <= 0) continue

    payments.push({
      name: `Tarjeta ${cc.name}`,
      amount: balanceDue,
      currency: "DOP",
      dueDate: cc.statement_due_date,
      type: "credit",
    })

    if (amountUsd > 0 && cc.currency !== "USD") {
      payments.push({
        name: `Tarjeta ${cc.name} (USD)`,
        amount: amountUsd,
        currency: "USD",
        dueDate: cc.statement_due_date,
        type: "credit",
      })
    }
  }

  return payments.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}

export type TodayTransaction = {
  id: string
  type: "expense" | "income"
  amount: number
  currency: Currency
  description: string | null
  categoryName: string | null
  accountName: string
  kind: string | null
}

export async function getTodayTransactions(
  supabase: SupabaseClient,
  userId: string
): Promise<TodayTransaction[]> {
  const todayStr = isoDate(new Date())

  const { data: txs } = await supabase
    .from("transactions")
    .select("id, type, amount, currency, description, date, metadata, category:categories(name), account:accounts(name)")
    .eq("user_id", userId)
    .eq("date", todayStr)
    .order("created_at", { ascending: false })

  return ((txs || []) as any[]).map((t) => {
    const catName = Array.isArray(t.category)
      ? t.category[0]?.name
      : t.category?.name
    const accName = Array.isArray(t.account)
      ? t.account[0]?.name
      : t.account?.name
    return {
      id: t.id,
      type: t.type,
      amount: Number(t.amount || 0),
      currency: (t.currency || "DOP") as Currency,
      description: t.description,
      categoryName: catName || null,
      accountName: accName || "—",
      kind: t.metadata?.kind || null,
    }
  })
}
