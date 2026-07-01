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
  FinancialSubscription,
} from "@/lib/types/database"
import { formatCurrency, getLocalDateString } from "@/lib/data"
import { offlineDB, OutboxItem } from "@/lib/offline/db"
import { buildOutboxItem, tryEnqueueOffline, enqueueOfflineFallback, isOfflineError } from "@/lib/offline/outbox"
import { getCycleForDate } from "@/lib/credit-cycle"
import { getNextFinancialBillingDateFrom } from "@/lib/financial-subscriptions"
import { blockedEntitlement, DEFAULT_PLAN, ENTITLEMENTS_BY_PLAN } from "@/lib/entitlements/entitlements"
import { isTestFullAccessEmail } from "@/lib/entitlements/test-user"
import { normalizePlanTier } from "@/lib/billing/plans"
import type { PlanTier } from "@/types/billing"
import { LedgerService } from "@/lib/ledger/ledger-service"
import { getAuthenticatedUser } from "@/lib/supabase/user"

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
const SUBSCRIPTION_CATEGORY_NAME = "Suscripciones"
const COMMISSION_ERROR_MESSAGE = "El monto más comisión excede tu balance disponible."

function generatePaymentGroupId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `paygrp-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function getTxMetadataValue(metadata: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = metadata?.[key]
  return typeof value === "string" && value.length > 0 ? value : null
}

function getPaymentLinkId(metadata: Record<string, unknown> | null | undefined): string | null {
  return getTxMetadataValue(metadata, "payment_group_id") || getTxMetadataValue(metadata, "payment_id")
}

function isCreditCardPaymentTx(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata) return false
  return metadata.kind === "credit_payment" || metadata.operation_type === "credit_card_payment"
}

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

function normalizeTransactionDateInput(dateValue?: string | null): string {
  const trimmedDate = typeof dateValue === "string" ? dateValue.trim() : ""

  if (trimmedDate && /^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
    return trimmedDate
  }

  if (trimmedDate) {
    const parsed = new Date(trimmedDate)
    if (!Number.isNaN(parsed.getTime())) {
      return getLocalDateString(parsed)
    }
  }

  return getLocalDateString()
}

function getDateDiffInDays(from: Date, to: Date) {
  const fromDay = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const toDay = new Date(to.getFullYear(), to.getMonth(), to.getDate())
  return Math.ceil((toDay.getTime() - fromDay.getTime()) / (1000 * 60 * 60 * 24))
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

async function getOrCreateSubscriptionCategoryId(userId: string): Promise<string | null> {
  const { data: existing } = await supabase
    .from("categories")
    .select("id")
    .eq("is_subscription", true)
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
      name: SUBSCRIPTION_CATEGORY_NAME,
      icon: "repeat",
      color: "#f59e0b",
      type: "expense",
      is_default: false,
      is_subscription: true,
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

async function createNotification(params: {
  userId: string
  title: string
  message: string
  type: "transaction" | "goal" | "credit" | "system" | "transfer" | "subscription"
  actionUrl?: string | null
  metadata?: Record<string, unknown> | null
}) {
  const schema = await ensureCreditSchemas()
  const payload: Record<string, unknown> = {
    user_id: params.userId,
    title: params.title,
    message: params.message,
    type: params.type,
    read: false,
    action_url: params.actionUrl || null,
  }
  if (schema.hasNotificationMetadataSchema) {
    payload.metadata = params.metadata || null
  }
  await supabase.from("notifications").insert(payload)
}

async function fetchFinancialSubscriptions(): Promise<FinancialSubscription[]> {
  const user = await getAuthenticatedUser()
  if (!user) return []

  const { data, error } = await supabase
    .from("subscriptions")
    .select("*, account:accounts(*), category:categories(*)")
    .eq("user_id", user.id)
    .order("next_payment_date", { ascending: true })

  if (error) {
    const cached = await offlineDB.getAll<FinancialSubscription>("subscriptions_cache")
    if (cached.length > 0) return cached
    throw error
  }
  const subs = (data as FinancialSubscription[]) || []
  for (const s of subs) {
    await offlineDB.put("subscriptions_cache", s)
  }
  return subs
}

async function getUserPlanAndLimits(userId: string, email?: string | null) {
  if (isTestFullAccessEmail(email)) {
    return { plan: "pro" as const, limits: ENTITLEMENTS_BY_PLAN.pro }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_tier, email")
    .eq("id", userId)
    .maybeSingle()

  if (isTestFullAccessEmail((profile as any)?.email)) {
    return { plan: "pro" as const, limits: ENTITLEMENTS_BY_PLAN.pro }
  }

  const plan = normalizePlanTier((profile as any)?.plan_tier as string | null) || DEFAULT_PLAN
  const limits = ENTITLEMENTS_BY_PLAN[plan] || ENTITLEMENTS_BY_PLAN[DEFAULT_PLAN]
  return { plan, limits }
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
    .select("id, amount, type, currency, date, billing_cycle_id, metadata")
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
    const txMetadata = (tx.metadata || {}) as Record<string, unknown>
    if (txMetadata.kind === "credit_payment" || txMetadata.operation_type === "credit_card_payment") {
      continue
    }
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

  const cutoffDate = toDateOnly(currentCycle.cycleEndDate)
  const cutoffDaysLeft = getDateDiffInDays(now, cutoffDate)
  if (cutoffDaysLeft === 3) {
    await upsertCreditNotification({
      userId: account.user_id,
      title: `Corte próximo: ${account.name}`,
      message: `Tu tarjeta ${account.name} corta en 3 días. Revisa tus consumos antes del corte.`,
      metadata: {
        kind: "credit_cutoff_warning",
        account_id: account.id,
        cutoff_date: currentCycle.cycleEndDate,
        days_left: 3,
      },
    })
  }

  const statementDueDate = latestClosedCycle?.due_date || currentCycle.dueDate
  const dueDateForReminder = toDateOnly(statementDueDate)
  const paymentDaysLeft = getDateDiffInDays(now, dueDateForReminder)

  const lines = [
    { currency: "DOP" as const, pending: statementPendingDop },
    { currency: "USD" as const, pending: statementPendingUsd },
  ]

  if (paymentDaysLeft === 5) {
    for (const line of lines) {
      if (line.pending <= 0) continue

      await upsertCreditNotification({
        userId: account.user_id,
        title: `Pago próximo: ${account.name}`,
        message: `Tu pago de tarjeta ${account.name} vence en 5 días. Balance pendiente: ${formatCurrency(line.pending, line.currency)}.`,
        metadata: {
          kind: "credit_payment_warning",
          account_id: account.id,
          currency: line.currency,
          due_date: statementDueDate,
          cycle_end_date: latestClosedCycle?.cycle_end_date || currentCycle.cycleEndDate,
          pending_amount: line.pending,
          days_left: 5,
        },
      })
    }
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

export async function applyAccountImpact(params: {
  accountId: string
  type: "income" | "expense"
  amount: number
  direction: 1 | -1
  currency?: "DOP" | "USD"
}) {
  const { accountId, type, amount, direction, currency = "DOP" } = params
  const { data: account } = await supabase
    .from("accounts")
    .select("id, type, balance, currency, current_debt, current_debt_dop, current_debt_usd")
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

  // Estrategia A: non-credit accounts have a single currency; tx currency must match.
  const accountCurrency = (account.currency || "DOP") as "DOP" | "USD"
  if (currency !== accountCurrency) {
    throw new Error("La moneda de la transacción no coincide con la de la cuenta.")
  }

  // For non-credit accounts: balance is managed by syncAccountBalance (which uses ledger).
  // The ledger entry is recorded separately in createTransaction / updateTransaction / etc.
  // No direct balance update here — syncAccountBalance will recalculate from ledger after tx.
}

export async function syncAccountBalance(accountId: string, currency?: string) {
  const { data: account } = await supabase
    .from("accounts")
    .select("id, type, currency")
    .eq("id", accountId)
    .single()
  if (!account) return

  const { data: ledgerBalance } = await supabase.rpc("ledger_calc_balance", { p_account_id: accountId })
  if (ledgerBalance === null || ledgerBalance === undefined) return

  const ledgerSum = Number(ledgerBalance)
  if (account.type === "credit") {
    const cur = (currency || account.currency || "DOP") as "DOP" | "USD"
    const debtField = cur === "USD" ? "current_debt_usd" : "current_debt_dop"
    await supabase.from("accounts").update({
      [debtField]: Math.max(0, ledgerSum),
      current_debt: Math.max(0, ledgerSum),
    }).eq("id", accountId)
  } else {
    // Non-credit: ledger_calc_balance returns the cumulative balance
    // (initial balance + all income - all expenses). Use it directly.
    await supabase.from("accounts").update({
      balance: Math.max(0, ledgerSum),
    }).eq("id", accountId)
  }
}

// Generic fetcher for Supabase
async function fetchAccounts(): Promise<Account[]> {
  const user = await getAuthenticatedUser()
  const userId = user?.id

  let accounts: Account[] = []

  try {
    if (!userId) return []
    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: true })

    if (error) throw error
    accounts = sortAccountsList(data || [])
    
    // Save to offline cache
    if (userId) {
      for (const account of accounts) {
        await offlineDB.put("accounts_cache", account)
      }
    }
    
    void maybeRefreshCreditCycles()
  } catch (err) {
    console.warn("fetchAccounts failed, trying offline cache:", err)
    const cached = await offlineDB.getAll<Account>("accounts_cache")
    if (userId) {
      accounts = cached.filter(a => a.user_id === userId)
    } else {
      accounts = cached
    }
  }

  // Adjust balances dynamically based on pending outbox transactions for local preview
  const outbox = await offlineDB.getAll<OutboxItem>("offline_outbox")
  const pendingTxs = outbox.filter(item => item.operation === "create_transaction" && item.status === "pending" && (!item.user_id || item.user_id === userId))

  if (pendingTxs.length > 0) {
    accounts = accounts.map(account => {
      let balance = Number(account.balance || 0)
      let currentDebtDop = Number(account.current_debt_dop || account.current_debt || 0)
      let currentDebtUsd = Number(account.current_debt_usd || 0)
      let availableCreditDop = Number(account.available_credit_dop || 0)
      let availableCreditUsd = Number(account.available_credit_usd || 0)
      let hasPending = false

      for (const tx of pendingTxs) {
        const payload = tx.payload
        if (payload.account_id !== account.id) continue

        hasPending = true
        const isExpense = payload.type === "expense"
        const amount = Number(payload.amount || 0)
        const isCommission = payload.applyCommission
        const commission = isCommission ? Math.round(amount * 0.15) / 100 : 0
        const totalAmount = amount + commission

        if (account.type === "credit") {
          const signed = isExpense ? totalAmount : -totalAmount
          if (payload.currency === "USD") {
            currentDebtUsd = Math.max(0, currentDebtUsd + signed)
            availableCreditUsd = Math.max(0, Number(account.credit_limit_usd || 0) - currentDebtUsd)
          } else {
            currentDebtDop = Math.max(0, currentDebtDop + signed)
            availableCreditDop = Math.max(0, Number(account.credit_limit_dop || account.credit_limit || 0) - currentDebtDop)
          }
        } else {
          const signed = isExpense ? -totalAmount : totalAmount
          balance += signed
        }
      }

      if (hasPending) {
        return {
          ...account,
          balance,
          current_debt_dop: currentDebtDop,
          current_debt: currentDebtDop,
          current_debt_usd: currentDebtUsd,
          available_credit_dop: availableCreditDop,
          available_credit_usd: availableCreditUsd,
          hasPendingChanges: true,
        } as any
      }

      return account
    })
  }

  return accounts
}

async function fetchTransactions(limit = 10): Promise<Transaction[]> {
  const user = await getAuthenticatedUser()
  const userId = user?.id

  let serverTxs: Transaction[] = []

  try {
    if (!userId) return []
    const { data, error } = await supabase
      .from("transactions")
      .select("*, category:categories(*), account:accounts(*)")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) throw error
    serverTxs = (data as Transaction[]).map((tx) => ({
      ...tx,
      date: normalizeTransactionDateInput(tx.date),
    }))

    // Save to offline cache
    if (userId) {
      for (const tx of serverTxs) {
        await offlineDB.put("transactions_cache", tx)
      }
    }
  } catch (err) {
    console.warn("fetchTransactions failed, trying offline cache:", err)
    const cached = await offlineDB.getAll<Transaction>("transactions_cache")
    if (userId) {
      serverTxs = cached.filter(t => t.user_id === userId)
    } else {
      serverTxs = cached
    }
  }

  // Always merge pending outbox transactions
  const outbox = await offlineDB.getAll<OutboxItem>("offline_outbox")
  const pendingTxs = outbox
    .filter(item => item.operation === "create_transaction" && (!item.user_id || item.user_id === userId))
    .map(item => {
      const payload = item.payload
      return {
        id: item.id,
        user_id: userId || "",
        account_id: payload.account_id,
        category_id: payload.category_id,
        type: payload.type,
        amount: payload.amount,
        currency: payload.currency,
        amount_base: payload.amount_base,
        exchange_rate: payload.exchange_rate,
        description: payload.description,
        date: payload.date,
        notes: payload.notes,
        is_recurring: payload.is_recurring,
        parent_transaction_id: payload.parent_transaction_id,
        created_at: item.created_at,
        metadata: {
          ...(payload.metadata || {}),
          kind: "offline_pending",
          sync_status: item.status,
          idempotency_key: item.idempotency_key,
          last_error: item.last_error,
        }
      } as unknown as Transaction
    })

  // Exclude server transactions that match synced outbox transactions to avoid duplicates
  const serverTxsFiltered = serverTxs.filter(stx => {
    const isOfflineDup = pendingTxs.some(ptx => ptx.id === stx.id || (stx.metadata?.idempotency_key && stx.metadata?.idempotency_key === ptx.metadata?.idempotency_key))
    return !isOfflineDup
  })

  const combined = [...pendingTxs, ...serverTxsFiltered]
  
  return combined.sort((a, b) => {
    const dateA = new Date(a.date).getTime()
    const dateB = new Date(b.date).getTime()
    if (dateA !== dateB) return dateB - dateA
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  })
}

async function fetchCategories(): Promise<Category[]> {
  const user = await getAuthenticatedUser()
  if (!user) return []

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .or(`user_id.eq.${user.id},is_default.eq.true`)
    .order("is_default", { ascending: false })
    .order("name", { ascending: true })

  if (error) {
    const cached = await offlineDB.getAll<Category>("categories_cache")
    if (cached.length > 0) return cached
    throw error
  }
  const cats = (data as Category[]) || []
  for (const cat of cats) {
    await offlineDB.put("categories_cache", cat)
  }
  return cats
}

async function fetchGoals(): Promise<Goal[]> {
  const user = await getAuthenticatedUser()
  if (!user) return []

  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    const cached = await offlineDB.getAll<Goal>("goals_cache")
    if (cached.length > 0) return cached
    throw error
  }
  const goals = (data as Goal[]) || []
  for (const g of goals) {
    await offlineDB.put("goals_cache", g)
  }
  return goals
}

async function fetchNotifications(): Promise<Notification[]> {
  const user = await getAuthenticatedUser()
  if (!user) return []

  // Sync credit cycles in background (non-blocking)
  void maybeRefreshCreditCycles()

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20)

  if (error) {
    const cached = await offlineDB.getAll<Notification>("notifications_cache")
    if (cached.length > 0) return cached
    throw error
  }
  const notifs = (data as Notification[]) || []
  for (const n of notifs) {
    await offlineDB.put("notifications_cache", n)
  }
  return notifs
}

async function fetchProfile(): Promise<Profile | null> {
  const user = await getAuthenticatedUser()
  if (!user) return null

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  if (error && error.code !== "PGRST116") {
    const cached = await offlineDB.getAll<Profile & { id: string }>("profile_cache")
    const cachedProfile = cached.find(p => p.id === user.id)
    if (cachedProfile) return cachedProfile
    throw error
  }
  if (data) {
    await offlineDB.put("profile_cache", data)
  }
  return data
}

async function fetchBeneficiaries(): Promise<Beneficiary[]> {
  const user = await getAuthenticatedUser()
  if (!user) return []

  const { data, error } = await supabase
    .from("beneficiaries")
    .select("*")
    .eq("user_id", user.id)
    .order("is_favorite", { ascending: false })
    .order("name", { ascending: true })

  if (error) {
    const cached = await offlineDB.getAll<Beneficiary>("beneficiaries_cache")
    if (cached.length > 0) return cached
    throw error
  }
  const beneficiaries = (data as Beneficiary[]) || []
  for (const b of beneficiaries) {
    await offlineDB.put("beneficiaries_cache", b)
  }
  return beneficiaries
}

// SWR Hooks
export function useAccounts() {
  return useSWR<Account[]>("accounts", fetchAccounts, {
    revalidateOnFocus: false,
    revalidateOnMount: true,
    dedupingInterval: 2000,
    errorRetryCount: 2,
    onError: (err) => {
      console.error("useAccounts error:", err)
    },
  })
}

export function useTransactions(limit = 10) {
  return useSWR<Transaction[]>(
    ["transactions", limit],
    () => fetchTransactions(limit),
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      errorRetryCount: 2,
      onError: (err) => {
        console.error("useTransactions error:", err)
      },
    }
  )
}

export function useCategories() {
  return useSWR<Category[]>("categories", fetchCategories, {
    revalidateOnFocus: false,
    dedupingInterval: 60000, // Categories don't change often
    errorRetryCount: 2,
    onError: (err) => {
      console.error("useCategories error:", err)
    },
  })
}

export function useGoals() {
  return useSWR<Goal[]>("goals", fetchGoals, {
    revalidateOnFocus: false,
    dedupingInterval: 5000,
    errorRetryCount: 2,
    onError: (err) => {
      console.error("useGoals error:", err)
    },
  })
}

export function useNotifications() {
  return useSWR<Notification[]>("notifications", fetchNotifications, {
    revalidateOnFocus: false,
    refreshInterval: 120000,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    dedupingInterval: 30000,
    errorRetryCount: 2,
    onError: (err) => {
      console.error("useNotifications error:", err)
    },
  })
}

export function useProfile() {
  return useSWR<Profile | null>("profile", fetchProfile, {
    revalidateOnFocus: false,
    errorRetryCount: 2,
    onError: (err) => {
      console.error("useProfile error:", err)
    },
  })
}

export function useFinancialSubscriptions() {
  return useSWR<FinancialSubscription[]>("financial_subscriptions", fetchFinancialSubscriptions, {
    revalidateOnFocus: true,
    dedupingInterval: 10000,
    errorRetryCount: 2,
    onError: (err) => {
      console.error("useFinancialSubscriptions error:", err)
    },
  })
}

// Backward compatibility alias: `subscriptions` in current app means financial recurring expenses.
export function useSubscriptions() {
  return useFinancialSubscriptions()
}

export function useBeneficiaries() {
  return useSWR<Beneficiary[]>("beneficiaries", fetchBeneficiaries, {
    revalidateOnFocus: false,
    dedupingInterval: 5000,
    errorRetryCount: 2,
    onError: (err) => {
      console.error("useBeneficiaries error:", err)
    },
  })
}

export type NotificationPreferenceKey = "transactions" | "budgets" | "creditAlerts" | "marketing"

export type NotificationPreferences = Record<NotificationPreferenceKey, boolean>

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  transactions: true,
  budgets: true,
  creditAlerts: true,
  marketing: false,
}

async function fetchNotificationPreferences(): Promise<NotificationPreferences> {
  const response = await fetch("/api/profile/notification-preferences", {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  })
  if (!response.ok) {
    throw new Error("No se pudieron leer las preferencias de notificaciones")
  }
  const data = (await response.json().catch(() => null)) as Partial<NotificationPreferences> | null
  return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...(data || {}) }
}

async function persistNotificationPreferences(
  next: NotificationPreferences
): Promise<NotificationPreferences> {
  const response = await fetch("/api/profile/notification-preferences", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(next),
  })
  if (!response.ok) {
    throw new Error("No se pudieron guardar las preferencias de notificaciones")
  }
  const data = (await response.json().catch(() => null)) as Partial<NotificationPreferences> | null
  return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...(data || {}) }
}

export function useNotificationPreferences() {
  const swr = useSWR<NotificationPreferences>(
    "notification_preferences",
    fetchNotificationPreferences,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
      errorRetryCount: 2,
      onError: (err) => {
        console.error("useNotificationPreferences error:", err)
      },
    }
  )

  async function setPreference(key: NotificationPreferenceKey, value: boolean) {
    const current = swr.data || DEFAULT_NOTIFICATION_PREFERENCES
    const optimistic: NotificationPreferences = { ...current, [key]: value }
    mutate("notification_preferences", optimistic, { revalidate: false })
    try {
      const saved = await persistNotificationPreferences(optimistic)
      mutate("notification_preferences", saved, { revalidate: false })
    } catch (error) {
      mutate("notification_preferences", current, { revalidate: false })
      throw error
    }
  }

  return { ...swr, setPreference }
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
  const user = await getAuthenticatedUser()
  if (!user) throw new Error("No autenticado")

  const outboxItem = buildOutboxItem({
    userId: user.id, operation: "create_account", entity: "accounts",
    payload: { ...account },
  })
  if (await tryEnqueueOffline(outboxItem, ["accounts"])) {
    return { id: outboxItem.id, user_id: user.id, ...account, created_at: outboxItem.created_at } as Account
  }

  const { limits } = await getUserPlanAndLimits(user.id, user.email)
  if (limits.max_accounts !== "unlimited") {
    const { count } = await supabase
      .from("accounts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)

    const currentUsage = count || 0
    if (currentUsage >= limits.max_accounts) {
      throw blockedEntitlement({
        feature: "max_accounts",
        reason: "Llegaste al límite de cuentas del plan Free.",
        currentUsage,
        limit: limits.max_accounts,
      })
    }
  }

  const extractMissingAccountColumn = (message: string) => {
    const match = message.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+of\s+relation\s+"accounts"\s+does\s+not\s+exist/i)
    return match?.[1] || null
  }

  let payload: Record<string, unknown> = { ...account, user_id: user.id }
  let data: Account | null = null
  let finalError: any = null

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await supabase
      .from("accounts")
      .insert(payload)
      .select()
      .single()

    if (!response.error) {
      data = response.data as Account
      finalError = null
      break
    }

    const missingColumn = extractMissingAccountColumn(response.error.message || "")
    if (!missingColumn || !(missingColumn in payload)) {
      finalError = response.error
      break
    }

    delete payload[missingColumn]
    finalError = response.error
  }

  if (finalError || !data) throw finalError || new Error("No se pudo crear la cuenta")

  // Record initial balance in ledger for non-credit accounts (fixes syncAccountBalance)
  if (data.type !== "credit" && Number(account.balance || 0) > 0) {
    try {
      const ledger = LedgerService.create()
      await ledger.recordIncome(
        user.id,
        data.id,
        Number(account.balance),
        (account.currency || "DOP") as "DOP" | "USD",
        "Saldo inicial",
        data.id,
        "accounts"
      )
    } catch (e) {
      console.error("Failed to record initial balance in ledger (non-blocking):", e)
    }
  }

  await mutate("accounts", undefined, { revalidate: true })

  await createNotification({
    userId: user.id,
    type: "system",
    title: "Cuenta creada correctamente",
    message: `Se creo la cuenta ${account.name}.`,
    actionUrl: "/accounts",
  })
  await mutate("notifications")
  return data
}

export async function createTransaction(
  transaction: Omit<Transaction, "id" | "user_id" | "created_at" | "category" | "account">,
  options?: { applyCommission?: boolean; skipOutbox?: boolean; idempotencyKey?: string }
) {
  const user = await getAuthenticatedUser()
  if (!user) throw new Error("No autenticado")

  const idempotencyKey = options?.idempotencyKey || `idem_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
  const localId = `local_tx_${Math.random().toString(36).substring(2, 15)}`
  const { limits } = await getUserPlanAndLimits(user.id, user.email)
  if (limits.max_daily_transactions !== "unlimited") {
    const today = getLocalDateString()
    const { count } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("date", today)
    const dailyUsage = Number(count || 0)
    if (dailyUsage >= limits.max_daily_transactions) {
      throw blockedEntitlement({
        feature: "max_daily_transactions",
        reason: "Llegaste al límite diario de 10 transacciones del plan Free.",
        currentUsage: dailyUsage,
        limit: limits.max_daily_transactions,
      })
    }
  }

  const outboxItem = {
    id: localId,
    user_id: user.id,
    operation: "create_transaction" as const,
    entity: "transactions" as const,
    payload: {
      ...transaction,
      applyCommission: options?.applyCommission,
    },
    status: "pending" as const,
    retry_count: 0,
    created_at: new Date().toISOString(),
    last_attempt_at: null,
    last_error: null,
    idempotency_key: idempotencyKey,
  }

  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true

  if (!options?.skipOutbox && !isOnline) {
    console.log("Device is offline. Enqueuing transaction to offline outbox.")
    await offlineDB.put("offline_outbox", outboxItem)
    mutate("accounts")
    mutate((key: any) => Array.isArray(key) && key[0] === "transactions")

    return {
      id: localId,
      user_id: user.id,
      account_id: transaction.account_id,
      category_id: transaction.category_id,
      type: transaction.type,
      amount: transaction.amount,
      currency: transaction.currency,
      amount_base: transaction.amount_base || transaction.amount,
      exchange_rate: transaction.exchange_rate || 1,
      description: transaction.description,
      date: normalizeTransactionDateInput(transaction.date),
      notes: transaction.notes,
      is_recurring: transaction.is_recurring,
      parent_transaction_id: transaction.parent_transaction_id,
      created_at: outboxItem.created_at,
      metadata: {
        ...(transaction.metadata || {}),
        kind: "offline_pending",
        sync_status: "pending",
        idempotency_key: idempotencyKey,
      }
    } as unknown as Transaction
  }

  try {
    const normalizedDate = normalizeTransactionDateInput(transaction.date)
    const transactionToInsert = {
      ...transaction,
      date: normalizedDate,
      metadata: {
        ...(transaction.metadata || {}),
        idempotency_key: idempotencyKey,
      }
    }

    const applyCommission = Boolean(options?.applyCommission && transaction.type === "expense")
    const commissionAmount = applyCommission ? getCommissionAmount(transaction.amount) : 0
    const totalAmount = roundCurrencyAmount(transaction.amount + commissionAmount)

    if (transaction.type === "expense") {
      await ensureSufficientFundsForExpense(transactionToInsert.account_id, totalAmount, transactionToInsert.currency)
    }

    let billingCycleId: string | null = null
    let isStatementTransaction = false

    const { data: accountForCycle } = await supabase
      .from("accounts")
      .select("id, user_id, type, currency, closing_day, due_days_after_cutoff")
      .eq("id", transactionToInsert.account_id)
      .single()

    // Estrategia A: non-credit accounts have a single currency; tx currency must match.
    if (accountForCycle && accountForCycle.type !== "credit") {
      const accountCurrency = (accountForCycle.currency || "DOP") as "DOP" | "USD"
      if (transactionToInsert.currency !== accountCurrency) {
        throw new Error("La moneda de la transacción no coincide con la de la cuenta.")
      }
    }

    if (accountForCycle?.type === "credit" && accountForCycle.closing_day) {
      const txDate = /^\d{4}-\d{2}-\d{2}$/.test(transactionToInsert.date)
        ? new Date(`${transactionToInsert.date}T12:00:00`)
        : new Date(transactionToInsert.date)
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
      .insert({ ...transactionToInsert, user_id: user.id, billing_cycle_id: billingCycleId, is_statement_transaction: isStatementTransaction })
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
          account_id: transactionToInsert.account_id,
          category_id: commissionCategoryId,
          type: "expense",
          amount: commissionAmount,
          currency: transactionToInsert.currency,
          amount_base: commissionAmount,
          exchange_rate: transactionToInsert.exchange_rate,
          description: `Comisión de 0.15% de ${transactionToInsert.description || "transacción"}`,
          date: transactionToInsert.date,
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
        accountId: transactionToInsert.account_id,
        type: transactionToInsert.type,
        amount: transactionToInsert.amount,
        direction: 1,
        currency: transactionToInsert.currency,
      })

      if (commissionTxId && commissionAmount > 0) {
        await applyAccountImpact({
          accountId: transactionToInsert.account_id,
          type: "expense",
          amount: commissionAmount,
          direction: 1,
          currency: transactionToInsert.currency,
        })
      }
    } catch (impactError) {
      if (commissionTxId) {
    await supabase.from("transactions").delete().eq("id", commissionTxId)
  }
  await supabase.from("transactions").delete().eq("id", data.id)
  throw impactError
}

