import { getLocalDateString } from "@/lib/data"

function buildDate(year: number, monthIndex: number, day: number) {
  return new Date(year, monthIndex, day)
}

function clampDay(year: number, monthIndex: number, day: number) {
  return Math.min(day, new Date(year, monthIndex + 1, 0).getDate())
}

export function getCycleDates(closingDay: number, dueDay: number, now = new Date()) {
  const year = now.getFullYear()
  const month = now.getMonth()

  const currentClosing = buildDate(year, month, clampDay(year, month, closingDay))
  const currentDue = buildDate(year, month, clampDay(year, month, dueDay))

  const closesThisMonth = now <= currentClosing
  const closeYear = closesThisMonth ? year : month === 11 ? year + 1 : year
  const closeMonth = closesThisMonth ? month : (month + 1) % 12
  const cycleEnd = buildDate(closeYear, closeMonth, clampDay(closeYear, closeMonth, closingDay))

  const prevMonth = closeMonth === 0 ? 11 : closeMonth - 1
  const prevYear = closeMonth === 0 ? closeYear - 1 : closeYear
  const cycleStart = new Date(buildDate(prevYear, prevMonth, clampDay(prevYear, prevMonth, closingDay)).getTime() + 86400000)

  const dueBeforeClose = dueDay <= closingDay
  const dueMonth = dueBeforeClose ? (closeMonth + 1) % 12 : closeMonth
  const dueYear = dueBeforeClose && closeMonth === 11 ? closeYear + 1 : closeYear
  const dueDate = buildDate(dueYear, dueMonth, clampDay(dueYear, dueMonth, dueDay))

  const remainingDays = Math.max(0, Math.ceil((dueDate.getTime() - now.getTime()) / 86400000))

  return {
    cycleStartDate: getLocalDateString(cycleStart),
    cycleEndDate: getLocalDateString(cycleEnd),
    dueDate: getLocalDateString(dueDate),
    remainingDays,
  }
}
