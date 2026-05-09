"use client"

import useSWR, { mutate } from "swr"
import { createClient } from "@/lib/supabase/client"
import type {
  Account,
  Transaction,
  Category,
  Goal,
  Notification,
  Profile,
  Beneficiary,
  Transfer,
  GoalContribution,
} from "@/lib/types/database"
import { getLocalDateString } from "@/lib/data"
import { getCycleForDate } from "@/lib/credit-cycle"

type CreditAccountState = {
  id: string
  user_id: string
  name: string
  currency: "DOP" | "USD"
  credit_limit_dop: number | null
  credit_limit_usd: number | null
  current_debt_dop: number | null
  current_debt_usd: number | null
  statement_balance_dop: number | null
  statement_balance_usd: number | null
  paid_statement_amount_dop: number | null
  paid_statement_amount_usd: number | null
  pending_transit_dop: number | null
  pending_transit_usd: number | null
  closing_day: number | null
  due_days_after_cutoff: number | null
  annual_interest_rate: number | null
  minimum_payment_percentage: number | null
  last_statement_cutoff_date: string | null
  statement_due_date: string | null
  late_fee_applied_cycle_dop: string | null
  late_fee_applied_cycle_usd: string | null
  current_debt: number | null
  statement_balance: number | null
  pending_amount: number | null
  paid_amount: number | null
  closing_date: number | null
  due_date: number | null
  cycle_start_date: string | null
  cycle_end_date: string | null
}

const supabase = createClient()
let lastCreditSyncDay: string | null = null
let creditCycleSchemaChecked = false
let hasCreditCycleSchema = true
let hasNotificationMetadataSchema = true

const COMMISSION_RATE = 0.0015
const DEFAULT_MINIMUM_PAYMENT_PERCENTAGE = 0.0278
const LATE_FEE_RATE = 0.12
const COMMISSION_CATEGORY_NAME = "Commission / Fees"
const COMMISSION_ERROR_MESSAGE = "El monto más comisión excede tu balance disponible."

function roundCurrencyAmount(value: number): number {
  return Math.round(value * 100) / 100
}

function getCommissionAmount(amount: number): number {
  return roundCurrencyAmount(amount * COMMISSION_RATE)
}

function getCurrencyFields(currency: "DOP" | "USD") {
  return currency === "USD"
    ? {
        debt: "current_debt_usd",
        limit: "credit_limit_usd",
        statement: "statement_balance_usd",
        paidStatement: "paid_statement_amount_usd",
        pendingTransit: "pending_transit_usd",
        lateFeeCycle: "late_fee_applied_cycle_usd",
      }
    : {
        debt: "current_debt_dop",
        limit: "credit_limit_dop",
        statement: "statement_balance_dop",
        paidStatement: "paid_statement_amount_dop",
        pendingTransit: "pending_transit_dop",
        lateFeeCycle: "late_fee_applied_cycle_dop",
      }
}

function getMinimumPayment(statementBalance: number, percentage?: number | null) {
  return roundCurrencyAmount(statementBalance * Number(percentage ?? DEFAULT_MINIMUM_PAYMENT_PERCENTAGE))
}

function getMonthlyInterestRate(annualRate?: number | null) {
  return Number(annualRate ?? 0.60) / 12
}

function toDateOnly(dateValue: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateValue)
    ? new Date(`${dateValue}T12:00:00`)
    : new Date(dateValue)
}

function sortAccountsList(accounts: Account[]): Account[] {
  return [...accounts].sort((a, b) => {
    if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1

    const aSort = a.sort_order
    const bSort = b.sort_order
    if (aSort !== null && bSort !== null) return aSort - bSort
    if (aSort !== null) return -1
    if (bSort !== null) return 1

    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })
}

async function getOrCreateCommissionCategoryId(userId: string): Promise<string | null> {
  const { data: existing } = await supabase
    .from("categories")
    .select("id")
    .eq("name", COMMISSION_CATEGORY_NAME)
    .eq("type", "expense")
    .or(`is_default.eq.true,user_id.eq.${userId}`)
    .order("is_default", { ascending: false })
    .limit(1)

  if (existing && existing.length > 0) {
    return existing[0].id
  }

  const { data: created, error } = await supabase
    .from("categories")
    .insert({
      user_id: userId,
      name: COMMISSION_CATEGORY_NAME,
      icon: "circle",
      color: "#64748b",
      type: "expense",
      is_default: false,
    })
    .select("id")
    .single()

  if (error) throw error
  return created?.id || null
}

async function ensureSufficientFundsForExpense(accountId: string, totalAmount: number, currency: "DOP" | "USD") {
  const { data: account } = await supabase
    .from("accounts")
    .select("id, type, balance, credit_limit, current_debt, credit_limit_dop, credit_limit_usd, current_debt_dop, current_debt_usd")
    .eq("id", accountId)
    .single()

  if (!account) throw new Error("Cuenta no encontrada")

  if (account.type === "credit") {
    const fields = getCurrencyFields(currency)
    const creditLimit = Number((account as Record<string, unknown>)[fields.limit] ?? account.credit_limit ?? 0)
    const currentDebt = Number((account as Record<string, unknown>)[fields.debt] ?? account.current_debt ?? 0)
    const availableCredit = creditLimit - currentDebt
    if (totalAmount > availableCredit) {
      throw new Error(COMMISSION_ERROR_MESSAGE)
    }
    return
  }

  if (Number(account.balance) < totalAmount) {
    throw new Error(COMMISSION_ERROR_MESSAGE)
  }
}

async function ensureCreditSchemas() {
  if (creditCycleSchemaChecked) {
    return {
      hasCreditCycleSchema,
      hasNotificationMetadataSchema,
    }
  }

  const { error: accountSchemaError } = await supabase
    .from("accounts")
    .select("statement_balance_dop, statement_balance_usd, current_debt_dop, current_debt_usd, closing_day, due_days_after_cutoff")
    .limit(1)

  hasCreditCycleSchema = !accountSchemaError

  const { error: notificationSchemaError } = await supabase
    .from("notifications")
    .select("metadata")
    .limit(1)

  hasNotificationMetadataSchema = !notificationSchemaError
  creditCycleSchemaChecked = true

  return {
    hasCreditCycleSchema,
    hasNotificationMetadataSchema,
  }
}