try {
      const ledger = LedgerService.create()
      if (transactionToInsert.type === "expense") {
        await ledger.recordExpense(user.id, transactionToInsert.account_id, transactionToInsert.amount, transactionToInsert.currency as any, transactionToInsert.description || undefined, data.id, "transactions")
      } else if (transactionToInsert.type === "income") {
        await ledger.recordIncome(user.id, transactionToInsert.account_id, transactionToInsert.amount, transactionToInsert.currency as any, transactionToInsert.description || undefined, data.id, "transactions")
      }
      if (commissionTxId && commissionAmount > 0) {
        await ledger.recordCommission(user.id, transactionToInsert.account_id, commissionAmount, transactionToInsert.currency as any, "Comisión por transacción")
      }
    } catch (e) {
      console.error("Ledger write failed (non-blocking):", e)
    }

    await syncAccountBalance(transactionToInsert.account_id, transactionToInsert.currency)

    await mutate((key: any) => Array.isArray(key) && key[0] === "transactions")
    await mutate("accounts")

    const notificationMetadata = transactionToInsert.metadata as Record<string, unknown> | null
    const isCreditCardIncome = notificationMetadata?.kind === "credit_card_income"
    const creditCardIncomeTitle =
      notificationMetadata?.movement_kind === "card_refund"
        ? "Reembolso en tarjeta"
        : notificationMetadata?.movement_kind === "card_adjustment"
          ? "Ajuste positivo de tarjeta"
          : notificationMetadata?.movement_kind === "card_cashback"
            ? "Cashback en tarjeta"
            : "Abono a tarjeta"

    await createNotification({
      userId: user.id,
      type: "transaction",
      title: isCreditCardIncome ? creditCardIncomeTitle : transactionToInsert.type === "income" ? "Ingreso registrado" : "Gasto registrado",
      message: `${transactionToInsert.description || "Movimiento"}: ${transactionToInsert.currency} ${roundCurrencyAmount(transactionToInsert.amount).toFixed(2)}`,
      actionUrl: "/history",
    })
    await mutate("notifications")

    return data
  } catch (err: any) {
    const isNetworkError = err.message?.includes("Failed to fetch") || err.name === "TypeError" || !navigator.onLine
    if (!options?.skipOutbox && isNetworkError) {
      console.warn("Network query failed, enqueuing offline:", err)
      await offlineDB.put("offline_outbox", outboxItem)
      mutate("accounts")
      mutate((key: any) => Array.isArray(key) && key[0] === "transactions")

      return {
        id: localId,
        user_id: user.id,
        account_id: transaction.account_id,
        category_id: transaction.category_id,
        type: transaction.type,
        amount: transaction.amount,
        currency: transaction.currency,
        amount_base: transaction.amount_base || transaction.amount,
        exchange_rate: transaction.exchange_rate || 1,
        description: transaction.description,
        date: normalizeTransactionDateInput(transaction.date),
        notes: transaction.notes,
        is_recurring: transaction.is_recurring,
        parent_transaction_id: transaction.parent_transaction_id,
        created_at: outboxItem.created_at,
        metadata: {
          ...(transaction.metadata || {}),
          kind: "offline_pending",
          sync_status: "pending",
          idempotency_key: idempotencyKey,
        }
      } as unknown as Transaction
    }
    throw err
  }
}

