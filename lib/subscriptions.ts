import { addMonths } from "date-fns"

export const SUBSCRIPTION_PROVIDERS = [
  { key: "netflix", name: "Netflix", logo: "N" },
  { key: "apple", name: "Apple", logo: "A" },
  { key: "amazon-prime", name: "Amazon Prime", logo: "P" },
  { key: "spotify", name: "Spotify", logo: "S" },
  { key: "youtube-premium", name: "YouTube Premium", logo: "Y" },
  { key: "disney-plus", name: "Disney+", logo: "D" },
  { key: "other", name: "Other", logo: "O" },
] as const

export function getSubscriptionProvider(providerKey?: string | null) {
  return SUBSCRIPTION_PROVIDERS.find((provider) => provider.key === providerKey) || SUBSCRIPTION_PROVIDERS[SUBSCRIPTION_PROVIDERS.length - 1]
}

export function getNextBillingDateFrom(baseDate: Date, billingDay: number) {
  const day = Math.max(1, Math.min(31, billingDay))
  const year = baseDate.getFullYear()
  const month = baseDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const normalizedDay = Math.min(day, daysInMonth)
  const candidate = new Date(year, month, normalizedDay)
  if (candidate >= new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate())) {
    return candidate
  }

  const nextMonth = addMonths(new Date(year, month, 1), 1)
  const nextDaysInMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate()
  return new Date(nextMonth.getFullYear(), nextMonth.getMonth(), Math.min(day, nextDaysInMonth))
}
