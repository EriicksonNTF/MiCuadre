import { getLocalDateString } from "@/lib/data"

const DAY_MS = 86400000

export function clampDay(year: number, monthIndex: number, day: number) {
  return Math.min(day, new Date(year, monthIndex + 1, 0).getDate())
}

function safeDate(year: number, monthIndex: number, day: number) {
  return new Date(year, monthIndex, clampDay(year, monthIndex, day))
}

export function getCycleForDate(closingDay: number, dueDaysAfterCutoff: number, targetDate = new Date()) {
  const year = targetDate.getFullYear()
  const month = targetDate.getMonth()
  const thisMonthCutoff = safeDate(year, month, closingDay)

  const cycleEnd = targetDate > thisMonthCutoff
    ? safeDate(month === 11 ? year + 1 : year, (month + 1) % 12, closingDay)
    : thisMonthCutoff

  const prevMonth = cycleEnd.getMonth() === 0 ? 11 : cycleEnd.getMonth() - 1
  const prevYear = cycleEnd.getMonth() === 0 ? cycleEnd.getFullYear() - 1 : cycleEnd.getFullYear()
  const prevCutoff = safeDate(prevYear, prevMonth, closingDay)
  const cycleStart = new Date(prevCutoff.getTime())
  const dueDate = new Date(cycleEnd.getTime() + dueDaysAfterCutoff * DAY_MS)
  const todayStr = getLocalDateString()
  const dueStr = getLocalDateString(dueDate)
  const remainingDays = Math.max(0, Math.round(
    (new Date(`${dueStr}T00:00:00`).getTime() - new Date(`${todayStr}T00:00:00`).getTime()) / DAY_MS
  ))

  return {
    cycleStartDate: getLocalDateString(cycleStart),
    cycleEndDate: getLocalDateString(cycleEnd),
    dueDate: dueStr,
    cycleKey: getLocalDateString(cycleEnd),
    remainingDays,
  }
}