export async function updateTransaction(
  id: string,
  updates: Pick<Transaction, "account_id" | "type" | "amount" | "description" | "date" | "category_id" | "notes" | "currency" | "amount_base" | "exchange_rate" | "is_recurring">
) {
  const user = await getAuthenticatedUser()
  if (!user) throw new Error("No autenticado")

  const outboxItem = buildOutboxItem({
    userId: user.id, operation: "update_transaction", entity: "transactions",
    payload: { id, ...updates },
  })
  if (await tryEnqueueOffline(outboxItem, ["transactions"])) return { id, ...updates } as Transaction

  const { data: existing, error: existingError } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", id)
    .single()

  if (existingError || !existing) throw existingError || new Error("Transacción no encontrada")

  if (isCreditCardPaymentTx(existing.metadata)) {
    const paymentGroupId = getPaymentLinkId(existing.metadata)
    const creditCardId = getTxMetadataValue(existing.metadata, "credit_card_id") || (existing.type === "income" ? existing.account_id : null)
    if (!paymentGroupId || !creditCardId) {
      throw new Error("No se pudo editar este pago de tarjeta. Falta enlace de pago.")
    }

    await deleteCreditCardPaymentGroup({ userId: user.id, paymentLinkId: paymentGroupId, notifyDeletion: false })

    const recreated = await payCreditCard({
      credit_account_id: creditCardId,
      source_account_id: updates.account_id,
      amount: Number(updates.amount),
      currency: (existing.metadata?.payment_currency as "DOP" | "USD") || existing.currency,
      exchange_rate: Number(existing.exchange_rate || updates.exchange_rate || 1),
      payment_kind: (existing.metadata?.payment_kind as "balance_to_date" | "statement_balance" | "minimum_payment" | "custom") || "custom",
      notes: updates.notes || existing.notes || undefined,
      apply_commission: false,
    })

    return recreated?.sourceTransaction || recreated?.cardTransaction
  }

  const { data: result, error: rpcError } = await supabase.rpc("update_transaction_safe", {
    p_transaction_id: id,
    p_account_id: updates.account_id,
    p_type: updates.type,
    p_amount: Number(updates.amount),
    p_currency: updates.currency,
    p_description: updates.description || null,
    p_date: normalizeTransactionDateInput(updates.date) || null,
    p_category_id: updates.category_id || null,
    p_notes: updates.notes || null,
    p_amount_base: updates.amount_base || null,
    p_exchange_rate: updates.exchange_rate || null,
    p_is_recurring: updates.is_recurring ?? null,
  })

  if (rpcError) {
    if (isOfflineError(rpcError)) {
      await enqueueOfflineFallback(outboxItem, ["transactions", "accounts"])
      return { id, ...updates } as Transaction
    }
    throw rpcError
  }

  await mutate((key: any) => Array.isArray(key) && key[0] === "transactions")
  await mutate("accounts")
  return result
}

