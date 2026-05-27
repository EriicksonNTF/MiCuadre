import type { Currency } from "@/lib/types/database"

export type BudgetPeriod = "monthly"

export type BudgetStatus = "healthy" | "near_limit" | "warning" | "exceeded"

export type Budget = {
  id: string
  user_id: string
  category_id: string | null
  category_name: string
  name: string
  amount: number
  currency: Currency
  period: BudgetPeriod
  alert_threshold: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type BudgetWithUsage = Budget & {
  spent: number
  remaining: number
  percentage: number
  status: BudgetStatus
  includesPending: boolean
}

export type DebtType = "loan" | "person" | "financing" | "other"
export type DebtFrequency = "weekly" | "biweekly" | "monthly"

export type Debt = {
  id: string
  user_id: string
  name: string
  debt_type: DebtType
  original_amount: number
  current_balance: number
  currency: Currency
  linked_account_id: string | null
  fixed_payment_amount: number | null
  payment_frequency: DebtFrequency
  payment_day: number | null
  start_date: string | null
  interest_rate: number | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type DebtPayment = {
  id: string
  user_id: string
  debt_id: string
  source_account_id: string | null
  amount: number
  currency: Currency
  previous_debt_balance: number | null
  new_debt_balance: number | null
  transaction_id: string | null
  payment_date: string
  notes: string | null
  created_at: string
}

export type DebtWithProgress = Debt & {
  paid_amount: number
  paid_percentage: number
  next_payment_date: string | null
}
