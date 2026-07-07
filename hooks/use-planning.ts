"use client"

import { useMemo } from "react"
import useSWR, { mutate } from "swr"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency, getLocalDateString } from "@/lib/data"
import { offlineDB, type OutboxItem } from "@/lib/offline/db"
import { withBudgetUsage } from "@/lib/planning/budgets"
import { calculateDebtProgress } from "@/lib/planning/debts"
import type { Budget, BudgetWithUsage, Debt, DebtPayment, DebtWithProgress } from "@/types/planning"
import { getFinancialCalendarEvents, type FinancialCalendarEvent, type CalendarEventType } from "@/lib/planning/calendar"
import { DEFAULT_PLAN, ENTITLEMENTS_BY_PLAN, blockedEntitlement } from "@/lib/entitlements/entitlements"
import { normalizePlanTier } from "@/lib/billing/plans"
import { isTestFullAccessEmail } from "@/lib/entitlements/test-user"
import { applyAccountImpact, syncAccountBalance } from "./use-data"
import { LedgerService } from "@/lib/ledger/ledger-service"
import { buildOutboxItem, tryEnqueueOffline, enqueueOfflineFallback, isOfflineError } from "@/lib/offline/outbox"
import { getAuthenticatedUser } from "@/lib/supabase/user"

const supabase = createClient()

function roundCurrencyAmount(value: number): number {
  return Math.round(value * 100) / 100
}

// React 19: Cached month range to avoid multiple new Date() calls within same tick
// Since these functions are called in async context, a simple module-level cache works
let monthRangeCache: { from: string; to: string } | null = null
let monthRangeCacheMonth: string | null = null

function monthRange() {
  const now = new Date()
  const monthKey = `${now.getFullYear()}-${now.getMonth()}`
  if (monthRangeCache && monthRangeCacheMonth === monthKey) return monthRangeCache

  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  monthRangeCache = {
    from: getLocalDateString(from),
    to: getLocalDateString(to),
  }
  monthRangeCacheMonth = monthKey
  return monthRangeCache
}

function normalizeAmount(value: unknown) {
  return Number(Number(value || 0).toFixed(2))
}

function normalizePositiveAmount(value: unknown) {
  const next = Number(value || 0)
  return Number.isFinite(next) && next > 0 ? normalizeAmount(next) : 0
}

async function fetchBudgets(): Promise<Budget[]> {
  const userData = await getAuthenticatedUser()
  if (!userData) return []

  const { data, error } = await supabase
    .from("budgets")
    .select("*")
    .eq("user_id", userData.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })

  if (error) {
    const cached = await offlineDB.getAll<Budget>("budgets_cache")
    if (cached.length > 0) return cached
    throw error
  }
  const budgets = (data as Budget[]) || []
  for (const b of budgets) {
    await offlineDB.put("budgets_cache", b)
  }
  return budgets
}

async function fetchBudgetUsageRows() {
  const userData = await getAuthenticatedUser()
  if (!userData) return []

  const { from, to } = monthRange()
  const { data, error } = await supabase
    .from("transactions")
    .select("amount, category_id, category:categories(name)")
    .eq("user_id", userData.id)
    .eq("type", "expense")
    .gte("date", from)
    .lte("date", to)

  if (error) throw error
  return data || []
}

async function fetchPendingOutboxExpenses() {
  const outbox = await offlineDB.getAll<OutboxItem>("offline_outbox")
  const { from, to } = monthRange()

  return outbox
    .filter((item) => item.status === "pending" || item.status === "failed")
    .map((item) => item.payload)
    .filter((payload) => payload?.type === "expense")
    .filter((payload) => {
      const d = typeof payload?.date === "string" ? payload.date : getLocalDateString()
      return d >= from && d <= to
    })
}

async function fetchDebts(): Promise<Debt[]> {
  const userData = await getAuthenticatedUser()
  if (!userData) return []

  const { data, error } = await supabase
    .from("debts")
    .select("*")
    .eq("user_id", userData.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })

  if (error) {
    if ((error as any).code === "42P01") return []
    const cached = await offlineDB.getAll<Debt>("debts_cache")
    if (cached.length > 0) return cached
    throw error
  }

  const debts = ((data as Debt[]) || []).map((debt) => ({
    ...debt,
    debt_type: (debt.debt_type || "loan") as Debt["debt_type"],
    payment_frequency: (debt.payment_frequency || "monthly") as Debt["payment_frequency"],
  }))
  for (const d of debts) {
    await offlineDB.put("debts_cache", d)
  }
  return debts
}