export async function deleteTransaction(id: string) {
  const user = await getAuthenticatedUser()
  if (!user) throw new Error("No autenticado")

  const outboxItem = buildOutboxItem({
    userId: user.id, operation: "delete_transaction", entity: "transactions",
    payload: { id },
  })
  if (await tryEnqueueOffline(outboxItem, ["transactions", "accounts"])) return

  const { data: existing, error: existingError } = await supabase
    .from("transactions")
    .select("metadata")
    .eq("id", id)
    .single()

  if (existingError || !existing) throw existingError || new Error("Transacción no encontrada")

  const existingMeta = (existing.metadata || {}) as Record<string, unknown>

  const { data: result, error: rpcError } = await supabase.rpc("delete_transaction_safe", {
    p_transaction_id: id,
  })

  if (rpcError) {
    if (isOfflineError(rpcError)) {
      await enqueueOfflineFallback(outboxItem, ["transactions", "accounts"])
      return
    }
    throw rpcError
  }

  await mutate((key: any) => Array.isArray(key) && key[0] === "transactions")
  await mutate("accounts")

  if (existingMeta.kind === "transfer") {
    await mutate(["transfers", 100])
  }
  if (existingMeta.kind === "debt_payment") {
    await mutate("planning_debts")
    await mutate("planning_debt_payments_month")
  }
  if (existingMeta.kind === "credit_payment") {
    await mutate("notifications")
  }

  return result
}

async function deleteCreditCardPaymentGroup(params: {
  userId: string
  paymentLinkId: string
  notifyDeletion: boolean
}) {
  const { userId, paymentLinkId, notifyDeletion } = params

  const { data: groupedByNew } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .eq("metadata->>payment_group_id", paymentLinkId)

  const groupedTxs = groupedByNew && groupedByNew.length > 0
    ? groupedByNew
    : (await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .eq("metadata->>payment_id", paymentLinkId)).data || []

  if (!groupedTxs || groupedTxs.length === 0) {
    throw new Error("No se encontró el pago de tarjeta vinculado.")
  }

  for (const tx of groupedTxs) {
    await applyAccountImpact({
      accountId: tx.account_id,
      type: tx.type,
      amount: Number(tx.amount),
      direction: -1,
      currency: tx.currency,
    })
  }

  const txIds = groupedTxs.map((tx) => tx.id)
  if (txIds.length > 0) {
    await supabase.from("transactions").delete().in("id", txIds)
  }

  await supabase.from("credit_payments").delete().eq("id", paymentLinkId)

  const { data: creditNotifications } = await supabase
    .from("notifications")
    .select("id,metadata,title")
    .eq("user_id", userId)
    .eq("type", "credit")

  const notificationsToDelete = (creditNotifications || [])
    .filter((item) => {
      const metadata = (item.metadata || {}) as Record<string, unknown>
      return metadata.payment_group_id === paymentLinkId || metadata.payment_id === paymentLinkId
    })
    .map((item) => item.id)

  if (notificationsToDelete.length > 0) {
    await supabase.from("notifications").delete().in("id", notificationsToDelete)
  }

  if (notifyDeletion) {
    await createNotification({
      userId,
      type: "credit",
      title: "Pago de tarjeta eliminado",
      message: "Se eliminó el pago y se restauraron los balances asociados.",
      actionUrl: "/history",
      metadata: { kind: "credit_payment_deleted", payment_group_id: paymentLinkId },
    })
  }

  await mutate("accounts")
  await mutate((key: any) => Array.isArray(key) && key[0] === "transactions")
  await mutate("notifications")
}

export async function updateProfile(updates: Partial<Profile> & { username?: string | null; phone?: string | null }) {
  const user = await getAuthenticatedUser()
  if (!user) throw new Error("No autenticado")

  const { data: existing } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle()

  const basePayload: Record<string, unknown> = {
    id: user.id,
    email: user.email || null,
    full_name: null,
    first_name: null,
    last_name: null,
    avatar_url: null,
    preferred_currency: "DOP",
    language: "es",
    theme: "system",
    notifications_enabled: true,
    onboarding_completed: false,
    updated_at: new Date().toISOString(),
  }

  const allowedProfileUpdates: Record<string, unknown> = {
    full_name: updates.full_name,
    first_name: updates.first_name,
    last_name: updates.last_name,
    avatar_url: updates.avatar_url,
    preferred_currency: updates.preferred_currency,
    language: updates.language,
    theme: updates.theme,
    notifications_enabled: updates.notifications_enabled,
    onboarding_completed: updates.onboarding_completed,
    username: (updates as any).username,
    phone: (updates as any).phone,
  }

  const payload = {
    ...basePayload,
    ...(existing || {}),
    ...Object.fromEntries(Object.entries(allowedProfileUpdates).filter(([, value]) => typeof value !== "undefined")),
    id: user.id,
    updated_at: new Date().toISOString(),
  }

  const extractMissingProfileColumn = (message: string) => {
    const match = message.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+of\s+relation\s+"profiles"\s+does\s+not\s+exist/i)
    return match?.[1] || null
  }

  let upsertPayload: Record<string, unknown> = { ...payload }
  let data: Profile | null = null
  let upsertError: Error | null = null

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await supabase
      .from("profiles")
      .upsert(upsertPayload, { onConflict: "id" })
      .select()
      .single()

    if (!response.error) {
      data = response.data as Profile
      upsertError = null
      break
    }

    const missingColumn = extractMissingProfileColumn(response.error.message || "")
    if (!missingColumn || !(missingColumn in upsertPayload)) {
      upsertError = response.error
      break
    }

    delete upsertPayload[missingColumn]
    upsertError = response.error
  }

  if (upsertError || !data) throw upsertError || new Error("No se pudo guardar el perfil")

  const metadataPatch: Record<string, unknown> = {}
  if (typeof updates.full_name !== "undefined") metadataPatch.full_name = updates.full_name
  if (typeof updates.first_name !== "undefined") metadataPatch.first_name = updates.first_name
  if (typeof updates.last_name !== "undefined") metadataPatch.last_name = updates.last_name
  if (typeof updates.avatar_url !== "undefined") metadataPatch.avatar_url = updates.avatar_url
  if (typeof updates.theme !== "undefined") metadataPatch.theme = updates.theme
  if (typeof updates.language !== "undefined") metadataPatch.language = updates.language

  if (Object.keys(metadataPatch).length > 0) {
    await supabase.auth.updateUser({ data: metadataPatch })
  }

  await createNotification({
    userId: user.id,
    type: "system",
    title: "Perfil actualizado",
    message: "Tus preferencias y datos de perfil fueron guardados.",
    actionUrl: "/profile",
  })
  await mutate("profile", data, false)
  mutate("notifications")
  mutate("profile")
  return data
}

async function updateSubscriptionProcessingMeta(subscriptionId: string, payload: {
  last_processed_at?: string | null
  retry_count?: number | null
  last_charged_date?: string | null
  next_payment_date?: string
}) {
  const { error } = await supabase
    .from("subscriptions")
    .update(payload)
    .eq("id", subscriptionId)

  if (!error) return

  const message = (error.message || "").toLowerCase()
  const missingColumn = message.includes("column") && message.includes("does not exist")
  if (missingColumn) {
    const fallbackPayload: Record<string, unknown> = {}
    if (typeof payload.last_charged_date !== "undefined") fallbackPayload.last_charged_date = payload.last_charged_date
    if (typeof payload.next_payment_date !== "undefined") fallbackPayload.next_payment_date = payload.next_payment_date
    if (Object.keys(fallbackPayload).length > 0) {
      await supabase.from("subscriptions").update(fallbackPayload).eq("id", subscriptionId)
    }
    return
  }

  throw error
}

export async function markNotificationAsRead(id: string) {
  const user = await getAuthenticatedUser()
  if (!user) throw new Error("No autenticado")

  const outboxItem = buildOutboxItem({
    userId: user.id, operation: "mark_notification_read", entity: "notifications",
    payload: { id },
  })
  if (await tryEnqueueOffline(outboxItem, ["notifications"])) return

  mutate("notifications", (prev?: Notification[]) =>
    (prev || []).map((n) => (n.id === id ? { ...n, read: true } : n)),
    false
  )

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) {
    if (isOfflineError(error)) {
      await enqueueOfflineFallback(outboxItem, ["notifications"])
      return
    }
    mutate("notifications")
    throw error
  }

  mutate("notifications")
}

export async function markAllNotificationsAsRead() {
  const user = await getAuthenticatedUser()
  if (!user) throw new Error("No autenticado")

  const outboxItem = buildOutboxItem({
    userId: user.id, operation: "mark_all_notifications_read", entity: "notifications",
    payload: {},
  })
  if (await tryEnqueueOffline(outboxItem, ["notifications"])) return

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
    if (isOfflineError(error)) {
      await enqueueOfflineFallback(outboxItem, ["notifications"])
      return
    }
    mutate("notifications")
    throw error
  }

  mutate("notifications")
}

// Goal mutations
export async function createGoal(goal: Omit<Goal, "id" | "user_id" | "created_at" | "updated_at" | "is_completed" | "current_amount">) {
  const user = await getAuthenticatedUser()
  if (!user) throw new Error("No autenticado")

  const outboxItem = buildOutboxItem({
    userId: user.id, operation: "create_goal", entity: "goals",
    payload: { ...goal },
  })
  if (await tryEnqueueOffline(outboxItem, ["goals"])) {
    return { id: outboxItem.id, user_id: user.id, ...goal, current_amount: 0, is_completed: false, created_at: outboxItem.created_at } as Goal
  }

  const { limits } = await getUserPlanAndLimits(user.id, user.email)
  if (limits.max_goals !== "unlimited") {
    const { count } = await supabase
      .from("goals")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)

    const currentUsage = count || 0
    if (currentUsage >= limits.max_goals) {
      throw blockedEntitlement({
        feature: "max_goals",
        reason: "Llegaste al límite de metas del plan Free.",
        currentUsage,
        limit: limits.max_goals,
      })
    }
  }

  try {
    const { data, error } = await supabase
      .from("goals")
      .insert({ ...goal, user_id: user.id, current_amount: 0, is_completed: false })
      .select()
      .single()

    if (error) throw error

    mutate("goals")
    await createNotification({
      userId: user.id,
      type: "goal",
      title: "Meta creada",
      message: `Tu meta ${goal.name} fue creada correctamente.`,
      actionUrl: "/goals",
    })
    mutate("notifications")
    return data
  } catch (err: any) {
    if (isOfflineError(err)) {
      await enqueueOfflineFallback(outboxItem, ["goals", "notifications"])
      return { id: outboxItem.id, user_id: user.id, ...goal, current_amount: 0, is_completed: false, created_at: outboxItem.created_at } as Goal
    }
    throw err
  }
}

export async function updateGoal(id: string, updates: Partial<Goal>) {
  const user = await getAuthenticatedUser()
  if (!user) throw new Error("No autenticado")

  const outboxItem = buildOutboxItem({
    userId: user.id, operation: "update_goal", entity: "goals",
    payload: { id, ...updates },
  })
  if (await tryEnqueueOffline(outboxItem, ["goals"])) {
    return { id, ...updates } as Goal
  }

  const { data, error } = await supabase
    .from("goals")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    if (isOfflineError(error)) {
      await enqueueOfflineFallback(outboxItem, ["goals"])
      return { id, ...updates } as Goal
    }
    throw error
  }
  mutate("goals")

  await createNotification({
    userId: user.id,
    type: "goal",
    title: "Meta actualizada",
    message: `Se guardaron los cambios de la meta ${data.name}.`,
    actionUrl: `/goals/${id}`,
  })
  mutate("notifications")
  return data
}

export async function deleteGoal(id: string) {
  const user = await getAuthenticatedUser()
  if (!user) throw new Error("No autenticado")

  const outboxItem = buildOutboxItem({
    userId: user.id, operation: "delete_goal", entity: "goals",
    payload: { id },
  })
  if (await tryEnqueueOffline(outboxItem, ["goals"])) return

  const { error } = await supabase
    .from("goals")
    .delete()
    .eq("id", id)

  if (error) {
    if (isOfflineError(error)) {
      await enqueueOfflineFallback(outboxItem, ["goals"])
      return
    }
    throw error
  }
}