async function upsertCreditNotification(params: {
  userId: string
  title: string
  message: string
  metadata: Record<string, unknown>
}) {
  const schema = await ensureCreditSchemas()
  if (!schema.hasNotificationMetadataSchema) return

  const { userId, title, message, metadata } = params
  const today = getLocalDateString()
  const tomorrowDate = new Date(today)
  tomorrowDate.setDate(tomorrowDate.getDate() + 1)
  const tomorrow = getLocalDateString(tomorrowDate)
  const { data: existing } = await supabase
    .from("notifications")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "credit")
    .gte("created_at", `${today}T00:00:00`)
    .lt("created_at", `${tomorrow}T00:00:00`)
    .contains("metadata", { kind: metadata.kind, account_id: metadata.account_id })
    .limit(1)

  if (existing && existing.length > 0) return

  await supabase.from("notifications").insert({
    user_id: userId,
    title,
    message,
    type: "credit",
    read: false,
    action_url: "/pay",
    metadata,
  })
}

async function syncCreditAccountCycle(creditAccountId: string) {
  const schema = await ensureCreditSchemas()
  if (!schema.hasCreditCycleSchema) return

  const { data: account } = await supabase
    .from("accounts")
    .select("id, user_id, name, currency, credit_limit_dop, credit_limit_usd, current_debt_dop, current_debt_usd, statement_balance_dop, statement_balance_usd, paid_statement_amount_dop, paid_statement_amount_usd, pending_transit_dop, pending_transit_usd, closing_day, due_days_after_cutoff, minimum_payment_percentage, annual_interest_rate, last_statement_cutoff_date, statement_due_date, late_fee_applied_cycle_dop, late_fee_applied_cycle_usd")
    .eq("id", creditAccountId)
    .eq("type", "credit")
    .single<CreditAccountState>()

  if (!account || !account.closing_day) return

  const dueDays = Number(account.due_days_after_cutoff || 20)
  const now = new Date()
  const currentCycle = getCycleForDate(account.closing_day, dueDays, now)

  const { data: txRows } = await supabase
    .from("transactions")
    .select("id, amount, type, currency, date, billing_cycle_id")
    .eq("account_id", account.id)

  const cycleMap = new Map<string, {
    cycleStartDate: string
    cycleEndDate: string
    dueDate: string
    statement_balance_dop: number
    statement_balance_usd: number
    txIds: string[]
  }>()

  let currentBalanceDop = 0
  let currentBalanceUsd = 0
  for (const tx of txRows || []) {
    const signed = tx.type === "expense" ? Number(tx.amount || 0) : -Number(tx.amount || 0)
    if (tx.currency === "USD") currentBalanceUsd += signed
    else currentBalanceDop += signed

    const txDate = toDateOnly(tx.date)
    const txCycle = getCycleForDate(account.closing_day, dueDays, txDate)
    const existing = cycleMap.get(txCycle.cycleEndDate) || {
      cycleStartDate: txCycle.cycleStartDate,
      cycleEndDate: txCycle.cycleEndDate,
      dueDate: txCycle.dueDate,
      statement_balance_dop: 0,
      statement_balance_usd: 0,
      txIds: [],
    }

    if (tx.currency === "USD") existing.statement_balance_usd = roundCurrencyAmount(existing.statement_balance_usd + signed)
    else existing.statement_balance_dop = roundCurrencyAmount(existing.statement_balance_dop + signed)
    existing.txIds.push(tx.id)
    cycleMap.set(txCycle.cycleEndDate, existing)
  }

  const { data: paymentRows } = await supabase
    .from("credit_payments")
    .select("amount,currency")
    .eq("credit_account_id", account.id)

  let totalPaidDop = 0
  let totalPaidUsd = 0
  for (const paymentRow of paymentRows || []) {
    const amount = Number(paymentRow.amount || 0)
    if (paymentRow.currency === "USD") totalPaidUsd += amount
    else totalPaidDop += amount
  }

  currentBalanceDop = roundCurrencyAmount(currentBalanceDop - totalPaidDop)
  currentBalanceUsd = roundCurrencyAmount(currentBalanceUsd - totalPaidUsd)
  currentBalanceDop = Math.max(0, roundCurrencyAmount(currentBalanceDop))
  currentBalanceUsd = Math.max(0, roundCurrencyAmount(currentBalanceUsd))

  const { data: existingCycles } = await supabase
    .from("credit_card_cycles")
    .select("id, cycle_start_date, cycle_end_date, due_date, statement_balance_dop, statement_balance_usd, paid_amount_dop, paid_amount_usd, financed_amount_dop, financed_amount_usd, interest_amount_dop, interest_amount_usd, status")
    .eq("account_id", account.id)
    .order("cycle_end_date", { ascending: true })

  const existingByEndDate = new Map<string, any>()
  for (const cycleRow of existingCycles || []) {
    existingByEndDate.set(cycleRow.cycle_end_date, cycleRow)
  }

  for (const grouped of cycleMap.values()) {
    const existing = existingByEndDate.get(grouped.cycleEndDate)
    if (!existing) {
      const { data: inserted } = await supabase
        .from("credit_card_cycles")
        .insert({
          user_id: account.user_id,
          account_id: account.id,
          cycle_start_date: grouped.cycleStartDate,
          cycle_end_date: grouped.cycleEndDate,
          due_date: grouped.dueDate,
          statement_balance_dop: Math.max(0, grouped.statement_balance_dop),
          statement_balance_usd: Math.max(0, grouped.statement_balance_usd),
          paid_amount_dop: 0,
          paid_amount_usd: 0,
          status: grouped.cycleEndDate <= getLocalDateString() ? "closed" : "open",
        })
        .select("id")
        .single()

      const newCycleId = inserted?.id
      if (newCycleId && grouped.txIds.length > 0) {
        await supabase.from("transactions").update({ billing_cycle_id: newCycleId }).in("id", grouped.txIds)
      }
      continue
    }

    await supabase
      .from("credit_card_cycles")
      .update({
        cycle_start_date: grouped.cycleStartDate,
        due_date: grouped.dueDate,
        statement_balance_dop: Math.max(0, grouped.statement_balance_dop),
        statement_balance_usd: Math.max(0, grouped.statement_balance_usd),
      })
      .eq("id", existing.id)

    if (grouped.txIds.length > 0) {
      await supabase.from("transactions").update({ billing_cycle_id: existing.id }).in("id", grouped.txIds)
    }
  }

  const { data: refreshedCycles } = await supabase
    .from("credit_card_cycles")
    .select("id, cycle_start_date, cycle_end_date, due_date, statement_balance_dop, statement_balance_usd, paid_amount_dop, paid_amount_usd, financed_amount_dop, financed_amount_usd, interest_amount_dop, interest_amount_usd, status")
    .eq("account_id", account.id)
    .order("cycle_end_date", { ascending: true })

  let latestClosedCycle: any = null
  for (const row of refreshedCycles || []) {
    if (row.cycle_end_date <= getLocalDateString()) {
      latestClosedCycle = row
    }
  }

  let totalFinancedDop = 0
  let totalFinancedUsd = 0

  for (const row of refreshedCycles || []) {
    const dueDate = toDateOnly(row.due_date)
    const isOverdue = now.getTime() > dueDate.getTime()
    const statementPendingDop = Math.max(0, roundCurrencyAmount(Number(row.statement_balance_dop || 0) - Number(row.paid_amount_dop || 0)))
    const statementPendingUsd = Math.max(0, roundCurrencyAmount(Number(row.statement_balance_usd || 0) - Number(row.paid_amount_usd || 0)))

    let financedDop = Number(row.financed_amount_dop || 0)
    let financedUsd = Number(row.financed_amount_usd || 0)
    let interestDop = Number(row.interest_amount_dop || 0)
    let interestUsd = Number(row.interest_amount_usd || 0)
    let status: "open" | "closed" | "paid" | "partial" | "overdue" | "financed" = row.status

    if (isOverdue && (statementPendingDop > 0 || statementPendingUsd > 0)) {
      financedDop = statementPendingDop
      financedUsd = statementPendingUsd
      status = "financed"

      const monthlyRate = getMonthlyInterestRate(account.annual_interest_rate)
      if (interestDop <= 0 && financedDop > 0) {
        interestDop = roundCurrencyAmount(financedDop * monthlyRate)
      }
      if (interestUsd <= 0 && financedUsd > 0) {
        interestUsd = roundCurrencyAmount(financedUsd * monthlyRate)
      }
    } else if (statementPendingDop <= 0 && statementPendingUsd <= 0) {
      financedDop = 0
      financedUsd = 0
      status = "paid"
    } else if (Number(row.paid_amount_dop || 0) > 0 || Number(row.paid_amount_usd || 0) > 0) {
      status = "partial"
    } else if (row.cycle_end_date <= getLocalDateString()) {
      status = "closed"
    } else {
      status = "open"
    }

    totalFinancedDop += financedDop + interestDop
    totalFinancedUsd += financedUsd + interestUsd

    await supabase
      .from("credit_card_cycles")
      .update({
        financed_amount_dop: financedDop,
        financed_amount_usd: financedUsd,
        interest_amount_dop: interestDop,
        interest_amount_usd: interestUsd,
        status,
      })
      .eq("id", row.id)
  }

  const statementDop = Number(latestClosedCycle?.statement_balance_dop || 0)
  const statementUsd = Number(latestClosedCycle?.statement_balance_usd || 0)
  const paidDop = Number(latestClosedCycle?.paid_amount_dop || 0)
  const paidUsd = Number(latestClosedCycle?.paid_amount_usd || 0)
  const statementPendingDop = Math.max(0, roundCurrencyAmount(statementDop - paidDop))
  const statementPendingUsd = Math.max(0, roundCurrencyAmount(statementUsd - paidUsd))

  await supabase
    .from("accounts")
    .update({
      current_balance_dop: currentBalanceDop,
      current_balance_usd: currentBalanceUsd,
      current_debt_dop: currentBalanceDop,
      current_debt_usd: currentBalanceUsd,
      current_debt: currentBalanceDop,
      statement_balance_dop: statementDop,
      statement_balance_usd: statementUsd,
      statement_balance: statementDop,
      paid_statement_amount_dop: paidDop,
      paid_statement_amount_usd: paidUsd,
      paid_amount: paidDop,
      pending_amount: statementPendingDop,
      financed_balance_dop: roundCurrencyAmount(totalFinancedDop),
      financed_balance_usd: roundCurrencyAmount(totalFinancedUsd),
      available_credit_dop: Math.max(0, Number(account.credit_limit_dop || 0) - currentBalanceDop),
      available_credit_usd: Math.max(0, Number(account.credit_limit_usd || 0) - currentBalanceUsd),
      pending_transit_dop: Math.max(0, currentBalanceDop - statementPendingDop),
      pending_transit_usd: Math.max(0, currentBalanceUsd - statementPendingUsd),
      cycle_start_date: currentCycle.cycleStartDate,
      cycle_end_date: currentCycle.cycleEndDate,
      statement_due_date: latestClosedCycle?.due_date || currentCycle.dueDate,
      last_statement_cutoff_date: latestClosedCycle?.cycle_end_date || currentCycle.cycleEndDate,
      due_days_after_cutoff: dueDays,
      minimum_payment: getMinimumPayment(statementPendingDop, account.minimum_payment_percentage),
    })
    .eq("id", account.id)

  const lines = [
    { currency: "DOP" as const, pending: statementPendingDop },
    { currency: "USD" as const, pending: statementPendingUsd },
  ]

  const statementDueDate = latestClosedCycle?.due_date || currentCycle.dueDate
  const dueDateForReminder = toDateOnly(statementDueDate)
  const isOverdue = now.getTime() > dueDateForReminder.getTime()

  for (const line of lines) {
    if (line.pending <= 0) continue
    if (isOverdue) {
      await upsertCreditNotification({
        userId: account.user_id,
        title: `Estado vencido: ${account.name}`,
        message: `El corte de tu tarjeta está vencido. ${line.currency === "DOP" ? "RD$" : "US$"}${line.pending.toFixed(2)} ahora está financiado.`,
        metadata: {
          kind: "credit_statement_overdue",
          account_id: account.id,
          currency: line.currency,
          due_date: statementDueDate,
          pending_amount: line.pending,
        },
      })
      continue
    }

    await upsertCreditNotification({
      userId: account.user_id,
      title: `Pago pendiente: ${account.name}`,
      message: `Tienes ${line.currency === "DOP" ? "RD$" : "US$"}${line.pending.toFixed(2)} pendiente en el corte de tu tarjeta. Paga antes de ${statementDueDate}.`,
      metadata: {
        kind: "credit_payment_due",
        account_id: account.id,
        currency: line.currency,
        due_date: statementDueDate,
        cycle_end_date: latestClosedCycle?.cycle_end_date || currentCycle.cycleEndDate,
        pending_amount: line.pending,
      },
    })
  }
}