async function fetchDebtPaymentsThisMonth() {
  const userData = await getAuthenticatedUser()
  if (!userData) return [] as DebtPayment[]
  const { from, to } = monthRange()

  const { data, error } = await supabase
    .from("debt_payments")
    .select("*")
    .eq("user_id", userData.id)
    .gte("payment_date", `${from}T00:00:00`)
    .lte("payment_date", `${to}T23:59:59`)

  if (error) {
    if ((error as any).code === "42P01") return []
    const cached = await offlineDB.getAll<DebtPayment>("debt_payments_cache")
    if (cached.length > 0) return cached
    throw error
  }

  const payments = (data as DebtPayment[]) || []
  for (const p of payments) {
    await offlineDB.put("debt_payments_cache", p)
  }
  return payments
}

type CreditCardDebtSnapshot = {
  id: string
  name: string
  statement_due_date: string | null
  pending_amount: number | null
  minimum_payment: number | null
  current_debt_dop: number | null
  current_debt_usd: number | null
}

async function fetchCreditCardDebtSnapshot(): Promise<CreditCardDebtSnapshot[]> {
  const userData = await getAuthenticatedUser()
  if (!userData) return []

  const { data, error } = await supabase
    .from("accounts")
    .select("id,name,statement_due_date,pending_amount,minimum_payment,current_debt_dop,current_debt_usd")
    .eq("user_id", userData.id)
    .eq("type", "credit")
    .eq("is_active", true)

  if (error) throw error
  return (data as CreditCardDebtSnapshot[]) || []
}

export function useBudgetsWithUsage() {
  return useSWR<BudgetWithUsage[]>("planning_budgets_with_usage", async () => {
    const [budgets, usageRows, pendingRows] = await Promise.all([
      fetchBudgets(),
      fetchBudgetUsageRows(),
      fetchPendingOutboxExpenses(),
    ])

    const spentByCategoryId = new Map<string, number>()
    const spentByCategoryName = new Map<string, number>()

    for (const row of usageRows) {
      const amount = normalizeAmount((row as any).amount)
      const categoryId = (row as any).category_id as string | null
      const categoryName = ((row as any).category?.name as string | undefined) || ""
      if (categoryId) spentByCategoryId.set(categoryId, normalizeAmount((spentByCategoryId.get(categoryId) || 0) + amount))
      if (categoryName) spentByCategoryName.set(categoryName.toLowerCase(), normalizeAmount((spentByCategoryName.get(categoryName.toLowerCase()) || 0) + amount))
    }

    for (const pending of pendingRows) {
      const amount = normalizeAmount(pending?.amount)
      const categoryId = (pending?.category_id as string | null) || null
      const categoryName = (pending?.category_name as string | undefined) || ""
      if (categoryId) spentByCategoryId.set(categoryId, normalizeAmount((spentByCategoryId.get(categoryId) || 0) + amount))
      if (categoryName) spentByCategoryName.set(categoryName.toLowerCase(), normalizeAmount((spentByCategoryName.get(categoryName.toLowerCase()) || 0) + amount))
    }

    return budgets.map((budget) => {
      const byId = budget.category_id ? spentByCategoryId.get(budget.category_id) || 0 : 0
      const byName = spentByCategoryName.get(budget.category_name.toLowerCase()) || 0
      const spent = byId > 0 ? byId : byName
      const includesPending = pendingRows.some((pending) => {
        const categoryId = (pending?.category_id as string | null) || null
        const categoryName = (pending?.category_name as string | undefined) || ""
        return (budget.category_id && categoryId === budget.category_id) || categoryName.toLowerCase() === budget.category_name.toLowerCase()
      })
      return withBudgetUsage({ budget, spent, includesPending })
    })
  })
}