export async function addGoalContribution(contribution: Omit<GoalContribution, "id" | "created_at" | "user_id">) {
  const user = await getAuthenticatedUser()
  if (!user) throw new Error("No autenticado")

  // Step A: Load source account to get its currency and validate funds.
  const { data: sourceAccount, error: sourceAccountError } = await supabase
    .from("accounts")
    .select("id, type, balance, currency, credit_limit, current_debt, credit_limit_dop, credit_limit_usd, current_debt_dop, current_debt_usd")
    .eq("id", contribution.account_id)
    .single()

  if (sourceAccountError || !sourceAccount) {
    throw new Error("Cuenta origen no encontrada")
  }

  const accountCurrency = (sourceAccount.currency || "DOP") as "DOP" | "USD"

  // Throws on insufficient funds (no state changes yet).
  await ensureSufficientFundsForExpense(contribution.account_id, Number(contribution.amount), accountCurrency)

  // Step B: Insert contribution row.
  const { data: newContribution, error: contribError } = await supabase
    .from("goal_contributions")
    .insert({ ...contribution, user_id: user.id })
    .select()
    .single()

  if (contribError) throw contribError

  // Step C: Update goal current_amount.
  const { data: goal } = await supabase
    .from("goals")
    .select("current_amount, target_amount")
    .eq("id", contribution.goal_id)
    .single()

  let previousGoalAmount: number | null = null
  let targetAmount = 0
  if (goal) {
    previousGoalAmount = Number(goal.current_amount)
    targetAmount = Number(goal.target_amount)
    const newAmount = previousGoalAmount + Number(contribution.amount)
    const isCompleted = newAmount >= targetAmount

    const { error: goalUpdateError } = await supabase
      .from("goals")
      .update({ current_amount: newAmount, is_completed: isCompleted })
      .eq("id", contribution.goal_id)

    if (goalUpdateError) {
      await supabase.from("goal_contributions").delete().eq("id", newContribution.id)
      throw goalUpdateError
    }
  }

  // Step D: Insert transaction with proper metadata + real account currency.
  const { data: newTx, error: txInsertError } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      account_id: contribution.account_id,
      category_id: null,
      type: "expense",
      amount: contribution.amount,
      currency: accountCurrency,
      amount_base: contribution.amount,
      exchange_rate: 1,
      description: "Aporte a meta de ahorro",
      date: contribution.date,
      notes: contribution.notes || null,
      is_recurring: false,
      metadata: {
        kind: "goal_contribution",
        goal_id: contribution.goal_id,
        contribution_id: newContribution.id,
      },
    })
    .select()
    .single()

  if (txInsertError) {
    if (goal && previousGoalAmount !== null) {
      await supabase
        .from("goals")
        .update({
          current_amount: previousGoalAmount,
          is_completed: previousGoalAmount >= targetAmount,
        })
        .eq("id", contribution.goal_id)
    }
    await supabase.from("goal_contributions").delete().eq("id", newContribution.id)
    throw txInsertError
  }

  // Step E: Debit the account via applyAccountImpact.
  try {
    await applyAccountImpact({
      accountId: contribution.account_id,
      type: "expense",
      amount: Number(contribution.amount),
      direction: 1,
      currency: accountCurrency,
    })
  } catch (impactError) {
    await supabase.from("transactions").delete().eq("id", newTx.id)
    if (goal && previousGoalAmount !== null) {
      await supabase
        .from("goals")
        .update({
          current_amount: previousGoalAmount,
          is_completed: previousGoalAmount >= targetAmount,
        })
        .eq("id", contribution.goal_id)
    }
    await supabase.from("goal_contributions").delete().eq("id", newContribution.id)
    throw impactError
  }

  try {
    const ledger = LedgerService.create()
    await ledger.recordGoalContribution(user.id, contribution.account_id, Number(contribution.amount), accountCurrency, contribution.goal_id)
  } catch (e) {
    console.error("Ledger write failed (non-blocking):", e)
  }

  await syncAccountBalance(contribution.account_id, accountCurrency)

  await mutate("goals")
  await mutate((key: any) => Array.isArray(key) && key[0] === "transactions")
  await mutate("accounts")

  await createNotification({
    userId: user.id,
    type: "goal",
    title: "Aporte agregado a la meta",
    message: `Registraste un aporte de ${formatCurrency(Number(contribution.amount || 0))}.`,
    actionUrl: `/goals/${contribution.goal_id}`,
  })
  await mutate("notifications")

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
  exchange_rate?: number
  local_date?: string
}) {
  const user = await getAuthenticatedUser()
  if (!user) throw new Error("No autenticado")

  if (transfer.amount <= 0) throw new Error("Monto inválido")

  const outboxItem = buildOutboxItem({
    userId: user.id, operation: "create_transfer", entity: "transactions",
    payload: transfer,
  })
  if (await tryEnqueueOffline(outboxItem, ["accounts"])) return { id: outboxItem.id }

  const sourceCurrency = (transfer.currency || "DOP") as "DOP" | "USD"

  // Call the atomic RPC — everything happens in one Postgres transaction.
  const { data: result, error: rpcError } = await supabase.rpc("create_transfer_safe", {
    p_from_account_id: transfer.from_account_id,
    p_to_account_id: transfer.to_account_id || null,
    p_to_beneficiary_id: transfer.to_beneficiary_id || null,
    p_amount: transfer.amount,
    p_currency: sourceCurrency,
    p_description: transfer.description || null,
    p_apply_commission: Boolean(transfer.apply_commission),
    p_exchange_rate: transfer.exchange_rate || null,
    p_local_date: transfer.local_date || null,
  })

  if (rpcError) {
    if (isOfflineError(rpcError)) {
      await enqueueOfflineFallback(outboxItem, ["accounts"])
      return { id: outboxItem.id }
    }
    console.error("Transfer RPC error (full):", JSON.stringify(rpcError, null, 2))
    console.error("Transfer RPC keys:", Object.keys(rpcError))
    console.error("Transfer RPC code:", (rpcError as any)?.code, "message:", (rpcError as any)?.message, "details:", (rpcError as any)?.details, "hint:", (rpcError as any)?.hint)
    throw new Error(typeof rpcError === 'object' && rpcError !== null ? (rpcError as any).message || `RPC error: ${JSON.stringify(rpcError)}` : String(rpcError))
  }

  try {
    const ledger = LedgerService.create()
    const toId = transfer.to_account_id || transfer.to_beneficiary_id || ""
    await ledger.recordTransfer(user.id, transfer.from_account_id, toId, transfer.amount, sourceCurrency, transfer.description || undefined, result?.id)
  } catch (e) {
    console.error("Ledger write failed (non-blocking):", e)
  }

  await syncAccountBalance(transfer.from_account_id, sourceCurrency)
  if (transfer.to_account_id) {
    await syncAccountBalance(transfer.to_account_id, sourceCurrency)
  }

  await mutate("accounts")
  await mutate((key: any) => Array.isArray(key) && key[0] === "transactions")
  await mutate(["transfers", 100])

  await createNotification({
    userId: user.id,
    type: "transfer",
    title: "Transferencia realizada",
    message: `Transferiste ${sourceCurrency} ${roundCurrencyAmount(transfer.amount).toFixed(2)}.`,
    actionUrl: "/history",
  })
  await mutate("notifications")
  
  return result
}

