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

const supabase = createClient()

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
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true })

  if (error) throw error
  return data || []
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
    refreshInterval: 30000, // Check for new notifications every 30s
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
export async function createAccount(account: Omit<Account, "id" | "user_id" | "created_at" | "updated_at">) {
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
  transaction: Omit<Transaction, "id" | "user_id" | "created_at" | "category" | "account">
) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { data, error } = await supabase
    .from("transactions")
    .insert({ ...transaction, user_id: user.id })
    .select()
    .single()

  if (error) throw error

  await applyAccountImpact({
    accountId: transaction.account_id,
    type: transaction.type,
    amount: transaction.amount,
    direction: 1,
  })

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
  return data
}

export async function markNotificationAsRead(id: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", id)

  if (error) throw error
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

  mutate("goals")
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
}) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  // Get current balances
  const { data: fromAccount } = await supabase
    .from("accounts")
    .select("balance, type")
    .eq("id", transfer.from_account_id)
    .single()

  if (!fromAccount) throw new Error("Account not found")

  if (transfer.amount <= 0) throw new Error("Monto inválido")
  if (Number(fromAccount.balance) < transfer.amount) {
    throw new Error("Fondos insuficientes en la cuenta de origen")
  }

  // Deduct from source account
  const newFromBalance = Number(fromAccount.balance) - transfer.amount
  await supabase
    .from("accounts")
    .update({ balance: newFromBalance })
    .eq("id", transfer.from_account_id)

  // Add to destination if internal account
  if (transfer.to_account_id) {
    const { data: toAccount } = await supabase
      .from("accounts")
      .select("balance")
      .eq("id", transfer.to_account_id)
      .single()

    if (toAccount) {
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
  
  // Mutate cache to refresh data
  mutate("accounts")
  mutate(["transactions", 10])
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
    .select("current_debt")
    .eq("id", payment.credit_account_id)
    .single()

  if (!creditCard) throw new Error("Credit card not found")

  // Validate payment amount
  if (payment.amount > Number(creditCard.current_debt)) {
    throw new Error("No puedes pagar más que la deuda actual")
  }

  // Reduce credit card debt
  const newDebt = Math.max(0, Number(creditCard.current_debt) - payment.amount)
  await supabase
    .from("accounts")
    .update({ current_debt: newDebt })
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
    throw new Error("Fondos insuficientes en la cuenta de origen")
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
    date: new Date().toISOString(),
    notes: payment.notes || null,
    is_recurring: false,
  })

  // Mutate cache
  mutate("accounts")
  mutate(["transactions", 10])
  
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
  return data
}

export async function updateAccount(id: string, updates: Partial<Account>) {
  const { data, error } = await supabase
    .from("accounts")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  return data
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
