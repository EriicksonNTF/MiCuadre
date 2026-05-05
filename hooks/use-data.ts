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
import { getCycleDates } from "@/lib/credit-cycle"

type CreditAccountState = {
  id: string
  user_id: string
  name: string
  currency: string
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
const COMMISSION_CATEGORY_NAME = "Commission / Fees"
const COMMISSION_ERROR_MESSAGE = "El monto más comisión excede tu balance disponible."

function roundCurrencyAmount(value: number): number {
  return Math.round(value * 100) / 100
}

function getCommissionAmount(amount: number): number {
  return roundCurrencyAmount(amount * COMMISSION_RATE)
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

async function ensureSufficientFundsForExpense(accountId: string, totalAmount: number) {
  const { data: account } = await supabase
    .from("accounts")
    .select("id, type, balance, credit_limit, current_debt")
    .eq("id", accountId)
    .single()

  if (!account) throw new Error("Cuenta no encontrada")

  if (account.type === "credit") {
    const creditLimit = Number(account.credit_limit || 0)
    const currentDebt = Number(account.current_debt || 0)
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
    .select("statement_balance, pending_amount, paid_amount, cycle_start_date, cycle_end_date")
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
    .select("id, user_id, name, currency, current_debt, statement_balance, pending_amount, paid_amount, closing_date, due_date, cycle_start_date, cycle_end_date")
    .eq("id", creditAccountId)
    .eq("type", "credit")
    .single<CreditAccountState>()

  if (!account || !account.closing_date || !account.due_date) return

  const cycle = getCycleDates(account.closing_date, account.due_date)
  const currentDebt = Number(account.current_debt || 0)
  const pendingAmount = Number(account.pending_amount ?? currentDebt)

  const needsNewCycle =
    !account.cycle_end_date ||
    account.cycle_end_date !== cycle.cycleEndDate

  let statementBalance = Number(account.statement_balance ?? pendingAmount)
  let nextPendingAmount = pendingAmount
  let paidAmount = Number(account.paid_amount || 0)

  if (needsNewCycle) {
    statementBalance = currentDebt
    nextPendingAmount = currentDebt
    paidAmount = 0
  } else {
    nextPendingAmount = Math.min(pendingAmount, currentDebt)
  }

  await supabase
    .from("accounts")
    .update({
      statement_balance: statementBalance,
      pending_amount: nextPendingAmount,
      paid_amount: paidAmount,
      cycle_start_date: cycle.cycleStartDate,
      cycle_end_date: cycle.cycleEndDate,
    })
    .eq("id", account.id)

  if (cycle.remainingDays <= 3 && nextPendingAmount > 0) {
    await upsertCreditNotification({
      userId: account.user_id,
      title: `Pago pendiente: ${account.name}`,
      message: `Te quedan ${cycle.remainingDays} dia(s) para pagar ${nextPendingAmount.toFixed(2)} ${account.currency}.`,
      metadata: {
        kind: "credit_payment_due",
        account_id: account.id,
        due_date: cycle.dueDate,
        cycle_start_date: cycle.cycleStartDate,
        cycle_end_date: cycle.cycleEndDate,
        pending_amount: nextPendingAmount,
      },
    })
  }

  const isCutoffDay = getLocalDateString() === cycle.cycleEndDate
  if (isCutoffDay) {
    await upsertCreditNotification({
      userId: account.user_id,
      title: `Corte de tarjeta: ${account.name}`,
      message: `Tu ciclo cierra hoy con ${statementBalance.toFixed(2)} ${account.currency}.`,
      metadata: {
        kind: "credit_cutoff",
        account_id: account.id,
        due_date: cycle.dueDate,
        cycle_start_date: cycle.cycleStartDate,
        cycle_end_date: cycle.cycleEndDate,
        statement_balance: statementBalance,
        pending_amount: nextPendingAmount,
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
}) {
  const { accountId, type, amount, direction } = params
  const { data: account } = await supabase
    .from("accounts")
    .select("id, type, balance, current_debt")
    .eq("id", accountId)
    .single()

  if (!account) throw new Error("Cuenta no encontrada")

  if (account.type === "credit") {
    const signed = type === "expense" ? amount * direction : -amount * direction
    const nextDebt = Math.max(0, Number(account.current_debt || 0) + signed)
    await supabase.from("accounts").update({ current_debt: nextDebt }).eq("id", accountId)
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
type NewAccountInput = Omit<Account, "id" | "user_id" | "created_at" | "updated_at" | "statement_balance" | "pending_amount" | "paid_amount" | "cycle_start_date" | "cycle_end_date" | "sort_order" | "is_favorite" | "icon_url" | "icon_type" | "icon_value" | "primary_color" | "secondary_color" | "background_style"> & {
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
    await ensureSufficientFundsForExpense(transaction.account_id, totalAmount)
  }

  const { data, error } = await supabase
    .from("transactions")
    .insert({ ...transaction, user_id: user.id })
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
    })

    if (commissionTxId && commissionAmount > 0) {
      await applyAccountImpact({
        accountId: transaction.account_id,
        type: "expense",
        amount: commissionAmount,
        direction: 1,
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
    })
    throw error
  }

  await applyAccountImpact({
    accountId: updates.account_id,
    type: updates.type,
    amount: Number(updates.amount),
    direction: 1,
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
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", id)

  if (error) throw error
  mutate("notifications")
}

export async function markAllNotificationsAsRead() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", user.id)
    .eq("read", false)

  if (error) throw error
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
  notes?: string
}) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  // Get credit card current debt
  const { data: creditCard } = await supabase
    .from("accounts")
    .select("current_debt, pending_amount, paid_amount")
    .eq("id", payment.credit_account_id)
    .single()

  if (!creditCard) throw new Error("Credit card not found")

  // Validate payment amount
  if (payment.amount > Number(creditCard.current_debt)) {
    throw new Error("No puedes pagar más que la deuda actual")
  }

  // Reduce credit card debt
  const newDebt = Math.max(0, Number(creditCard.current_debt) - payment.amount)
  const pendingAmount = Math.max(0, Number(creditCard.pending_amount ?? creditCard.current_debt) - payment.amount)
  const paidAmount = Number(creditCard.paid_amount || 0) + payment.amount
  await supabase
    .from("accounts")
    .update({ current_debt: newDebt, pending_amount: pendingAmount, paid_amount: paidAmount })
    .eq("id", payment.credit_account_id)

  // Get source account balance
  const { data: sourceAccount } = await supabase
    .from("accounts")
    .select("balance")
    .eq("id", payment.source_account_id)
    .single()

  if (!sourceAccount) throw new Error("Source account not found")

  // Validate source has enough balance
  if (Number(sourceAccount.balance) < payment.amount) {
    throw new Error("Disponible insuficiente en la cuenta origen para este pago")
  }

  // Deduct from source
  const newSourceBalance = Number(sourceAccount.balance) - payment.amount
  await supabase
    .from("accounts")
    .update({ balance: newSourceBalance })
    .eq("id", payment.source_account_id)

  // Create payment record
  const { data, error } = await supabase
    .from("credit_payments")
    .insert({
      user_id: user.id,
      credit_account_id: payment.credit_account_id,
      source_account_id: payment.source_account_id,
      amount: payment.amount,
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
    currency: "DOP",
    amount_base: payment.amount,
    exchange_rate: 1,
    description: "Pago de tarjeta de crédito",
    date: getLocalDateString(),
    notes: payment.notes || null,
    is_recurring: false,
  })

  await syncCreditAccountCycle(payment.credit_account_id)

  // Mutate cache
  mutate("accounts")
  mutate((key: any) => Array.isArray(key) && key[0] === "transactions")
  
  return data
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

  if (error) throw error
  mutate("accounts")
  return data
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