// Credit card payment
export async function payCreditCard(payment: {
  credit_account_id: string
  source_account_id: string
  amount: number
  currency: "DOP" | "USD"
  exchange_rate?: number
  payment_kind?: "balance_to_date" | "statement_balance" | "minimum_payment" | "custom"
  notes?: string
  apply_commission?: boolean
}) {
  const applyCommission = Boolean(payment.apply_commission)
  const paymentGroupId = generatePaymentGroupId()
  const user = await getAuthenticatedUser()
  if (!user) throw new Error("No autenticado")

  if (payment.amount <= 0) {
    throw new Error("El monto del pago debe ser mayor a cero")
  }

  const { data: creditCard } = await supabase
    .from("accounts")
    .select("id,name,credit_limit_dop,credit_limit_usd,current_debt,current_debt_dop,current_debt_usd,statement_balance_dop,statement_balance_usd,paid_statement_amount_dop,paid_statement_amount_usd,pending_amount,paid_amount,available_credit_dop,available_credit_usd")
    .eq("id", payment.credit_account_id)
    .single()

  if (!creditCard) throw new Error("Tarjeta de crédito no encontrada")

  const { data: sourceAccount } = await supabase
    .from("accounts")
    .select("id,balance,currency,name")
    .eq("id", payment.source_account_id)
    .single()

  if (!sourceAccount) throw new Error("Cuenta origen no encontrada")

  const sourceCurrency = sourceAccount.currency as "DOP" | "USD"
  const conversionApplies = sourceCurrency !== payment.currency
  const exchangeRate = conversionApplies ? Number(payment.exchange_rate || 0) : 1

  if (conversionApplies && (!Number.isFinite(exchangeRate) || exchangeRate <= 0)) {
    throw new Error("Ingresa una tasa de cambio válida")
  }

  const sourceDebitAmount = roundCurrencyAmount(
    conversionApplies
      ? payment.currency === "USD" && sourceCurrency === "DOP"
        ? payment.amount * exchangeRate
        : payment.amount / exchangeRate
      : payment.amount
  )

  const commissionAmount = applyCommission ? getCommissionAmount(sourceDebitAmount) : 0
  const totalSourceDebit = roundCurrencyAmount(sourceDebitAmount + commissionAmount)

  const fields = getCurrencyFields(payment.currency)
  const currentDebt = Number((creditCard as Record<string, unknown>)[fields.debt] ?? 0)
  const currentStatement = Number((creditCard as Record<string, unknown>)[fields.statement] ?? 0)
  const currentPaid = Number((creditCard as Record<string, unknown>)[fields.paidStatement] ?? 0)

  if (payment.amount > currentDebt) {
    throw new Error("No puedes pagar más que la deuda actual")
  }

  if (Number(sourceAccount.balance) < totalSourceDebit) {
    throw new Error("Disponible insuficiente en la cuenta origen para este pago")
  }

  const newDebt = roundCurrencyAmount(Math.max(0, currentDebt - payment.amount))
  const statementRemaining = Math.max(0, currentStatement - currentPaid)
  const paidTowardStatement = Math.min(payment.amount, statementRemaining)
  const newPaidStatement = roundCurrencyAmount(currentPaid + paidTowardStatement)
  const cardLimit = Number((creditCard as Record<string, unknown>)[fields.limit] ?? 0)
  const newAvailableCredit = roundCurrencyAmount(Math.min(cardLimit, Math.max(0, cardLimit - newDebt)))
  const optimisticSourceBalance = roundCurrencyAmount(Number(sourceAccount.balance || 0) - totalSourceDebit)
  const optimisticPendingAmount = Math.max(0, roundCurrencyAmount(currentStatement - newPaidStatement))

  const conversionMetadata = conversionApplies
    ? {
        source_amount: sourceDebitAmount,
        source_currency: sourceCurrency,
        target_amount: payment.amount,
        target_currency: payment.currency,
        exchange_rate: exchangeRate,
        conversion_direction: `${sourceCurrency}_TO_${payment.currency}`,
        exchange_rate_source: "manual",
      }
    : null

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

  const originalCardUpdates: Record<string, unknown> = {
    [fields.debt]: currentDebt,
    [fields.paidStatement]: currentPaid,
    [`available_credit_${payment.currency.toLowerCase()}`]: Number((creditCard as Record<string, unknown>)[`available_credit_${payment.currency.toLowerCase()}`] ?? 0),
  }

  if (payment.currency === "DOP") {
    originalCardUpdates.current_debt = Number(creditCard.current_debt ?? 0)
    originalCardUpdates.pending_amount = Number(creditCard.pending_amount ?? 0)
    originalCardUpdates.paid_amount = Number(creditCard.paid_amount ?? 0)
  }

  const originalSourceBalance = Number(sourceAccount.balance || 0)

  let paymentRecordId: string | null = null
  let sourceTxId: string | null = null
  let cardTxId: string | null = null
  let commissionTxId: string | null = null
  const updatedCyclesToRollback: Array<{ id: string; updates: Record<string, unknown> }> = []

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
      const optimisticSourceTx: Transaction = {
        id: `optimistic-credit-payment-source-${Date.now()}`,
        user_id: user.id,
        account_id: payment.source_account_id,
        category_id: null,
        type: "expense",
        amount: sourceDebitAmount,
        currency: sourceCurrency,
        amount_base: payment.amount,
        exchange_rate: exchangeRate,
        description: `Pago a tarjeta ${creditCard.name}`,
        date: getLocalDateString(),
        notes: payment.notes || null,
        is_recurring: false,
        parent_transaction_id: null,
        metadata: { kind: "credit_payment", credit_account_id: payment.credit_account_id, payment_kind: payment.payment_kind || "custom", payment_currency: payment.currency, conversion: conversionMetadata },
        created_at: new Date().toISOString(),
      }
      const optimisticCardTx: Transaction = {
        id: `optimistic-credit-payment-card-${Date.now()}`,
        user_id: user.id,
        account_id: payment.credit_account_id,
        category_id: null,
        type: "income",
        amount: payment.amount,
        currency: payment.currency,
        amount_base: payment.amount,
        exchange_rate: 1,
        description: `Pago recibido desde ${sourceAccount.name}`,
        date: getLocalDateString(),
        notes: payment.notes || null,
        is_recurring: false,
        parent_transaction_id: optimisticSourceTx.id,
        metadata: { kind: "credit_payment", source_account_id: payment.source_account_id, payment_kind: payment.payment_kind || "custom", payment_currency: payment.currency, conversion: conversionMetadata },
        created_at: new Date().toISOString(),
      }
      return [optimisticSourceTx, optimisticCardTx, ...existing]
    },
    false
  )

  if (applyCommission && commissionAmount > 0) {
    mutate(
      (key: unknown) => Array.isArray(key) && key[0] === "transactions",
      (existing?: Transaction[]) => {
        if (!existing || existing.length === 0) return existing
        const optimisticCommissionTx: Transaction = {
          id: `optimistic-commission-${Date.now()}`,
          user_id: user.id,
          account_id: payment.source_account_id,
          category_id: null,
          type: "expense",
          amount: commissionAmount,
          currency: sourceCurrency,
          amount_base: commissionAmount,
          exchange_rate: 1,
          description: `Comisión de 0.15% por pago a ${creditCard.name}`,
          date: getLocalDateString(),
          notes: null,
          is_recurring: false,
          parent_transaction_id: null,
          metadata: { kind: "commission", rate: COMMISSION_RATE },
          created_at: new Date().toISOString(),
        }
        return [optimisticCommissionTx, ...existing]
      },
      false
    )
  }

  try {
    const { error: cardUpdateError } = await supabase
      .from("accounts")
      .update(updates)
      .eq("id", payment.credit_account_id)

    if (cardUpdateError) throw cardUpdateError

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

        const originalCycleUpdates: Record<string, unknown> = {
          status: cycleRow.status,
        }
        if (payment.currency === "USD") originalCycleUpdates.paid_amount_usd = cycleRow.paid_amount_usd
        else originalCycleUpdates.paid_amount_dop = cycleRow.paid_amount_dop
        updatedCyclesToRollback.push({ id: cycleRow.id, updates: originalCycleUpdates })

        const { error: cycleUpdateError } = await supabase
          .from("credit_card_cycles")
          .update(cycleUpdates)
          .eq("id", cycleRow.id)

        if (cycleUpdateError) throw cycleUpdateError
      }
    }

    const { error: sourceUpdateError } = await supabase
      .from("accounts")
      .update({ balance: optimisticSourceBalance })
      .eq("id", payment.source_account_id)

    if (sourceUpdateError) throw sourceUpdateError

    const { data: paymentRecord, error: paymentError } = await supabase
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

    if (paymentError) {
      console.error("Payment error:", paymentError)
      throw paymentError
    }
    paymentRecordId = paymentRecord.id

    const { data: sourceTx, error: sourceTxError } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        account_id: payment.source_account_id,
        category_id: null,
        type: "expense",
        amount: sourceDebitAmount,
        currency: sourceCurrency,
        amount_base: payment.amount,
        exchange_rate: exchangeRate,
        description: `Pago a tarjeta ${creditCard.name}`,
        date: getLocalDateString(),
        notes: payment.notes || null,
        is_recurring: false,
        metadata: {
          kind: "credit_payment",
          operation_type: "credit_card_payment",
          payment_group_id: paymentGroupId,
          credit_account_id: payment.credit_account_id,
          source_account_id: payment.source_account_id,
          payment_kind: payment.payment_kind || "custom",
          payment_currency: payment.currency,
          currency: payment.currency,
          original_amount: payment.amount,
          created_from: "pay_card_flow",
          side: "source_account",
          conversion: conversionMetadata,
          payment_id: paymentRecordId,
        },
      })
      .select()
      .single()

    if (sourceTxError) {
      console.error("Source transaction error:", sourceTxError)
      throw sourceTxError
    }
    sourceTxId = sourceTx.id

    const { data: cardTx, error: cardTxError } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        account_id: payment.credit_account_id,
        category_id: null,
        type: "income",
        amount: payment.amount,
        currency: payment.currency,
        amount_base: payment.amount,
        exchange_rate: 1,
        description: `Pago recibido desde ${sourceAccount.name}`,
        date: getLocalDateString(),
        notes: payment.notes || null,
        is_recurring: false,
        parent_transaction_id: sourceTxId,
        metadata: {
          kind: "credit_payment",
          operation_type: "credit_card_payment",
          payment_group_id: paymentGroupId,
          source_account_id: payment.source_account_id,
          credit_card_id: payment.credit_account_id,
          payment_kind: payment.payment_kind || "custom",
          payment_currency: payment.currency,
          currency: payment.currency,
          original_amount: payment.amount,
          created_from: "pay_card_flow",
          side: "credit_card",
          conversion: conversionMetadata,
          payment_id: paymentRecordId,
        },
      })
      .select()
      .single()

    if (cardTxError) {
      console.error("Card transaction error:", cardTxError)
      throw cardTxError
    }
    cardTxId = cardTx.id

    if (applyCommission && commissionAmount > 0) {
      const commissionCategoryId = await getOrCreateCommissionCategoryId(user.id)
      const { data: commissionTx, error: commissionTxError } = await supabase
        .from("transactions")
        .insert({
          user_id: user.id,
          account_id: payment.source_account_id,
          category_id: commissionCategoryId,
          type: "expense",
          amount: commissionAmount,
          currency: sourceCurrency,
          amount_base: commissionAmount,
          exchange_rate: 1,
          description: `Comisión de 0.15% por pago a ${creditCard.name}`,
          date: getLocalDateString(),
          notes: null,
          is_recurring: false,
          parent_transaction_id: sourceTxId,
          metadata: { kind: "commission", rate: COMMISSION_RATE },
        })
        .select()
        .single()

      if (commissionTxError) {
        console.error("Commission transaction error:", commissionTxError)
        throw commissionTxError
      }
      commissionTxId = commissionTx.id
    }

    await syncCreditAccountCycle(payment.credit_account_id)

    const totalPaid = applyCommission ? totalSourceDebit : sourceDebitAmount
    const commissionText = applyCommission && commissionAmount > 0
      ? ` (incluye ${sourceCurrency} ${commissionAmount.toFixed(2)} de comisión)`
      : ""
    await createNotification({
      userId: user.id,
      type: "credit",
      title: "Pago de tarjeta registrado",
      message: `Pagaste ${sourceCurrency} ${roundCurrencyAmount(totalPaid).toFixed(2)} de tu tarjeta${commissionText}.`,
      actionUrl: "/pay",
      metadata: {
        kind: "credit_payment",
        payment_group_id: paymentGroupId,
        payment_id: paymentRecordId,
        source_account_id: payment.source_account_id,
        credit_card_id: payment.credit_account_id,
      },
    })
    await mutate("notifications")

    await mutate("accounts")
    await mutate((key: any) => Array.isArray(key) && key[0] === "transactions")
    await mutate("planning_calendar_events")
    await mutate("planning_debts")
    await mutate("planning_debt_payments_month")
    await mutate("planning_budgets_with_usage")

    try {
      const ledger = LedgerService.create()
      await ledger.recordCreditPayment(user.id, payment.source_account_id, payment.credit_account_id, sourceDebitAmount, payment.currency, paymentRecordId || undefined)
      if (commissionAmount > 0) {
        await ledger.recordCommission(user.id, payment.source_account_id, commissionAmount, sourceCurrency, "Comisión DGII por pago de tarjeta")
      }
    } catch (e) {
      console.error("Ledger write failed (non-blocking):", e)
    }

    await syncAccountBalance(payment.source_account_id, sourceCurrency)
    await syncAccountBalance(payment.credit_account_id, payment.currency)

    return {
      payment: paymentRecord,
      sourceTransaction: sourceTx,
      cardTransaction: cardTx,
    }
  } catch (error) {
    console.error("Critical error in payCreditCard DB operations, rolling back...", error)
    try {
      if (commissionTxId) {
        await supabase.from("transactions").delete().eq("id", commissionTxId)
      }
      if (cardTxId) {
        await supabase.from("transactions").delete().eq("id", cardTxId)
      }
      if (sourceTxId) {
        await supabase.from("transactions").delete().eq("id", sourceTxId)
      }
      if (paymentRecordId) {
        await supabase.from("credit_payments").delete().eq("id", paymentRecordId)
      }
      await supabase
        .from("accounts")
        .update({ balance: originalSourceBalance })
        .eq("id", payment.source_account_id)

      for (const cycleToRollback of updatedCyclesToRollback) {
        await supabase
          .from("credit_card_cycles")
          .update(cycleToRollback.updates)
          .eq("id", cycleToRollback.id)
      }

      await supabase
        .from("accounts")
        .update(originalCardUpdates)
        .eq("id", payment.credit_account_id)

      await syncCreditAccountCycle(payment.credit_account_id)
    } catch (rollbackError) {
      console.error("Double failure: Rollback failed as well:", rollbackError)
    }

    await mutate("accounts", undefined, { revalidate: true })
    await mutate((key: any) => Array.isArray(key) && key[0] === "transactions", undefined, { revalidate: true })
    await mutate("planning_calendar_events", undefined, { revalidate: true })
    await mutate("planning_debts", undefined, { revalidate: true })
    await mutate("planning_debt_payments_month", undefined, { revalidate: true })
    await mutate("planning_budgets_with_usage", undefined, { revalidate: true })
    throw error
  }
}

export function getCardDebtByCurrency(card: Partial<Account> | null | undefined, currency: "DOP" | "USD") {
  if (!card) return 0
  return currency === "USD"
    ? Number(card.current_debt_usd || 0)
    : Number(card.current_debt_dop || card.current_debt || 0)
}