export function usePlanningSummary() {
  const { data: budgets = [], isLoading, mutate: refresh } = useBudgetsWithUsage()

  const summary = useMemo(() => {
    const totalBudget = budgets.reduce((sum, b) => sum + Number(b.amount || 0), 0)
    const totalSpent = budgets.reduce((sum, b) => sum + Number(b.spent || 0), 0)
    const usagePercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0
    const closest = [...budgets].sort((a, b) => b.percentage - a.percentage)[0] || null
    return {
      totalBudget: normalizeAmount(totalBudget),
      totalSpent: normalizeAmount(totalSpent),
      usagePercentage: normalizeAmount(usagePercentage),
      closestToLimit: closest,
      budgetUsedLabel: `${Math.min(100, Math.round(usagePercentage))}%`,
      totalBudgetLabel: formatCurrency(totalBudget),
      totalSpentLabel: formatCurrency(totalSpent),
    }
  }, [budgets])

  return { budgets, summary, isLoading, refresh }
}

function plusDays(base: Date, days: number) {
  const copy = new Date(base)
  copy.setDate(copy.getDate() + days)
  return copy
}

export function useFinancialCalendar() {
  return useSWR<FinancialCalendarEvent[]>("planning_calendar_events", async () => {
    const userData = await getAuthenticatedUser()
    if (!userData) return []
    return getFinancialCalendarEvents(userData.id)
  })
}

export function useFinancialCalendarSummary() {
  const { data: events = [], isLoading } = useFinancialCalendar()

  // React 19: Use useMemo to avoid new Date() on every render
  // This prevents unnecessary recalculations when hook consumers re-render
  const dateKey = useMemo(() => {
    const now = new Date()
    return {
      today: getLocalDateString(now),
      weekEnd: getLocalDateString(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)),
      thisMonth: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
    }
  }, [])

  const next7Days = useMemo(() =>
    events.filter((event) =>
      event.due_date <= dateKey.weekEnd &&
      event.due_date >= dateKey.today &&
      event.status !== "paid"
    ),
    [events, dateKey]
  )

  const next7Amount = useMemo(() =>
    next7Days.reduce((sum, event) => sum + Number(event.amount || 0), 0),
    [next7Days]
  )

  const monthCommitted = useMemo(() =>
    events
      .filter((event) => event.due_date.startsWith(dateKey.thisMonth) && event.status !== "paid")
      .reduce((sum, event) => sum + Number(event.amount || 0), 0),
    [events, dateKey]
  )

  const nextEvent = next7Days[0] || events[0] || null

  return {
    events,
    isLoading,
    next7Days,
    next7Amount,
    monthCommitted,
    nextEvent,
    byType: (type: CalendarEventType | "all") => (type === "all" ? events : events.filter((e) => e.type === type)),
  }
}

export function useDebts() {
  return useSWR<DebtWithProgress[]>("planning_debts", async () => {
    const debts = await fetchDebts()
    return debts.map((debt) => calculateDebtProgress(debt))
  })
}

export function useDebtsSummary() {
  const { data: debts = [], isLoading } = useDebts()
  const { data: monthPayments = [] } = useSWR<DebtPayment[]>("planning_debt_payments_month", fetchDebtPaymentsThisMonth)
  const { data: cardDebts = [] } = useSWR<CreditCardDebtSnapshot[]>("planning_credit_card_debts", fetchCreditCardDebtSnapshot)

  const summary = useMemo(() => {
    const debtPendingDop = debts
      .filter((debt) => debt.currency === "DOP")
      .reduce((sum, debt) => sum + Number(debt.current_balance || 0), 0)
    const debtPendingUsd = debts
      .filter((debt) => debt.currency === "USD")
      .reduce((sum, debt) => sum + Number(debt.current_balance || 0), 0)

    const cardPendingDop = cardDebts.reduce((sum, card) => sum + Number(card.current_debt_dop || 0), 0)
    const cardPendingUsd = cardDebts.reduce((sum, card) => sum + Number(card.current_debt_usd || 0), 0)

    const totalPendingDop = debtPendingDop + cardPendingDop
    const totalPendingUsd = debtPendingUsd + cardPendingUsd
    const totalPending = totalPendingDop

    const paymentsThisMonth = monthPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)

    const nextDebt = [...debts]
      .filter((debt) => debt.next_payment_date)
      .sort((a, b) => (a.next_payment_date || "").localeCompare(b.next_payment_date || ""))[0] || null

    return {
      totalPending,
      totalPendingDop,
      totalPendingUsd,
      cardPendingDop,
      cardPendingUsd,
      paymentsThisMonth,
      nextDebt,
      totalPendingLabel: formatCurrency(totalPending),
      totalPendingDopLabel: formatCurrency(totalPendingDop, "DOP"),
      totalPendingUsdLabel: formatCurrency(totalPendingUsd, "USD"),
      paymentsThisMonthLabel: formatCurrency(paymentsThisMonth),
    }
  }, [debts, monthPayments, cardDebts])

  return { debts, summary, isLoading }
}

