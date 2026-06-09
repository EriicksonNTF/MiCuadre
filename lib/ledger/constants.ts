export const GLOBAL_ACCOUNTS = {
  INCOME: "00000000-0000-0000-0000-000000000001",
  EXPENSE: "00000000-0000-0000-0000-000000000002",
} as const

export type EntryType =
  | "transfer"
  | "expense"
  | "income"
  | "credit_payment"
  | "goal_contribution"
  | "commission"
  | "interest"
  | "loan_payment"

export const ENTRY_TYPES: readonly EntryType[] = [
  "transfer",
  "expense",
  "income",
  "credit_payment",
  "goal_contribution",
  "commission",
  "interest",
  "loan_payment",
]

export type Currency = "DOP" | "USD"