export function calculateCreditCardPaymentAmounts(input: {
  paymentAmount: number
  sourceCurrency: "DOP" | "USD"
  targetCurrency: "DOP" | "USD"
  exchangeRate?: number
  applyDgiiTax?: boolean
}) {
  const paymentAmount = roundCurrencyAmount(Math.max(0, Number(input.paymentAmount || 0)))
  const sourceCurrency = input.sourceCurrency
  const targetCurrency = input.targetCurrency
  const sameCurrency = sourceCurrency === targetCurrency
  const exchangeRate = sameCurrency ? 1 : Number(input.exchangeRate || 0)

  if (!sameCurrency && (!Number.isFinite(exchangeRate) || exchangeRate <= 0)) {
    throw new Error("La tasa de cambio es obligatoria para este pago.")
  }

  const sourceAmount = roundCurrencyAmount(
    sameCurrency
      ? paymentAmount
      : targetCurrency === "USD" && sourceCurrency === "DOP"
        ? paymentAmount * exchangeRate
        : paymentAmount / exchangeRate
  )

  const dgiiTaxAmount = input.applyDgiiTax ? getCommissionAmount(sourceAmount) : 0
  const totalDebit = roundCurrencyAmount(sourceAmount + dgiiTaxAmount)

  return {
    sourceCurrency,
    targetCurrency,
    paymentAmount,
    sourceAmount,
    targetAmount: paymentAmount,
    exchangeRate,
    exchangeRateDirection: `${sourceCurrency}_TO_${targetCurrency}`,
    dgiiTaxAmount,
    totalDebit,
  }
}

export function validateCreditCardPayment(input: {
  card: Partial<Account> | null | undefined
  sourceAccount: Partial<Account> | null | undefined
  targetCurrency: "DOP" | "USD"
  targetAmount: number
  totalDebit: number
  exchangeRate?: number
}) {
  if (!input.card) throw new Error("Tarjeta no encontrada")
  if (!input.sourceAccount) throw new Error("Cuenta origen no encontrada")
  if (!Number.isFinite(input.targetAmount) || input.targetAmount <= 0) {
    throw new Error("El monto debe ser mayor que cero")
  }

  const currentDebt = getCardDebtByCurrency(input.card, input.targetCurrency)
  if (input.targetAmount > currentDebt) {
    throw new Error("El monto no puede ser mayor que la deuda de la tarjeta.")
  }

  const sourceBalance = Number(input.sourceAccount.balance || 0)
  if (input.totalDebit > sourceBalance) {
    throw new Error("La cuenta seleccionada no tiene balance suficiente.")
  }

  const sourceCurrency = input.sourceAccount.currency as "DOP" | "USD"
  if (sourceCurrency !== input.targetCurrency) {
    const rate = Number(input.exchangeRate || 0)
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error("La tasa de cambio es obligatoria para este pago.")
    }
  }

  return true
}

export async function applyCreditCardPaymentRevalidation() {
  await Promise.all([
    mutate("accounts"),
    mutate("notifications"),
    mutate("planning_calendar_events"),
    mutate("planning_debts"),
    mutate("planning_debt_payments_month"),
    mutate("planning_budgets_with_usage"),
    mutate((key: any) => Array.isArray(key) && key[0] === "transactions"),
  ])
}

export async function createCreditCardPayment(input: Parameters<typeof payCreditCard>[0]) {
  return payCreditCard(input)
}

export async function editCreditCardPayment(input: {
  transactionId: string
  account_id: string
  type: "income" | "expense"
  amount: number
  description: string
  date: string
  category_id: string | null
  notes: string | null
  currency: "DOP" | "USD"
  amount_base?: number | null
  exchange_rate?: number
  is_recurring?: boolean
}) {
  return updateTransaction(input.transactionId, {
    account_id: input.account_id,
    type: input.type,
    amount: input.amount,
    description: input.description,
    date: input.date,
    category_id: input.category_id,
    notes: input.notes,
    currency: input.currency,
    amount_base: input.amount_base || input.amount,
    exchange_rate: input.exchange_rate || 1,
    is_recurring: Boolean(input.is_recurring),
  })
}

export async function deleteCreditCardPayment(transactionId: string) {
  return deleteTransaction(transactionId)
}

// Beneficiary mutations
export async function createBeneficiary(beneficiary: Omit<Beneficiary, "id" | "user_id" | "created_at">) {
  const user = await getAuthenticatedUser()
  if (!user) throw new Error("No autenticado")

  const outboxItem = buildOutboxItem({
    userId: user.id, operation: "create_beneficiary", entity: "beneficiaries",
    payload: beneficiary,
  })
  if (await tryEnqueueOffline(outboxItem, ["beneficiaries"])) {
    return { id: outboxItem.id, user_id: user.id, ...beneficiary, created_at: outboxItem.created_at } as Beneficiary
  }

  try {
    const { data, error } = await supabase
      .from("beneficiaries")
      .insert({ ...beneficiary, user_id: user.id })
      .select()
      .single()

    if (error) throw error
    mutate("beneficiaries")

    await createNotification({
      userId: user.id,
      type: "transfer",
      title: "Beneficiario creado",
      message: `${beneficiary.name} esta listo para transferencias.`,
      actionUrl: "/send",
    })
    mutate("notifications")
    return data
  } catch (err: any) {
    if (isOfflineError(err)) {
      await enqueueOfflineFallback(outboxItem, ["beneficiaries", "notifications"])
      return { id: outboxItem.id, user_id: user.id, ...beneficiary, created_at: outboxItem.created_at } as Beneficiary
    }
    throw err
  }
}

export async function updateBeneficiary(id: string, updates: Partial<Beneficiary>) {
  const user = await getAuthenticatedUser()
  if (!user) throw new Error("No autenticado")

  const outboxItem = buildOutboxItem({
    userId: user.id, operation: "update_beneficiary", entity: "beneficiaries",
    payload: { id, ...updates },
  })
  if (await tryEnqueueOffline(outboxItem, ["beneficiaries"])) return { id, ...updates } as Beneficiary

  const { data, error } = await supabase
    .from("beneficiaries")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    if (isOfflineError(error)) {
      await enqueueOfflineFallback(outboxItem, ["beneficiaries"])
      return { id, ...updates } as Beneficiary
    }
    throw error
  }
  return data
}

export async function deleteBeneficiary(id: string) {
  const user = await getAuthenticatedUser()
  if (!user) throw new Error("No autenticado")

  const outboxItem = buildOutboxItem({
    userId: user.id, operation: "delete_beneficiary", entity: "beneficiaries",
    payload: { id },
  })
  if (await tryEnqueueOffline(outboxItem, ["beneficiaries"])) return

  const { error } = await supabase
    .from("beneficiaries")
    .delete()
    .eq("id", id)

  if (error) {
    if (isOfflineError(error)) {
      await enqueueOfflineFallback(outboxItem, ["beneficiaries"])
      return
    }
    throw error
  }
}

export async function createFinancialSubscription(input: {
  name: string
  logo_url?: string | null
  provider_key?: string | null
  amount: number
  currency: "DOP" | "USD"
  account_id: string
  linked_account_id?: string | null
  linked_credit_card_id?: string | null
  category_id?: string | null
  billing_day: number
  next_payment_date: string
  auto_record_enabled?: boolean
  pre_alert_enabled?: boolean
  status?: "active" | "paused" | "cancelled"
}) {
  const user = await getAuthenticatedUser()
  if (!user) throw new Error("No autenticado")

  const { limits } = await getUserPlanAndLimits(user.id, user.email)
  if (limits.financial_subscriptions !== "unlimited") {
    const { count } = await supabase
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)

    const currentUsage = count || 0
    if (currentUsage >= limits.financial_subscriptions) {
      throw blockedEntitlement({
        feature: "financial_subscriptions",
        reason: limits.financial_subscriptions === 0
          ? "Las suscripciones financieras están disponibles en Pro y Plus."
          : "Llegaste al límite de suscripciones financieras de tu plan.",
        currentUsage,
        limit: limits.financial_subscriptions,
      })
    }
  }

  const categoryId = input.category_id || await getOrCreateSubscriptionCategoryId(user.id)

  const outboxItem = buildOutboxItem({
    userId: user.id, operation: "create_subscription", entity: "subscriptions",
    payload: { ...input, category_id: categoryId },
  })
  if (await tryEnqueueOffline(outboxItem, ["financial_subscriptions"])) {
    return { id: outboxItem.id, user_id: user.id, ...input, category_id: categoryId, created_at: outboxItem.created_at } as FinancialSubscription
  }

  try {
    const { data, error } = await supabase
      .from("subscriptions")
      .insert({
        name: input.name,
        logo_url: input.logo_url || null,
        provider_key: input.provider_key || null,
        amount: input.amount,
        currency: input.currency,
        account_id: input.account_id,
        category_id: categoryId,
        billing_day: input.billing_day,
        next_payment_date: input.next_payment_date,
        user_id: user.id,
        status: input.status || "active",
      })
      .select("*")
      .single()

    if (error) throw error

    await createNotification({
      userId: user.id,
      type: "subscription",
      title: "Suscripcion creada",
      message: `${input.name} por ${input.currency} ${roundCurrencyAmount(input.amount).toFixed(2)} al mes.`,
      actionUrl: "/settings/subscriptions",
    })

    mutate("financial_subscriptions")
    mutate("notifications")
    return data
  } catch (err: any) {
    if (isOfflineError(err)) {
      await enqueueOfflineFallback(outboxItem, ["financial_subscriptions", "notifications"])
      return { id: outboxItem.id, user_id: user.id, ...input, category_id: categoryId, created_at: outboxItem.created_at } as FinancialSubscription
    }
    throw err
  }
}

export async function updateFinancialSubscription(id: string, updates: Partial<FinancialSubscription>) {
  const user = await getAuthenticatedUser()
  if (!user) throw new Error("No autenticado")

  if (updates.auto_record_enabled || updates.pre_alert_enabled) {
    const { limits } = await getUserPlanAndLimits(user.id, user.email)
    if (!limits.planning_full) {
      throw blockedEntitlement({
        feature: "financial_subscriptions",
        reason: "La automatización de suscripciones está disponible en Pro.",
        requiredPlan: "pro",
      })
    }
  }

  const outboxItem = buildOutboxItem({
    userId: user.id, operation: "update_subscription", entity: "subscriptions",
    payload: { id, ...updates },
  })
  if (await tryEnqueueOffline(outboxItem, ["financial_subscriptions"])) return { id, ...updates } as FinancialSubscription

  const { data, error } = await supabase
    .from("subscriptions")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single()

  if (error) {
    if (isOfflineError(error)) {
      await enqueueOfflineFallback(outboxItem, ["financial_subscriptions"])
      return { id, ...updates } as FinancialSubscription
    }
    throw error
  }
  mutate("financial_subscriptions")
  return data
}

export async function deleteFinancialSubscription(id: string) {
  const user = await getAuthenticatedUser()
  if (!user) throw new Error("No autenticado")

  const outboxItem = buildOutboxItem({
    userId: user.id, operation: "delete_subscription", entity: "subscriptions",
    payload: { id },
  })
  if (await tryEnqueueOffline(outboxItem, ["financial_subscriptions"])) return

  const { error } = await supabase
    .from("subscriptions")
    .delete()
    .eq("id", id)

  if (error) {
    if (isOfflineError(error)) {
      await enqueueOfflineFallback(outboxItem, ["financial_subscriptions"])
      return
    }
    throw error
  }
  mutate("financial_subscriptions")
}

