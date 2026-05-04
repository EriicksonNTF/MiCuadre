// Database types matching the Supabase schema

export type Currency = "DOP" | "USD"
export type AccountType = "cash" | "debit" | "credit"
export type TransactionType = "income" | "expense"
export type CategoryType = "expense" | "income" | "both"
export type NotificationType = "transaction" | "goal" | "credit" | "system" | "transfer"
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
  closing_date: number | null
  due_date: number | null
  minimum_payment: number | null
  color: string
  icon: string
  is_active: boolean
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
  notes: string | null
  is_recurring: boolean
  created_at: string
  // Joined fields
  category?: Category
  account?: Account
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
  payment_date: string
  notes: string | null
  created_at: string
}