async function refreshAllCreditCycles() {
  const { data: creditAccounts } = await supabase
    .from("accounts")
    .select("id")
    .eq("type", "credit")
    .eq("is_active", true)

  if (!creditAccounts || creditAccounts.length === 0) return

  await Promise.all(creditAccounts.map((account) => syncCreditAccountCycle(account.id)))
}

async function maybeRefreshCreditCycles() {
  const today = getLocalDateString()
  if (lastCreditSyncDay === today) return
  await refreshAllCreditCycles()
  lastCreditSyncDay = today
}

async function applyAccountImpact(params: {
  accountId: string
  type: "income" | "expense"
  amount: number
  direction: 1 | -1
  currency?: "DOP" | "USD"
}) {
  const { accountId, type, amount, direction, currency = "DOP" } = params
  const { data: account } = await supabase
    .from("accounts")
    .select("id, type, balance, current_debt, current_debt_dop, current_debt_usd")
    .eq("id", accountId)
    .single()

  if (!account) throw new Error("Cuenta no encontrada")

  if (account.type === "credit") {
    const signed = type === "expense" ? amount * direction : -amount * direction
    const fields = getCurrencyFields(currency)
    const currentByCurrency = Number((account as Record<string, unknown>)[fields.debt] ?? 0)
    const nextDebt = Math.max(0, currentByCurrency + signed)
    const updates: Record<string, unknown> = { [fields.debt]: nextDebt }
    if (currency === "DOP") {
      updates.current_debt = nextDebt
    }
    await supabase.from("accounts").update(updates).eq("id", accountId)
    await syncCreditAccountCycle(accountId)
    return
  }

  const signed = type === "income" ? amount * direction : -amount * direction
  const nextBalance = Number(account.balance) + signed
  if (nextBalance < 0) {
    throw new Error("Fondos insuficientes en la cuenta")
  }
  await supabase.from("accounts").update({ balance: nextBalance }).eq("id", accountId)
}