export async function createBudget(input: {
  category_id?: string | null
  category_name: string
  name: string
  amount: number
  currency: "DOP" | "USD"
  alert_threshold: number
}) {
  const userData = await getAuthenticatedUser()
  if (!userData) throw new Error("No autenticado")
  const userId = userData.id

  // -- Field validations --
  if (!input.name?.trim()) {
    throw new Error("El nombre del presupuesto no puede estar vacío")
  }
  if (!input.amount || input.amount <= 0.01) {
    throw new Error("El límite del presupuesto debe ser mayor a 0.01")
  }
  if (!input.category_id && !input.category_name?.trim()) {
    throw new Error("El presupuesto debe estar asignado a una categoría")
  }

  const roundedAmount = roundCurrencyAmount(input.amount)

  const outboxItem = buildOutboxItem({
    userId, operation: "create_budget", entity: "budgets",
    payload: input,
  })
  if (await tryEnqueueOffline(outboxItem, ["planning_budgets_with_usage"])) return

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_tier, email")
    .eq("id", userId)
    .maybeSingle()
  const plan = isTestFullAccessEmail(userData.email) || isTestFullAccessEmail((profile as any)?.email)
    ? "pro"
    : normalizePlanTier((profile as any)?.plan_tier as string | undefined) || DEFAULT_PLAN
  const limits = ENTITLEMENTS_BY_PLAN[plan] || ENTITLEMENTS_BY_PLAN[DEFAULT_PLAN]

  if (limits.max_budgets !== "unlimited") {
    const { count } = await supabase
      .from("budgets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_active", true)
    const usage = Number(count || 0)
    if (usage >= limits.max_budgets) {
      throw blockedEntitlement({
        feature: "max_budgets",
        reason: "Llegaste al limite de presupuestos del plan Free.",
        currentUsage: usage,
        limit: limits.max_budgets,
      })
    }
  }

  try {
    const { error } = await supabase.from("budgets").insert({
      user_id: userId,
      category_id: input.category_id || null,
      category_name: input.category_name,
      name: input.name,
      amount: roundedAmount,
      currency: input.currency,
      period: "monthly",
      alert_threshold: input.alert_threshold,
      is_active: true,
    })
    if (error) throw error
    mutate("planning_budgets_with_usage")
  } catch (err: any) {
    if (isOfflineError(err)) {
      await enqueueOfflineFallback(outboxItem, ["planning_budgets_with_usage"])
      return
    }
    throw err
  }
}

export async function updateBudget(input: {
  id: string
  category_id?: string | null
  category_name: string
  name: string
  amount: number
  currency: "DOP" | "USD"
  alert_threshold: number
}) {
  const userData = await getAuthenticatedUser()
  if (!userData) throw new Error("No autenticado")

  const outboxItem = buildOutboxItem({
    userId: userData.id, operation: "update_budget", entity: "budgets",
    payload: input,
  })
  if (await tryEnqueueOffline(outboxItem, ["planning_budgets_with_usage"])) return

  try {
    const { error } = await supabase
      .from("budgets")
      .update({
        category_id: input.category_id || null,
        category_name: input.category_name,
        name: input.name,
        amount: input.amount,
        currency: input.currency,
        alert_threshold: input.alert_threshold,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id)
      .eq("user_id", userData.id)

    if (error) throw error
    mutate("planning_budgets_with_usage")
  } catch (err: any) {
    if (isOfflineError(err)) {
      await enqueueOfflineFallback(outboxItem, ["planning_budgets_with_usage"])
      return
    }
    throw err
  }
}

export async function deactivateBudget(id: string) {
  const userData = await getAuthenticatedUser()
  if (!userData) throw new Error("No autenticado")

  const outboxItem = buildOutboxItem({
    userId: userData.id, operation: "delete_budget", entity: "budgets",
    payload: { id },
  })
  if (await tryEnqueueOffline(outboxItem, ["planning_budgets_with_usage"])) return

  try {
    const { error } = await supabase
      .from("budgets")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userData.id)

    if (error) throw error
    mutate("planning_budgets_with_usage")
  } catch (err: any) {
    if (isOfflineError(err)) {
      await enqueueOfflineFallback(outboxItem, ["planning_budgets_with_usage"])
      return
    }
    throw err
  }
}

