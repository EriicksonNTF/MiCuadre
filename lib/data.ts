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

export function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function formatAmount(value: number): string {
  const safeValue = Number(value || 0)
  const formatter = new Intl.NumberFormat("es-DO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return formatter.format(safeValue)
}

export function getCurrencySymbol(currency?: Currency): string {
  const c = currency ?? preferredDisplayCurrency
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: c,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
    .format(0)
    .replace(/[\d\s]/g, "")
    .trim()
}

export function formatCurrency(amount: number, currency?: Currency) {
  const displayCurrency = currency ?? preferredDisplayCurrency
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: displayCurrency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function calculateNetBalance(accounts: Account[]): number {
  return accounts.reduce((total, account) => {
    if (account.type === "credit") {
      return total
    }
    return total + account.balance
  }, 0)
}

export function getAvailableCredit(account: Partial<Account> & { creditLimit?: number | null; currentDebt?: number | null; type?: string }): number {
  if (account.type !== "credit") return 0
  const limit = account.creditLimit ?? account.credit_limit_dop ?? account.credit_limit ?? 0
  const debt = account.currentDebt ?? account.current_debt_dop ?? account.current_debt ?? 0
  return Number(limit) - Number(debt)
}

export function getAvailableCreditByCurrency(account: Partial<Account>, currency: Currency): number {
  if (account.type !== "credit") return 0
  if (currency === "USD") {
    return Number(account.credit_limit_usd || 0) - Number(account.current_debt_usd || 0)
  }
  return Number(account.credit_limit_dop || 0) - Number(account.current_debt_dop || 0)
}

export function formatDate(dateString: string, locale: "es" | "en" = "es"): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateString)
    ? new Date(`${dateString}T12:00:00`)
    : new Date(dateString)
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

export function getAccountBrandingDefaults(type: string) {
  if (type === "credit") {
    return {
      iconType: "icon",
      iconValue: "credit-card",
      primaryColor: "#07111f",
      secondaryColor: "#0ea5e9",
      backgroundStyle: "gradient",
    }
  }

  if (type === "cash") {
    return {
      iconType: "icon",
      iconValue: "banknote",
      primaryColor: "#0f766e",
      secondaryColor: "#14b8a6",
      backgroundStyle: "gradient",
    }
  }

  return {
    iconType: "icon",
    iconValue: "building-2",
    primaryColor: "#0b4a8a",
    secondaryColor: "#38bdf8",
    backgroundStyle: "gradient",
  }
}

export function getReadableTextColor(hexColor: string): "#ffffff" | "#0b1220" {
  const clean = hexColor.replace("#", "")
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.62 ? "#0b1220" : "#ffffff"
}
