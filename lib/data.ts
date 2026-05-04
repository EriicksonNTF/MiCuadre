import type { Account, Currency } from "@/lib/types/database"

// Re-export types for backwards compatibility
export type { Account, Currency } from "@/lib/types/database"
export type AccountType = "cash" | "debit" | "credit"

let preferredDisplayCurrency: Currency = "DOP"

export function setPreferredCurrency(currency: Currency) {
  preferredDisplayCurrency = currency
}

export function getPreferredCurrency(): Currency {
  return preferredDisplayCurrency
}

// Utility functions
export function formatCurrency(amount: number, currency?: Currency) {
  const displayCurrency = currency ?? preferredDisplayCurrency
  return new Intl.NumberFormat(displayCurrency === "DOP" ? "es-DO" : "en-US", {
    style: "currency",
    currency: displayCurrency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function calculateNetBalance(accounts: Account[]): number {
  return accounts.reduce((total, account) => {
    if (account.type === "credit") {
      return total - (account.current_debt || 0)
    }
    return total + account.balance
  }, 0)
}

export function getAvailableCredit(account: Partial<Account> & { creditLimit?: number | null; currentDebt?: number | null; type?: string }): number {
  if (account.type !== "credit" || !account.creditLimit) return 0
  return account.creditLimit - (account.currentDebt || 0)
}

export function formatDate(dateString: string, locale: "es" | "en" = "es"): string {
  const date = new Date(dateString)
  return date.toLocaleDateString(locale === "es" ? "es-DO" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function getDaysUntilDue(dueDate: number): number {
  const now = new Date()
  const currentDay = now.getDate()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  let targetDate: Date
  if (currentDay <= dueDate) {
    targetDate = new Date(currentYear, currentMonth, dueDate)
  } else {
    targetDate = new Date(currentYear, currentMonth + 1, dueDate)
  }

  const diffTime = targetDate.getTime() - now.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

export function getPaymentUrgency(daysUntil: number): "urgent" | "warning" | "normal" {
  if (daysUntil <= 3) return "urgent"
  if (daysUntil <= 7) return "warning"
  return "normal"
}