// Generic fetcher for Supabase
async function fetchAccounts(): Promise<Account[]> {
  await maybeRefreshCreditCycles()

  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true })

  if (error) throw error
  return sortAccountsList(data || [])
}

async function fetchTransactions(limit = 10): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select(`
      *,
      category:categories(*),
      account:accounts(*)
    `)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) throw error
  return data || []
}

async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("name", { ascending: true })

  if (error) throw error
  return data || []
}

async function fetchGoals(): Promise<Goal[]> {
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) throw error
  return data || []
}

async function fetchNotifications(): Promise<Notification[]> {
  await maybeRefreshCreditCycles()

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20)

  if (error) throw error
  return data || []
}

async function fetchProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  if (error && error.code !== "PGRST116") throw error
  return data
}

async function fetchBeneficiaries(): Promise<Beneficiary[]> {
  const { data, error } = await supabase
    .from("beneficiaries")
    .select("*")
    .order("is_favorite", { ascending: false })
    .order("name", { ascending: true })

  if (error) throw error
  return data || []
}

// SWR Hooks
export function useAccounts() {
  return useSWR<Account[]>("accounts", fetchAccounts, {
    revalidateOnFocus: false,
    dedupingInterval: 5000,
  })
}

export function useTransactions(limit = 10) {
  return useSWR<Transaction[]>(
    ["transactions", limit],
    () => fetchTransactions(limit),
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  )
}

export function useCategories() {
  return useSWR<Category[]>("categories", fetchCategories, {
    revalidateOnFocus: false,
    dedupingInterval: 60000, // Categories don't change often
  })
}

export function useGoals() {
  return useSWR<Goal[]>("goals", fetchGoals, {
    revalidateOnFocus: false,
    dedupingInterval: 5000,
  })
}

export function useNotifications() {
  return useSWR<Notification[]>("notifications", fetchNotifications, {
    revalidateOnFocus: true,
    refreshInterval: 60000,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    dedupingInterval: 15000,
  })
}

export function useProfile() {
  return useSWR<Profile | null>("profile", fetchProfile, {
    revalidateOnFocus: false,
  })
}

export function useBeneficiaries() {
  return useSWR<Beneficiary[]>("beneficiaries", fetchBeneficiaries, {
    revalidateOnFocus: false,
    dedupingInterval: 5000,
  })
}

// Mutations
type NewAccountInput = Omit<Account, "id" | "user_id" | "created_at" | "updated_at" | "statement_balance" | "pending_amount" | "paid_amount" | "cycle_start_date" | "cycle_end_date" | "sort_order" | "is_favorite" | "icon_url" | "icon_type" | "icon_value" | "primary_color" | "secondary_color" | "background_style" | "credit_limit_dop" | "credit_limit_usd" | "current_balance_dop" | "current_balance_usd" | "current_debt_dop" | "current_debt_usd" | "statement_balance_dop" | "statement_balance_usd" | "paid_statement_amount_dop" | "paid_statement_amount_usd" | "pending_transit_dop" | "pending_transit_usd" | "financed_balance_dop" | "financed_balance_usd" | "available_credit_dop" | "available_credit_usd" | "closing_day" | "payment_due_day" | "due_days_after_cutoff" | "annual_interest_rate" | "minimum_payment_percentage" | "last_statement_cutoff_date" | "statement_due_date" | "late_fee_applied_cycle_dop" | "late_fee_applied_cycle_usd"> & {
  statement_balance?: number | null
  pending_amount?: number | null
  paid_amount?: number | null
  cycle_start_date?: string | null
  cycle_end_date?: string | null
  icon_url?: string | null
  icon_type?: "emoji" | "icon" | "image" | null
  icon_value?: string | null
  primary_color?: string | null
  secondary_color?: string | null
  background_style?: string | null
  credit_limit_dop?: number | null
  credit_limit_usd?: number | null
  current_balance_dop?: number | null
  current_balance_usd?: number | null
  current_debt_dop?: number | null
  current_debt_usd?: number | null
  statement_balance_dop?: number | null
  statement_balance_usd?: number | null
  paid_statement_amount_dop?: number | null
  paid_statement_amount_usd?: number | null
  pending_transit_dop?: number | null
  pending_transit_usd?: number | null
  financed_balance_dop?: number | null
  financed_balance_usd?: number | null
  available_credit_dop?: number | null
  available_credit_usd?: number | null
  closing_day?: number | null
  payment_due_day?: number | null
  due_days_after_cutoff?: number | null
  annual_interest_rate?: number | null
  minimum_payment_percentage?: number | null
  last_statement_cutoff_date?: string | null
  statement_due_date?: string | null
  late_fee_applied_cycle_dop?: string | null
  late_fee_applied_cycle_usd?: string | null
}