export async function processDueFinancialSubscriptions() {
  const user = await getAuthenticatedUser()
  if (!user) return
  const schema = await ensureCreditSchemas()

  const today = getLocalDateString()
  const now = new Date(`${today}T12:00:00`)
  const oneDayMs = 24 * 60 * 60 * 1000

  const { data: subscriptions, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .lte("next_payment_date", today)

  if (error) return

  const { data: upcomingSubscriptions } = await supabase
    .from("subscriptions")
    .select("id, name, next_payment_date")
    .eq("user_id", user.id)
    .eq("status", "active")

  if (upcomingSubscriptions?.length) {
    for (const item of upcomingSubscriptions) {
      const daysUntil = Math.ceil((new Date(`${item.next_payment_date}T12:00:00`).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      if (daysUntil === 1) {
        if (schema.hasNotificationMetadataSchema) {
          const { data: existingUpcoming } = await supabase
            .from("notifications")
            .select("id")
            .eq("user_id", user.id)
            .eq("type", "subscription")
            .contains("metadata", { kind: "subscription_pre_alert", subscription_id: item.id, date: today })
            .limit(1)

          if (existingUpcoming && existingUpcoming.length > 0) {
            continue
          }
        }

        await createNotification({
          userId: user.id,
          type: "subscription",
          title: "Recordatorio de suscripción",
          message: `Mañana se registrará ${item.name}.`,
          actionUrl: "/settings/subscriptions",
          metadata: { kind: "subscription_pre_alert", subscription_id: item.id, date: today },
        })
      }
    }
  }

  if (!subscriptions?.length) return

  for (const subscription of subscriptions) {
    if (!(subscription as any).auto_record_enabled) continue
    const lastProcessedAt = (subscription as any).last_processed_at as string | null
    const retryCount = Number((subscription as any).retry_count || 0)
    if (lastProcessedAt && lastProcessedAt >= today) {
      continue
    }

    const cycleKey = `${subscription.id}:${subscription.next_payment_date}`
    const { data: existingCycleTx } = await supabase
      .from("transactions")
      .select("id")
      .eq("user_id", user.id)
      .eq("subscription_id", subscription.id)
      .contains("metadata", { kind: "subscription_auto_charge", cycle_key: cycleKey })
      .limit(1)

    if (existingCycleTx && existingCycleTx.length > 0) {
      const nextDate = getNextFinancialBillingDateFrom(new Date(`${subscription.next_payment_date}T12:00:00`), Number(subscription.billing_day))
      await updateSubscriptionProcessingMeta(subscription.id, {
        last_charged_date: today,
        next_payment_date: getLocalDateString(nextDate),
        last_processed_at: today,
        retry_count: 0,
      })
      continue
    }

    try {
      await createTransaction({
        account_id: subscription.account_id,
        category_id: subscription.category_id,
        type: "expense",
        amount: Number(subscription.amount),
        currency: subscription.currency,
        description: subscription.name,
        date: today,
        notes: "Cargo automatico de suscripcion",
        is_recurring: true,
        amount_base: Number(subscription.amount),
        exchange_rate: 1,
        parent_transaction_id: null,
        metadata: { kind: "subscription_auto_charge", subscription_id: subscription.id, cycle_key: cycleKey },
        subscription_id: subscription.id,
      })

      const nextDate = getNextFinancialBillingDateFrom(new Date(`${subscription.next_payment_date}T12:00:00`), Number(subscription.billing_day))
      await updateSubscriptionProcessingMeta(subscription.id, {
        last_charged_date: today,
        next_payment_date: getLocalDateString(nextDate),
        last_processed_at: today,
        retry_count: 0,
      })

      await createNotification({
        userId: user.id,
        type: "subscription",
        title: "Suscripción registrada",
        message: `${subscription.name} se registró automáticamente en MiCuadre.`,
        actionUrl: "/history",
      })
    } catch {
      const tomorrow = getLocalDateString(new Date(now.getTime() + oneDayMs))
      await updateSubscriptionProcessingMeta(subscription.id, {
        next_payment_date: tomorrow,
        last_processed_at: today,
        retry_count: retryCount + 1,
      })

      await createNotification({
        userId: user.id,
        type: "subscription",
        title: "No pudimos registrar una suscripción",
        message: `No pudimos registrar ${subscription.name} por fondos insuficientes.`,
        actionUrl: "/settings/subscriptions",
      })
    }
  }

  await Promise.all([
    mutate("financial_subscriptions"),
    mutate("notifications"),
    mutate("accounts"),
    mutate((key: any) => Array.isArray(key) && key[0] === "transactions"),
  ])
}

// Account updates
export async function updateAccountBalance(id: string, newBalance: number) {
  const { error } = await supabase
    .from("accounts")
    .update({ balance: newBalance })
    .eq("id", id)

  if (error) throw error

  await syncAccountBalance(id)
}

// Category mutations
export async function createCategory(category: Omit<Category, "id" | "user_id" | "created_at">) {
  const user = await getAuthenticatedUser()
  if (!user) throw new Error("No autenticado")

  const outboxItem = buildOutboxItem({
    userId: user.id, operation: "create_category", entity: "categories",
    payload: category,
  })
  if (await tryEnqueueOffline(outboxItem, ["categories"])) {
    return { id: outboxItem.id, user_id: user.id, ...category, created_at: outboxItem.created_at } as Category
  }

  try {
    const { data, error } = await supabase
      .from("categories")
      .insert({ ...category, user_id: user.id })
      .select()
      .single()

    if (error) throw error
    mutate("categories")

    await createNotification({
      userId: user.id,
      type: "system",
      title: "Categoria creada",
      message: `La categoria ${category.name} fue creada correctamente.`,
      actionUrl: "/settings/categories",
    })
    mutate("notifications")

    return data
  } catch (err: any) {
    if (isOfflineError(err)) {
      await enqueueOfflineFallback(outboxItem, ["categories", "notifications"])
      return { id: outboxItem.id, user_id: user.id, ...category, created_at: outboxItem.created_at } as Category
    }
    throw err
  }
}

export async function updateCategory(id: string, updates: Pick<Category, "name" | "icon" | "color" | "type" | "is_subscription">) {
  const user = await getAuthenticatedUser()
  if (!user) throw new Error("No autenticado")

  const outboxItem = buildOutboxItem({
    userId: user.id, operation: "update_category", entity: "categories",
    payload: { id, ...updates },
  })
  if (await tryEnqueueOffline(outboxItem, ["categories"])) return { id, ...updates } as Category

  const { data, error } = await supabase
    .from("categories")
    .update(updates)
    .eq("id", id)
    .eq("is_default", false)
    .select()
    .single()

  if (error) {
    if (isOfflineError(error)) {
      await enqueueOfflineFallback(outboxItem, ["categories"])
      return { id, ...updates } as Category
    }
    throw error
  }
  mutate("categories")
  return data
}

export async function deleteCategory(id: string, force = false) {
  const user = await getAuthenticatedUser()
  if (!user) throw new Error("No autenticado")

  const outboxItem = buildOutboxItem({
    userId: user.id, operation: "delete_category", entity: "categories",
    payload: { id, force },
  })
  if (await tryEnqueueOffline(outboxItem, ["categories"])) return

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

  if (error) {
    if (isOfflineError(error)) {
      await enqueueOfflineFallback(outboxItem, ["categories"])
      return
    }
    throw error
  }
  mutate("categories")
}

export async function updateAccount(id: string, updates: Partial<Account>) {
  const user = await getAuthenticatedUser()
  if (!user) throw new Error("No autenticado")

  const outboxItem = buildOutboxItem({
    userId: user.id, operation: "update_account", entity: "accounts",
    payload: { id, ...updates },
  })
  if (await tryEnqueueOffline(outboxItem, ["accounts"])) return { id, ...updates } as Account

  // Capture previous balance for ledger recording
  const { data: prevAccount } = await supabase
    .from("accounts")
    .select("id, type, balance, currency")
    .eq("id", id)
    .single()

  const extractMissingAccountColumn = (message: string) => {
    const match = message.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+of\s+relation\s+"accounts"\s+does\s+not\s+exist/i)
    return match?.[1] || null
  }

  let payload: Record<string, unknown> = { ...updates }
  let data: Account | null = null
  let finalError: any = null

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await supabase
      .from("accounts")
      .update(payload)
      .eq("id", id)
      .select()
      .single()

    if (!response.error) {
      data = response.data as Account
      finalError = null
      break
    }

    const missingColumn = extractMissingAccountColumn(response.error.message || "")
    if (!missingColumn || !(missingColumn in payload)) {
      finalError = response.error
      break
    }

    delete payload[missingColumn]
    finalError = response.error
  }

  if (finalError || !data) {
    if (finalError && isOfflineError(finalError)) {
      await enqueueOfflineFallback(outboxItem, ["accounts"])
      return { id, ...updates } as Account
    }
    throw finalError || new Error("No se pudo actualizar la cuenta")
  }

  // Record balance change in ledger for non-credit accounts
  if (
    prevAccount &&
    prevAccount.type !== "credit" &&
    updates.balance !== undefined &&
    Number(updates.balance) !== Number(prevAccount.balance)
  ) {
    const prevBalance = Number(prevAccount.balance || 0)
    const newBalance = Number(updates.balance || 0)
    const delta = newBalance - prevBalance

    if (delta !== 0) {
      try {
        const ledger = LedgerService.create()
        const currency = (data.currency || "DOP") as "DOP" | "USD"
        if (delta > 0) {
          // Balance increased: record as income (account credited)
          await ledger.recordIncome(user.id, id, Math.abs(delta), currency, "Ajuste manual de saldo", data.id, "accounts")
        } else {
          // Balance decreased: record as expense (account debited)
          await ledger.recordExpense(user.id, id, Math.abs(delta), currency, "Ajuste manual de saldo", data.id, "accounts")
        }
      } catch (e) {
        console.error("Failed to record balance change in ledger (non-blocking):", e)
      }
    }
  }

  mutate("accounts")
  return data
}

// Backward compatibility aliases (financial domain)
export const createSubscription = createFinancialSubscription
export const updateSubscription = updateFinancialSubscription
export const deleteSubscription = deleteFinancialSubscription
export const processDueSubscriptions = processDueFinancialSubscriptions

export async function reconcileAccountBalance(accountId: string) {
  const user = await getAuthenticatedUser()
  if (!user) throw new Error("No autenticado")

  const { data, error } = await supabase.rpc("reconcile_account_balance", {
    p_account_id: accountId,
  })

  if (error) throw error

  mutate("accounts")
  return data as { account_id: string; previous_balance: number; new_balance: number; corrected: boolean }
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
  const user = await getAuthenticatedUser()
  if (!user) throw new Error("No autenticado")

  await supabase.from("accounts").update({ is_favorite: false }).eq("user_id", user.id)
  await supabase.from("accounts").update({ is_favorite: true }).eq("id", accountId)
  mutate("accounts")
}

export async function deleteAccount(id: string) {
  const user = await getAuthenticatedUser()
  if (!user) throw new Error("No autenticado")

  const outboxItem = buildOutboxItem({
    userId: user.id, operation: "delete_account", entity: "accounts",
    payload: { id },
  })
  if (await tryEnqueueOffline(outboxItem, ["accounts"])) return

  await supabase
    .from("ledger_entries")
    .delete()
    .or(`debit_account_id.eq.${id},credit_account_id.eq.${id}`)

  const { error } = await supabase
    .from("accounts")
    .delete()
    .eq("id", id)

  if (error) {
    if (isOfflineError(error)) {
      await enqueueOfflineFallback(outboxItem, ["accounts"])
      return
    }
    throw error
  }
  mutate("accounts")
  mutate((key: any) => Array.isArray(key) && key[0] === "transactions")
}

export async function getAccountDeletionImpact(id: string) {
  const [transactions, transfersFrom, transfersTo, payments, subscriptions] = await Promise.all([
    supabase.from("transactions").select("id", { count: "exact", head: true }).eq("account_id", id),
    supabase.from("transfers").select("id", { count: "exact", head: true }).eq("from_account_id", id),
    supabase.from("transfers").select("id", { count: "exact", head: true }).eq("to_account_id", id),
    supabase.from("credit_payments").select("id", { count: "exact", head: true }).or(`credit_account_id.eq.${id},source_account_id.eq.${id}`),
    supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("account_id", id),
  ])

  const count =
    Number(transactions.count || 0) +
    Number(transfersFrom.count || 0) +
    Number(transfersTo.count || 0) +
    Number(payments.count || 0) +
    Number(subscriptions.count || 0)

  return { count, hasMovements: count > 0 }
}
