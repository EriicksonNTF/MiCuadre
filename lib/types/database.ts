// Database types matching the Supabase schema

export type Currency = "DOP" | "USD"
export type AccountType = "cash" | "debit" | "credit"
export type TransactionType = "income" | "expense"
export type CategoryType = "expense" | "income" | "both"
export type NotificationType = "transaction" | "goal" | "credit" | "system" | "transfer" | "subscription"
export type SubscriptionStatus = "active" | "paused" | "cancelled"
export type ReceiptStatus = "pending" | "processed" | "confirmed" | "rejected"
export type Theme = "light" | "dark" | "system"
export type Language = "es" | "en"

export interface Profile {
  id: string
  email: string | null
  full_name: string | null
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  preferred_currency: Currency
  language: Language
  theme: Theme
  notifications_enabled: boolean
  onboarding_completed: boolean
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  user_id: string | null
  name: string
  icon: string
  color: string
  type: CategoryType
  is_subscription: boolean
  is_default: boolean
  created_at: string
}

export interface Account {
  id: string
  user_id: string
  name: string
  type: AccountType
  currency: Currency
  balance: number
  credit_limit: number | null
  current_debt: number | null
  credit_limit_dop: number | null
  credit_limit_usd: number | null
  current_balance_dop: number | null
  current_balance_usd: number | null
  current_debt_dop: number | null
  current_debt_usd: number | null
  financed_balance_dop: number | null
  financed_balance_usd: number | null
  available_credit_dop: number | null
  available_credit_usd: number | null
  statement_balance_dop: number | null
  statement_balance_usd: number | null
  paid_statement_amount_dop: number | null
  paid_statement_amount_usd: number | null
  pending_transit_dop: number | null
  pending_transit_usd: number | null
  closing_day: number | null
  payment_due_day: number | null
  due_days_after_cutoff: number | null
  annual_interest_rate: number | null
  minimum_payment_percentage: number | null
  last_statement_cutoff_date: string | null
  statement_due_date: string | null
  late_fee_applied_cycle_dop: string | null
  late_fee_applied_cycle_usd: string | null
  statement_balance: number | null
  pending_amount: number | null
  paid_amount: number | null
  cycle_start_date: string | null
  cycle_end_date: string | null
  closing_date: number | null
  due_date: number | null
  minimum_payment: number | null
  color: string
  icon: string
  icon_url: string | null
  icon_type: "emoji" | "icon" | "image" | null
  icon_value: string | null
  account_number?: string | null
  bank_name?: string | null
  bank_logo_key?: string | null
  bank_logo_url?: string | null
  primary_color: string | null
  secondary_color: string | null
  background_style: string | null
  is_active: boolean
  sort_order: number | null
  is_favorite: boolean
  created_at: string
  updated_at: string
}

export interface Transaction {
  id: string
  user_id: string
  account_id: string
  category_id: string | null
  type: TransactionType
  amount: number
  currency: Currency
  amount_base: number | null
  exchange_rate: number
  description: string | null
  date: string
  subscription_id?: string | null
  billing_cycle_id?: string | null
  is_statement_transaction?: boolean
  notes: string | null
  is_recurring: boolean
  parent_transaction_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  // Joined fields
  category?: Category
  account?: Account
}

export interface Subscription {
  id: string
  user_id: string
  name: string
  logo_url: string | null
  provider_key: string | null
  amount: number
  currency: Currency
  account_id: string
  category_id: string | null
  billing_day: number
  next_payment_date: string
  last_charged_date: string | null
  status: SubscriptionStatus
  created_at: string
  account?: Account
  category?: Category
}

export interface Beneficiary {
  id: string
  user_id: string
  name: string
  account_reference: string | null
  bank_name: string | null
  notes: string | null
  is_favorite: boolean
  created_at: string
}

export interface Transfer {
  id: string
  user_id: string
  from_account_id: string
  to_account_id: string | null
  to_beneficiary_id: string | null
  amount: number
  currency: Currency
  description: string | null
  date: string
  created_at: string
  // Joined fields
  from_account?: Account
  to_account?: Account
  to_beneficiary?: Beneficiary
}

export interface Goal {
  id: string
  user_id: string
  name: string
  target_amount: number
  current_amount: number
  currency: Currency
  target_date: string | null
  color: string
  icon: string
  is_completed: boolean
  created_at: string
  updated_at: string
}

export interface GoalContribution {
  id: string
  user_id: string
  goal_id: string
  account_id: string
  amount: number
  date: string
  notes: string | null
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  type: NotificationType
  read: boolean
  action_url: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface ReceiptScan {
  id: string
  user_id: string
  image_url: string | null
  raw_text: string | null
  parsed_data: Record<string, unknown> | null
  status: ReceiptStatus
  transaction_id: string | null
  created_at: string
}

export interface CreditPayment {
  id: string
  user_id: string
  credit_account_id: string
  source_account_id: string
  amount: number
  currency: Currency
  payment_kind: "balance_to_date" | "statement_balance" | "minimum_payment" | "custom"
  payment_date: string
  notes: string | null
  created_at: string
}

export interface CreditCardCycle {
  id: string
  user_id: string
  account_id: string
  cycle_start_date: string
  cycle_end_date: string
  due_date: string
  statement_balance_dop: number
  statement_balance_usd: number
  paid_amount_dop: number
  paid_amount_usd: number
  financed_amount_dop: number
  financed_amount_usd: number
  interest_amount_dop: number
  interest_amount_usd: number
  status: "open" | "closed" | "paid" | "partial" | "overdue" | "financed"
  created_at: string
}