export async function createDebt(input: {
  name: string
  debt_type: Debt["debt_type"]
  original_amount: number
  current_balance: number
  currency: "DOP" | "USD"
  linked_account_id?: string | null
  fixed_payment_amount?: number | null
  payment_frequency?: Debt["payment_frequency"]
  payment_day?: number | null
  start_date?: string | null
  interest_rate?: number | null
  notes?: string | null
}) {
  const userData = await getAuthenticatedUser()
  if (!userData) throw new Error("No autenticado")
  const userId = userData.id

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_tier, email")
    .eq("id", userId)
    .maybeSingle()
  const plan = isTestFullAccessEmail(userData.email) || isTestFullAccessEmail((profile as any)?.email)
    ? "pro"
    : normalizePlanTier((profile as any)?.plan_tier as string | undefined) || DEFAULT_PLAN
  const limits = ENTITLEMENTS_BY_PLAN[plan] || ENTITLEMENTS_BY_PLAN[DEFAULT_PLAN]

  if (limits.max_active_debts !== "unlimited") {
    const { count } = await supabase
      .from("debts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_active", true)

    const usage = Number(count || 0)
    if (usage >= limits.max_active_debts) {
      throw blockedEntitlement({
        feature: "max_active_debts",
        reason: "Llegaste al limite de deudas activas del plan Free.",
        currentUsage: usage,
        limit: limits.max_active_debts,
      })
    }
  }

  const outboxItem = buildOutboxItem({
    userId, operation: "create_debt", entity: "debts",
    payload: input,
  })
  if (await tryEnqueueOffline(outboxItem, ["planning_debts", "planning_calendar_events", "accounts"])) {
    return { id: outboxItem.id, user_id: userId, ...input } as Debt
  }

  try {
    const { data, error } = await supabase.from("debts").insert({
      user_id: userId,
      name: input.name,
      debt_type: input.debt_type,
      original_amount: normalizePositiveAmount(input.original_amount),
      current_balance: normalizePositiveAmount(input.current_balance),
      currency: input.currency,
      linked_account_id: input.linked_account_id || null,
      fixed_payment_amount: input.fixed_payment_amount ? normalizeAmount(input.fixed_payment_amount) : null,
      payment_frequency: input.payment_frequency || "monthly",
      payment_day: input.payment_day || null,
      start_date: input.start_date || null,
      interest_rate: input.interest_rate || null,
      notes: input.notes || null,
      is_active: true,
    }).select("*").single()

    if (error) throw error
    mutate("planning_debts")
    mutate("planning_calendar_events")
    mutate("accounts")
    mutate((key: any) => Array.isArray(key) && key[0] === "transactions")
    return data as Debt
  } catch (err: any) {
    if (isOfflineError(err)) {
      await enqueueOfflineFallback(outboxItem, ["planning_debts", "planning_calendar_events", "accounts"])
      return { id: outboxItem.id, user_id: userId, ...input } as Debt
    }
    throw err
  }
}