export async function createAccount(account: NewAccountInput) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { data, error } = await supabase
    .from("accounts")
    .insert({ ...account, user_id: user.id })
    .select()
    .single()

  if (error) throw error
  mutate("accounts")
  return data
}

export async function createTransaction(
  transaction: Omit<Transaction, "id" | "user_id" | "created_at" | "category" | "account">,
  options?: { applyCommission?: boolean }
) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const applyCommission = Boolean(options?.applyCommission && transaction.type === "expense")
  const commissionAmount = applyCommission ? getCommissionAmount(transaction.amount) : 0
  const totalAmount = roundCurrencyAmount(transaction.amount + commissionAmount)

  if (transaction.type === "expense") {
    await ensureSufficientFundsForExpense(transaction.account_id, totalAmount, transaction.currency)
  }

  let billingCycleId: string | null = null
  let isStatementTransaction = false

  const { data: accountForCycle } = await supabase
    .from("accounts")
    .select("id, user_id, type, closing_day, due_days_after_cutoff")
    .eq("id", transaction.account_id)
    .single()

  if (accountForCycle?.type === "credit" && accountForCycle.closing_day) {
    const txDate = /^\d{4}-\d{2}-\d{2}$/.test(transaction.date)
      ? new Date(`${transaction.date}T12:00:00`)
      : new Date(transaction.date)
    const txCycle = getCycleForDate(Number(accountForCycle.closing_day), Number(accountForCycle.due_days_after_cutoff || 20), txDate)
    const { data: existingCycle } = await supabase
      .from("credit_card_cycles")
      .select("id")
      .eq("account_id", accountForCycle.id)
      .eq("cycle_end_date", txCycle.cycleEndDate)
      .maybeSingle()

    if (existingCycle?.id) {
      billingCycleId = existingCycle.id
    } else {
      const { data: createdCycle } = await supabase
        .from("credit_card_cycles")
        .insert({
          user_id: accountForCycle.user_id,
          account_id: accountForCycle.id,
          cycle_start_date: txCycle.cycleStartDate,
          cycle_end_date: txCycle.cycleEndDate,
          due_date: txCycle.dueDate,
          status: "open",
        })
        .select("id")
        .single()
      billingCycleId = createdCycle?.id || null
    }

    const nowCycle = getCycleForDate(Number(accountForCycle.closing_day), Number(accountForCycle.due_days_after_cutoff || 20))
    isStatementTransaction = txCycle.cycleEndDate <= nowCycle.cycleEndDate
  }

  const { data, error } = await supabase
    .from("transactions")
    .insert({ ...transaction, user_id: user.id, billing_cycle_id: billingCycleId, is_statement_transaction: isStatementTransaction })
    .select()
    .single()

  if (error) throw error

  let commissionTxId: string | null = null

  if (applyCommission && commissionAmount > 0) {
    const commissionCategoryId = await getOrCreateCommissionCategoryId(user.id)
    const { data: commissionTx, error: commissionError } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        account_id: transaction.account_id,
        category_id: commissionCategoryId,
        type: "expense",
        amount: commissionAmount,
        currency: transaction.currency,
        amount_base: commissionAmount,
        exchange_rate: transaction.exchange_rate,
        description: `0.15% commission of ${transaction.description || "transaction"}`,
        date: transaction.date,
        notes: null,
        is_recurring: false,
        parent_transaction_id: data.id,
        metadata: { kind: "commission", rate: COMMISSION_RATE },
      })
      .select("id")
      .single()

    if (commissionError) {
      await supabase.from("transactions").delete().eq("id", data.id)
      throw commissionError
    }

    commissionTxId = commissionTx?.id || null
  }

  try {
    await applyAccountImpact({
      accountId: transaction.account_id,
      type: transaction.type,
      amount: transaction.amount,
      direction: 1,
      currency: transaction.currency,
    })

    if (commissionTxId && commissionAmount > 0) {
      await applyAccountImpact({
        accountId: transaction.account_id,
        type: "expense",
        amount: commissionAmount,
        direction: 1,
        currency: transaction.currency,
      })
    }
  } catch (impactError) {
    if (commissionTxId) {
      await supabase.from("transactions").delete().eq("id", commissionTxId)
    }
    await supabase.from("transactions").delete().eq("id", data.id)
    throw impactError
  }

  // Mutate transactions and accounts
  mutate((key: any) => Array.isArray(key) && key[0] === "transactions")
  mutate("accounts")

  return data
}

export async function updateTransaction(
  id: string,
  updates: Pick<Transaction, "account_id" | "type" | "amount" | "description" | "date" | "category_id" | "notes" | "currency" | "amount_base" | "exchange_rate" | "is_recurring">
) {
  const { data: existing, error: existingError } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", id)
    .single()

  if (existingError || !existing) throw existingError || new Error("Transacción no encontrada")

  await applyAccountImpact({
    accountId: existing.account_id,
    type: existing.type,
    amount: Number(existing.amount),
    direction: -1,
    currency: existing.currency,
  })

  const { data, error } = await supabase
    .from("transactions")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    await applyAccountImpact({
      accountId: existing.account_id,
      type: existing.type,
    amount: Number(existing.amount),
    direction: 1,
    currency: existing.currency,
  })
    throw error
  }

  await applyAccountImpact({
    accountId: updates.account_id,
    type: updates.type,
    amount: Number(updates.amount),
    direction: 1,
    currency: updates.currency,
  })

  mutate((key: any) => Array.isArray(key) && key[0] === "transactions")
  mutate("accounts")
  return data
}

