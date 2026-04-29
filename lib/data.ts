// Account Types
export type AccountType = "cash" | "bank" | "credit"

export type SavingsGoal = {
  id: string
  name: string
  icon: string
  color: string
  targetAmount: number
  currentAmount: number
  targetDate: string
}

export type Account = {
  id: string
  name: string
  type: AccountType
  balance: number
  // Credit card specific
  creditLimit?: number
  currentDebt?: number
  cutoffDate?: number // day of month
  dueDate?: number // day of month
}

export type Transaction = {
  id: string
  title: string
  amount: number
  type: "income" | "expense"
  date: string
  category: string
  accountId: string
}

// Mock Data
export const accounts: Account[] = [
  {
    id: "cash",
    name: "Efectivo",
    type: "cash",
    balance: 15420,
  },
  {
    id: "bank",
    name: "Banco Popular",
    type: "bank",
    balance: 87500,
  },
  {
    id: "credit",
    name: "Visa Platinum",
    type: "credit",
    balance: 0,
    creditLimit: 150000,
    currentDebt: 42350,
    cutoffDate: 15,
    dueDate: 5,
  },
]

export const transactions: Transaction[] = [
  {
    id: "1",
    title: "Salario",
    amount: 85000,
    type: "income",
    date: "Hoy",
    category: "income",
    accountId: "bank",
  },
  {
    id: "2",
    title: "El Mesón de la Cava",
    amount: 2850,
    type: "expense",
    date: "Hoy",
    category: "food",
    accountId: "credit",
  },
  {
    id: "3",
    title: "Uber",
    amount: 450,
    type: "expense",
    date: "Ayer",
    category: "transport",
    accountId: "cash",
  },
  {
    id: "4",
    title: "Edenorte",
    amount: 3200,
    type: "expense",
    date: "Ayer",
    category: "utilities",
    accountId: "bank",
  },
  {
    id: "5",
    title: "Caribbean Cinemas",
    amount: 850,
    type: "expense",
    date: "25 Abr",
    category: "entertainment",
    accountId: "credit",
  },
]

// Utility functions
export function formatCurrency(amount: number, currency: "DOP" | "USD" = "DOP") {
  return new Intl.NumberFormat(currency === "DOP" ? "es-DO" : "en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function calculateNetBalance(accounts: Account[]): number {
  return accounts.reduce((total, account) => {
    if (account.type === "credit") {
      return total - (account.currentDebt || 0)
    }
    return total + account.balance
  }, 0)
}

export function getAvailableCredit(account: Account): number {
  if (account.type !== "credit" || !account.creditLimit) return 0
  return account.creditLimit - (account.currentDebt || 0)
}
