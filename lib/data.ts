import type { Account, Currency } from "@/lib/types/database"

// Re-export types for backwards compatibility
export type { Account, Currency } from "@/lib/types/database"
export type AccountType = "cash" | "debit" | "credit"

// Utility functions
export function formatCurrency(amount: number, currency: Currency = "DOP") {
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
      return total - (account.current_debt || 0)
    }
    return total + account.balance
  }, 0)
}

export function getAvailableCredit(account: Account): number {
  if (account.type !== "credit" || !account.credit_limit) return 0
  return account.credit_limit - (account.current_debt || 0)
}

export function formatDate(dateString: string, locale: "es" | "en" = "es"): string {
  const date = new Date(dateString)
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)

  // Check if same day
  if (date.toDateString() === now.toDateString()) {
    return locale === "es" ? "Hoy" : "Today"
  }

  // Check if yesterday
  if (date.toDateString() === yesterday.toDateString()) {
    return locale === "es" ? "Ayer" : "Yesterday"
  }

  // Otherwise return formatted date
  return date.toLocaleDateString(locale === "es" ? "es-DO" : "en-US", {
    day: "numeric",
    month: "short",
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