export async function deleteTransaction(id: string) {
  const { data: existing, error: existingError } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", id)
    .single()

  if (existingError || !existing) throw existingError || new Error("Transacción no encontrada")

  await applyAccountImpact({
    accountId: existing.account_id,
    type: existing.type,
    amount: Number(existing.amount),
    direction: -1,
    currency: existing.currency,
  })

  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)

  if (error) throw error

  mutate((key: any) => Array.isArray(key) && key[0] === "transactions")
  mutate("accounts")
}

export async function updateProfile(updates: Partial<Profile>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id)
    .select()
    .single()

  if (error) throw error
  mutate("profile")
  return data
}

export async function markNotificationAsRead(id: string) {
  mutate("notifications", (prev?: Notification[]) =>
    (prev || []).map((n) => (n.id === id ? { ...n, read: true } : n)),
    false
  )

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", id)

  if (error) {
    mutate("notifications")
    throw error
  }

  mutate("notifications")
}

export async function markAllNotificationsAsRead() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  mutate("notifications", (prev?: Notification[]) =>
    (prev || []).map((n) => ({ ...n, read: true })),
    false
  )

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", user.id)
    .eq("read", false)

  if (error) {
    mutate("notifications")
    throw error
  }

  mutate("notifications")
}

// Goal mutations
export async function createGoal(goal: Omit<Goal, "id" | "user_id" | "created_at" | "updated_at" | "is_completed" | "current_amount">) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { data, error } = await supabase
    .from("goals")
    .insert({ ...goal, user_id: user.id, current_amount: 0, is_completed: false })
    .select()
    .single()

  if (error) throw error
  mutate("goals")
  return data
}

export async function updateGoal(id: string, updates: Partial<Goal>) {
  const { data, error } = await supabase
    .from("goals")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteGoal(id: string) {
  const { error } = await supabase
    .from("goals")
    .delete()
    .eq("id", id)

  if (error) throw error
}

export async function addGoalContribution(contribution: Omit<GoalContribution, "id" | "created_at" | "user_id">) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  // Insert contribution
  const { data: newContribution, error: contribError } = await supabase
    .from("goal_contributions")
    .insert({ ...contribution, user_id: user.id })
    .select()
    .single()

  if (contribError) throw contribError

  // Update goal current_amount
  const { data: goal } = await supabase
    .from("goals")
    .select("current_amount, target_amount")
    .eq("id", contribution.goal_id)
    .single()

  if (goal) {
    const newAmount = Number(goal.current_amount) + Number(contribution.amount)
    const isCompleted = newAmount >= Number(goal.target_amount)
    
    await supabase
      .from("goals")
      .update({ current_amount: newAmount, is_completed: isCompleted })
      .eq("id", contribution.goal_id)
  }

  await supabase.from("transactions").insert({
    user_id: user.id,
    account_id: contribution.account_id,
    category_id: null,
    type: "expense",
    amount: contribution.amount,
    currency: "DOP",
    amount_base: contribution.amount,
    exchange_rate: 1,
    description: "Aporte a meta de ahorro",
    date: contribution.date,
    notes: contribution.notes || null,
    is_recurring: false,
  })

  mutate("goals")
  mutate((key: any) => Array.isArray(key) && key[0] === "transactions")
  mutate("accounts")
  return newContribution
}

// Transfer mutations
export async function createTransfer(transfer: {
  from_account_id: string
  to_account_id?: string
  to_beneficiary_id?: string
  amount: number
  currency: string
  description?: string
  apply_commission?: boolean
}) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  // Get current balances
  const { data: fromAccount } = await supabase
    .from("accounts")
    .select("balance, type, currency")
    .eq("id", transfer.from_account_id)
    .single()

  if (!fromAccount) throw new Error("Account not found")

  if (transfer.amount <= 0) throw new Error("Monto inválido")

  const commissionAmount = transfer.apply_commission ? getCommissionAmount(transfer.amount) : 0
  const totalAmount = roundCurrencyAmount(transfer.amount + commissionAmount)
  if (Number(fromAccount.balance) < totalAmount) {
    throw new Error(COMMISSION_ERROR_MESSAGE)
  }

  // Deduct from source account
  const newFromBalance = Number(fromAccount.balance) - totalAmount
  await supabase
    .from("accounts")
    .update({ balance: newFromBalance })
    .eq("id", transfer.from_account_id)

  // Add to destination if internal account
  let internalDestinationName: string | null = null

  if (transfer.to_account_id) {
    const { data: toAccount } = await supabase
      .from("accounts")
      .select("balance, name")
      .eq("id", transfer.to_account_id)
      .single()

    if (toAccount) {
      internalDestinationName = toAccount.name || null
      const newToBalance = Number(toAccount.balance) + transfer.amount
      await supabase
        .from("accounts")
        .update({ balance: newToBalance })
        .eq("id", transfer.to_account_id)
    }
  }

  // Create transfer record
  const { data, error } = await supabase
    .from("transfers")
    .insert({
      user_id: user.id,
      from_account_id: transfer.from_account_id,
      to_account_id: transfer.to_account_id || null,
      to_beneficiary_id: transfer.to_beneficiary_id || null,
      amount: transfer.amount,
      currency: transfer.currency,
      description: transfer.description || null,
    })
    .select()
    .single()

  if (error) {
    console.error("Transfer error:", error)
    throw error
  }

  const destinationLabel = transfer.to_beneficiary_id
    ? "beneficiario"
    : internalDestinationName || "cuenta destino"

  await supabase.from("transactions").insert({
    user_id: user.id,
    account_id: transfer.from_account_id,
    category_id: null,
    type: "expense",
    amount: transfer.amount,
    currency: transfer.currency,
    amount_base: transfer.amount,
    exchange_rate: 1,
    description: transfer.description || `Transferencia enviada a ${destinationLabel}`,
    date: getLocalDateString(),
    notes: transfer.description || null,
    is_recurring: false,
  })

  if (transfer.to_account_id) {
    await supabase.from("transactions").insert({
      user_id: user.id,
      account_id: transfer.to_account_id,
      category_id: null,
      type: "income",
      amount: transfer.amount,
      currency: transfer.currency,
      amount_base: transfer.amount,
      exchange_rate: 1,
      description: transfer.description || "Transferencia recibida",
      date: getLocalDateString(),
      notes: null,
      is_recurring: false,
    })
  }

  if (commissionAmount > 0) {
    const commissionCategoryId = await getOrCreateCommissionCategoryId(user.id)
    await supabase.from("transactions").insert({
      user_id: user.id,
      account_id: transfer.from_account_id,
      category_id: commissionCategoryId,
      type: "expense",
      amount: commissionAmount,
      currency: transfer.currency,
      amount_base: commissionAmount,
      exchange_rate: 1,
      description: `0.15% commission of ${transfer.description || "transfer"}`,
      date: getLocalDateString(),
      notes: null,
      is_recurring: false,
      metadata: { kind: "commission", rate: COMMISSION_RATE },
    })
  }
  
  // Mutate cache to refresh data
  mutate("accounts")
  mutate((key: any) => Array.isArray(key) && key[0] === "transactions")
  mutate(["transfers", 100])
  
  return data
}