export async function payDebt(input: {
  debt_id: string
  source_account_id: string
  amount: number
  notes?: string | null
}) {
  const userData = await getAuthenticatedUser()
  if (!userData) throw new Error("No autenticado")
  const userId = userData.id

  const amount = normalizePositiveAmount(input.amount)
  if (amount <= 0) throw new Error("Monto invalido")

  const [{ data: debt, error: debtError }, { data: sourceAccount, error: sourceError }] = await Promise.all([
    supabase.from("debts").select("id, name, current_balance, currency, linked_account_id, fixed_payment_amount, payment_frequency, payment_day, is_active").eq("id", input.debt_id).eq("user_id", userId).single(),
    supabase.from("accounts").select("id,name,balance,currency,type,user_id").eq("id", input.source_account_id).eq("user_id", userId).single(),
  ])

  if (debtError || !debt) throw debtError || new Error("No se encontro la deuda")
  if (sourceError || !sourceAccount) throw sourceError || new Error("No se encontro la cuenta de origen")

  const sourceCurrency = (sourceAccount.currency || "DOP") as "DOP" | "USD"

  const previousDebtBalance = normalizeAmount((debt as any).current_balance || 0)
  if (amount > previousDebtBalance) throw new Error("El monto no puede superar el pendiente de la deuda")

  const newDebtBalance = normalizeAmount(Math.max(0, previousDebtBalance - amount))

  let debtPaymentId: string | null = null
  let transactionId: string | null = null

  try {
    // Step 1: Debit source account via applyAccountImpact (validates currency + funds).
    await applyAccountImpact({
      accountId: input.source_account_id,
      type: "expense",
      amount,
      direction: 1,
      currency: sourceCurrency,
    })

    // Step 2: Update debt balance.
    const { error: updateDebtError } = await supabase
      .from("debts")
      .update({
        current_balance: newDebtBalance,
        is_active: newDebtBalance > 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.debt_id)

    if (updateDebtError) throw updateDebtError

    // Step 3: Insert debt_payment record.
    const { data: insertedPayment, error: paymentError } = await supabase
      .from("debt_payments")
      .insert({
        user_id: userId,
        debt_id: input.debt_id,
        source_account_id: input.source_account_id,
        amount,
        currency: sourceCurrency,
        previous_debt_balance: previousDebtBalance,
        new_debt_balance: newDebtBalance,
        notes: input.notes || null,
      })
      .select("id,payment_date")
      .single()

    if (paymentError || !insertedPayment) throw paymentError || new Error("No se pudo registrar el pago")
    debtPaymentId = insertedPayment.id

    // Step 4: Insert transaction with source account's currency.
    const { data: insertedTx, error: txError } = await supabase
      .from("transactions")
      .insert({
        user_id: userId,
        account_id: input.source_account_id,
        category_id: null,
        type: "expense",
        amount,
        currency: sourceCurrency,
        amount_base: amount,
        exchange_rate: 1,
        description: `Pago de deuda: ${(debt as any).name}`,
        date: getLocalDateString(),
        notes: input.notes || null,
        is_recurring: false,
        metadata: {
          kind: "debt_payment",
          debt_id: input.debt_id,
          debt_payment_id: debtPaymentId,
          payment_group_id: debtPaymentId,
        },
      })
      .select("id")
      .single()

    if (txError || !insertedTx) throw txError || new Error("No se pudo registrar el movimiento")
    transactionId = insertedTx.id

    // Step 5: Link transaction_id back to debt_payment.
    const { error: linkError } = await supabase
      .from("debt_payments")
      .update({ transaction_id: transactionId })
      .eq("id", debtPaymentId)

    if (linkError) throw linkError

    try {
      const ledger = LedgerService.create()
      await ledger.recordExpense(userId, input.source_account_id, amount, sourceCurrency, `Pago de deuda: ${(debt as any).name}`)
    } catch (e) {
      console.error("Ledger write failed (non-blocking):", e)
    }

    await syncAccountBalance(input.source_account_id, sourceCurrency)

    await Promise.all([
      mutate("accounts"),
      mutate("planning_debts"),
      mutate("planning_debt_payments_month"),
      mutate("planning_calendar_events"),
      mutate((key: any) => Array.isArray(key) && key[0] === "transactions"),
      mutate("planning_budgets_with_usage"),
    ])

    return {
      debt: debt as Debt,
      amount,
      previousDebtBalance,
      newDebtBalance,
      sourceAccount: sourceAccount as any,
      previousSourceBalance: normalizeAmount((sourceAccount as any).balance || 0),
      newSourceBalance: normalizeAmount((sourceAccount as any).balance - amount),
      paymentDate: insertedPayment.payment_date,
      notes: input.notes || "",
    }
  } catch (error) {
    // Rollback: reverse the account impact first.
    try {
      await applyAccountImpact({
        accountId: input.source_account_id,
        type: "expense",
        amount,
        direction: -1,
        currency: sourceCurrency,
      })
    } catch (rollbackError) {
      console.error("Rollback of account impact failed:", rollbackError)
    }

    if (transactionId) {
      await supabase.from("transactions").delete().eq("id", transactionId)
    }
    if (debtPaymentId) {
      await supabase.from("debt_payments").delete().eq("id", debtPaymentId)
    }
    await supabase.from("debts").update({ current_balance: previousDebtBalance, is_active: true }).eq("id", input.debt_id)

    await Promise.all([
      mutate("accounts"),
      mutate("planning_debts"),
      mutate("planning_debt_payments_month"),
      mutate((key: any) => Array.isArray(key) && key[0] === "transactions"),
    ])

    throw error
  }
}
