import type { Debt, DebtWithProgress } from "@/types/planning"

function round2(value: number) {
  return Math.round(value * 100) / 100
}

function daysInMonth(year: number, monthZeroBased: number) {
  return new Date(year, monthZeroBased + 1, 0).getDate()
}

export function getNextDebtPaymentDate(debt: Debt, now = new Date()) {
  if (!debt.payment_day || debt.payment_day < 1) return null

  const year = now.getFullYear()
  const month = now.getMonth()
  const safeDayCurrent = Math.min(debt.payment_day, daysInMonth(year, month))
  const current = new Date(year, month, safeDayCurrent)

  if (current >= new Date(year, month, now.getDate())) {
    return current.toISOString().slice(0, 10)
  }

  const nextMonth = month + 1
  const nextYear = nextMonth > 11 ? year + 1 : year
  const normalizedMonth = nextMonth > 11 ? 0 : nextMonth
  const safeDayNext = Math.min(debt.payment_day, daysInMonth(nextYear, normalizedMonth))
  return new Date(nextYear, normalizedMonth, safeDayNext).toISOString().slice(0, 10)
}

export function calculateDebtProgress(debt: Debt): DebtWithProgress {
  const original = Number(debt.original_amount || 0)
  const current = Number(debt.current_balance || 0)
  const paid = Math.max(0, round2(original - current))
  const paidPercentage = original > 0 ? Math.min(100, round2((paid / original) * 100)) : 0

  return {
    ...debt,
    paid_amount: paid,
    paid_percentage: paidPercentage,
    next_payment_date: getNextDebtPaymentDate(debt),
  }
}