// Credit card payment
export async function payCreditCard(payment: {
  credit_account_id: string
  source_account_id: string
  amount: number
  currency: "DOP" | "USD"
  payment_kind?: "balance_to_date" | "statement_balance" | "minimum_payment" | "custom"
  notes?: string
}) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  if (payment.amount <= 0) {
    throw new Error("El monto del pago debe ser mayor a cero")
  }

  const { data: creditCard } = await supabase
    .from("accounts")
    .select("id,name,credit_limit_dop,credit_limit_usd,current_debt,current_debt_dop,current_debt_usd,statement_balance_dop,statement_balance_usd,paid_statement_amount_dop,paid_statement_amount_usd,pending_amount,paid_amount,available_credit_dop,available_credit_usd")
    .eq("id", payment.credit_account_id)
    .single()

  if (!creditCard) throw new Error("Credit card not found")

  const { data: sourceAccount } = await supabase
    .from("accounts")
    .select("id,balance,currency")
    .eq("id", payment.source_account_id)
    .single()

  if (!sourceAccount) throw new Error("Source account not found")
  if (sourceAccount.currency !== payment.currency) {
    throw new Error("La cuenta origen debe tener la misma moneda del pago")
  }

  const fields = getCurrencyFields(payment.currency)
  const currentDebt = Number((creditCard as Record<string, unknown>)[fields.debt] ?? 0)
  const currentStatement = Number((creditCard as Record<string, unknown>)[fields.statement] ?? 0)
  const currentPaid = Number((creditCard as Record<string, unknown>)[fields.paidStatement] ?? 0)

  if (payment.amount > currentDebt) {
    throw new Error("No puedes pagar más que la deuda actual")
  }

  if (Number(sourceAccount.balance) < payment.amount) {
    throw new Error("Disponible insuficiente en la cuenta origen para este pago")
  }

  const newDebt = roundCurrencyAmount(Math.max(0, currentDebt - payment.amount))
  const statementRemaining = Math.max(0, currentStatement - currentPaid)
  const paidTowardStatement = Math.min(payment.amount, statementRemaining)
  const newPaidStatement = roundCurrencyAmount(currentPaid + paidTowardStatement)
  const cardLimit = Number((creditCard as Record<string, unknown>)[fields.limit] ?? 0)
  const newAvailableCredit = roundCurrencyAmount(Math.min(cardLimit, Math.max(0, cardLimit - newDebt)))
  const optimisticSourceBalance = roundCurrencyAmount(Number(sourceAccount.balance || 0) - payment.amount)
  const optimisticPendingAmount = Math.max(0, roundCurrencyAmount(currentStatement - newPaidStatement))

  const updates: Record<string, unknown> = {
    [fields.debt]: newDebt,
    [fields.paidStatement]: newPaidStatement,
    [`available_credit_${payment.currency.toLowerCase()}`]: newAvailableCredit,
  }

  if (payment.currency === "DOP") {
    updates.current_debt = newDebt
    updates.pending_amount = optimisticPendingAmount
    updates.paid_amount = newPaidStatement
  }

  await mutate("accounts", (currentAccounts?: Account[]) => {
    if (!currentAccounts) return currentAccounts
    return currentAccounts.map((account) => {
      if (account.id === payment.credit_account_id) {
        const next = { ...account } as Account
        if (payment.currency === "USD") {
          next.current_debt_usd = newDebt
          next.paid_statement_amount_usd = newPaidStatement
          next.available_credit_usd = newAvailableCredit
        } else {
          next.current_debt_dop = newDebt
          next.paid_statement_amount_dop = newPaidStatement
          next.available_credit_dop = newAvailableCredit
          next.current_debt = newDebt
          next.pending_amount = optimisticPendingAmount
          next.paid_amount = newPaidStatement
        }
        return next
      }

      if (account.id === payment.source_account_id) {
        return { ...account, balance: optimisticSourceBalance }
      }

      return account
    })
  }, false)

  mutate(
    (key: unknown) => Array.isArray(key) && key[0] === "transactions",
    (existing?: Transaction[]) => {
      if (!existing || existing.length === 0) return existing
      const optimisticTx: Transaction = {
        id: `optimistic-credit-payment-${Date.now()}`,
        user_id: user.id,
        account_id: payment.source_account_id,
        category_id: null,
        type: "expense",
        amount: payment.amount,
        currency: payment.currency,
        amount_base: payment.amount,
        exchange_rate: 1,
        description: `Payment to ${String((creditCard as Record<string, unknown>).name || "tarjeta")}`,
        date: getLocalDateString(),
        notes: payment.notes || null,
        is_recurring: false,
        parent_transaction_id: null,
        metadata: { kind: "credit_payment", credit_account_id: payment.credit_account_id },
        created_at: new Date().toISOString(),
      }
      return [optimisticTx, ...existing]
    },
    false
  )

  try {
    await supabase
      .from("accounts")
      .update(updates)
      .eq("id", payment.credit_account_id)

    const { data: openCycles } = await supabase
      .from("credit_card_cycles")
      .select("id, cycle_end_date, due_date, paid_amount_dop, paid_amount_usd, statement_balance_dop, statement_balance_usd, financed_amount_dop, financed_amount_usd, status")
      .eq("account_id", payment.credit_account_id)
      .order("cycle_end_date", { ascending: true })

    if (openCycles && openCycles.length > 0) {
      let remainingToApply = payment.amount
      for (const cycleRow of openCycles) {
        if (remainingToApply <= 0) break
        const statement = payment.currency === "USD"
          ? Number(cycleRow.statement_balance_usd || 0)
          : Number(cycleRow.statement_balance_dop || 0)
        const paid = payment.currency === "USD"
          ? Number(cycleRow.paid_amount_usd || 0)
          : Number(cycleRow.paid_amount_dop || 0)
        const pending = Math.max(0, statement - paid)
        if (pending <= 0) continue

        const applied = Math.min(remainingToApply, pending)
        remainingToApply = roundCurrencyAmount(remainingToApply - applied)

        const nextPaid = roundCurrencyAmount(paid + applied)
        const cycleUpdates: Record<string, unknown> = {}
        if (payment.currency === "USD") cycleUpdates.paid_amount_usd = nextPaid
        else cycleUpdates.paid_amount_dop = nextPaid

        const pendingAfter = Math.max(0, roundCurrencyAmount(statement - nextPaid))
        if (pendingAfter <= 0) {
          cycleUpdates.status = "paid"
        } else if (nextPaid > 0) {
          const isOverdue = new Date(`${cycleRow.due_date}T12:00:00`).getTime() < Date.now()
          cycleUpdates.status = isOverdue ? "financed" : "partial"
        }

        await supabase.from("credit_card_cycles").update(cycleUpdates).eq("id", cycleRow.id)
      }
    }

    await supabase
      .from("accounts")
      .update({ balance: optimisticSourceBalance })
      .eq("id", payment.source_account_id)

    const { data, error } = await supabase
      .from("credit_payments")
      .insert({
        user_id: user.id,
        credit_account_id: payment.credit_account_id,
        source_account_id: payment.source_account_id,
        amount: payment.amount,
        currency: payment.currency,
        payment_kind: payment.payment_kind || "custom",
        notes: payment.notes || null,
      })
      .select()
      .single()

    if (error) {
      console.error("Payment error:", error)
      throw error
    }

    await supabase.from("transactions").insert({
      user_id: user.id,
      account_id: payment.source_account_id,
      category_id: null,
      type: "expense",
      amount: payment.amount,
      currency: payment.currency,
      amount_base: payment.amount,
      exchange_rate: 1,
      description: `Payment to ${String((creditCard as Record<string, unknown>).name || "tarjeta")}`,
      date: getLocalDateString(),
      notes: payment.notes || null,
      is_recurring: false,
      metadata: { kind: "credit_payment", credit_account_id: payment.credit_account_id, payment_kind: payment.payment_kind || "custom" },
    })

    await syncCreditAccountCycle(payment.credit_account_id)

    mutate("accounts")
    mutate((key: any) => Array.isArray(key) && key[0] === "transactions")

    return data
  } catch (error) {
    mutate("accounts")
    mutate((key: any) => Array.isArray(key) && key[0] === "transactions")
    throw error
  }
}

// Beneficiary mutations
export async function createBeneficiary(beneficiary: Omit<Beneficiary, "id" | "user_id" | "created_at">) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { data, error } = await supabase
    .from("beneficiaries")
    .insert({ ...beneficiary, user_id: user.id })
    .select()
    .single()

  if (error) throw error
  mutate("beneficiaries")
  return data
}

export async function updateBeneficiary(id: string, updates: Partial<Beneficiary>) {
  const { data, error } = await supabase
    .from("beneficiaries")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteBeneficiary(id: string) {
  const { error } = await supabase
    .from("beneficiaries")
    .delete()
    .eq("id", id)

  if (error) throw error
}

// Account updates
export async function updateAccountBalance(id: string, newBalance: number) {
  const { error } = await supabase
    .from("accounts")
    .update({ balance: newBalance })
    .eq("id", id)

  if (error) throw error
}

// Category mutations
export async function createCategory(category: Omit<Category, "id" | "user_id" | "created_at">) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { data, error } = await supabase
    .from("categories")
    .insert({ ...category, user_id: user.id })
    .select()
    .single()

  if (error) throw error
  mutate("categories")
  return data
}

export async function updateCategory(id: string, updates: Pick<Category, "name" | "icon" | "color" | "type">) {
  const { data, error } = await supabase
    .from("categories")
    .update(updates)
    .eq("id", id)
    .eq("is_default", false)
    .select()
    .single()

  if (error) throw error
  mutate("categories")
  return data
}

export async function deleteCategory(id: string, force = false) {
  const { data: txs, error: txError } = await supabase
    .from("transactions")
    .select("id")
    .eq("category_id", id)
    .limit(1)

  if (txError) throw txError
  if (!force && txs && txs.length > 0) {
    throw new Error("Esta categoría ya tiene movimientos asociados.")
  }

  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", id)
    .eq("is_default", false)

  if (error) throw error
  mutate("categories")
}

export async function updateAccount(id: string, updates: Partial<Account>) {
  const { data, error } = await supabase
    .from("accounts")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (!error) {
    mutate("accounts")
    return data
  }

  if (error.code === "PGRST204") {
    const fallback = { ...updates }
    delete fallback.icon_url
    delete fallback.icon_type
    delete fallback.icon_value
    delete fallback.primary_color
    delete fallback.secondary_color
    delete fallback.background_style

    const { data: fallbackData, error: fallbackError } = await supabase
      .from("accounts")
      .update(fallback)
      .eq("id", id)
      .select()
      .single()

    if (fallbackError) throw fallbackError
    mutate("accounts")
    return fallbackData
  }

  throw error
}

export async function reorderAccounts(accountIdsInOrder: string[]) {
  if (accountIdsInOrder.length === 0) return

  await Promise.all(
    accountIdsInOrder.map((accountId, index) =>
      supabase.from("accounts").update({ sort_order: index }).eq("id", accountId)
    )
  )

  mutate("accounts")
}

export async function setFavoriteAccount(accountId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  await supabase.from("accounts").update({ is_favorite: false }).eq("user_id", user.id)
  await supabase.from("accounts").update({ is_favorite: true }).eq("id", accountId)
  mutate("accounts")
}

export async function deleteAccount(id: string) {
  // Check if account has transactions
  const { data: txs, error: txsError } = await supabase
    .from("transactions")
    .select("id")
    .eq("account_id", id)
    .limit(1)

  if (txsError) throw txsError
  if (txs && txs.length > 0) {
    throw new Error("No se puede eliminar una cuenta con transacciones asociadas")
  }

  const { error } = await supabase
    .from("accounts")
    .delete()
    .eq("id", id)

  if (error) throw error
}
