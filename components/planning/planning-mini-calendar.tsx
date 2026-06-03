"use client"

import { useMemo, useState } from "react"
import type { FinancialCalendarEvent } from "@/lib/planning/calendar"

type Props = {
  events: FinancialCalendarEvent[]
  selectedDate: string | null
  onSelectDate: (date: string | null) => void
}

const weekDays = ["L", "M", "X", "J", "V", "S", "D"]
const monthNames = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
]

const markerStyles = {
  card: "bg-primary text-primary-foreground border-primary",
  sub: "bg-emerald-500 text-white border-emerald-500",
  debt: "bg-destructive text-destructive-foreground border-destructive",
} as const

function toDateKey(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function PlanningMiniCalendar({ events, selectedDate, onSelectDate }: Props) {
  const now = new Date()
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1))
  const [showMonthPicker, setShowMonthPicker] = useState(false)
  const year = visibleMonth.getFullYear()
  const month = visibleMonth.getMonth()

  const monthLabel = `${monthNames[month]} de ${year}`
  const firstDay = new Date(year, month, 1)
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayKey = toDateKey(now)
  const currentYear = now.getFullYear()
  const years = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => currentYear - 2 + index)
  }, [currentYear])

  const goToMonth = (offset: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
  }

  const setMonth = (nextMonth: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), nextMonth, 1))
  }

  const setYear = (nextYear: number) => {
    setVisibleMonth((current) => new Date(nextYear, current.getMonth(), 1))
  }

  const dotsByDate = new Map<string, Set<string>>()
  for (const event of events) {
    if (!event.due_date.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`)) continue
    if (!dotsByDate.has(event.due_date)) dotsByDate.set(event.due_date, new Set())
    const kind = event.type === "credit_card_payment" ? "card" : event.type === "financial_subscription" ? "sub" : "debt"
    dotsByDate.get(event.due_date)!.add(kind)
  }

  const cells = [] as Array<{ key: string; day: number | null }>
  for (let i = 0; i < startOffset; i += 1) cells.push({ key: `p-${i}`, day: null })
  for (let day = 1; day <= daysInMonth; day += 1) cells.push({ key: `d-${day}`, day })

  return (
    <article className="rounded-2xl border border-border bg-card p-4 text-card-foreground">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => goToMonth(-1)}
          aria-label="Mes anterior"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-lg font-black text-foreground active:scale-95"
        >
          {"<"}
        </button>

        <div className="relative min-w-0 flex-1 text-center">
          <button
            type="button"
            onClick={() => setShowMonthPicker((open) => !open)}
            className="max-w-full rounded-xl px-3 py-2 text-sm font-bold text-foreground transition hover:bg-muted"
          >
            {monthLabel}
          </button>

          {showMonthPicker && (
            <div className="absolute left-1/2 top-11 z-10 grid w-56 -translate-x-1/2 grid-cols-2 gap-2 rounded-2xl border border-border bg-popover p-3 text-popover-foreground shadow-xl">
              <select
                value={month}
                onChange={(event) => setMonth(Number(event.target.value))}
                className="h-10 rounded-xl border border-border bg-background px-2 text-sm"
                aria-label="Elegir mes"
              >
                {monthNames.map((name, index) => (
                  <option key={name} value={index}>{name}</option>
                ))}
              </select>
              <select
                value={year}
                onChange={(event) => setYear(Number(event.target.value))}
                className="h-10 rounded-xl border border-border bg-background px-2 text-sm"
                aria-label="Elegir año"
              >
                {years.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowMonthPicker(false)}
                className="col-span-2 h-10 rounded-xl bg-primary text-sm font-bold text-primary-foreground"
              >
                Aplicar
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => goToMonth(1)}
          aria-label="Mes siguiente"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-lg font-black text-foreground active:scale-95"
        >
          {">"}
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
        {weekDays.map((day) => <span key={day}>{day}</span>)}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          if (!cell.day) return <span key={cell.key} className="h-8" />
          const date = new Date(year, month, cell.day)
          const key = toDateKey(date)
          const markers = dotsByDate.get(key)
          const isToday = key === todayKey
          const isSelected = selectedDate === key
          const markerList = markers ? Array.from(markers).slice(0, 3) as Array<keyof typeof markerStyles> : []
          const primaryMarker = markerList.includes("debt") ? "debt" : markerList.includes("sub") ? "sub" : markerList[0]

          return (
            <button type="button"
              key={cell.key}
              onClick={() => onSelectDate(isSelected ? null : key)}
              className={`relative h-9 rounded-xl border text-xs font-medium transition ${
                isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : primaryMarker
                    ? `${markerStyles[primaryMarker]} shadow-sm`
                    : isToday
                      ? "border-border bg-muted text-foreground"
                      : "border-transparent text-foreground hover:bg-muted"
              }`}
            >
              {cell.day}
              {markerList.length > 1 ? (
                <span className="absolute inset-x-0 bottom-0.5 flex justify-center gap-0.5">
                  {markerList.map((marker) => (
                    <span
                      key={marker}
                      className={`h-1.5 w-1.5 rounded-full border border-background ${markerStyles[marker].split(" ")[0]}`}
                    />
                  ))}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" />Tarjeta</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />Suscripción</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-destructive" />Deuda</span>
        {selectedDate ? (
          <button type="button" onClick={() => onSelectDate(null)} className="ml-auto text-xs font-semibold text-primary">Limpiar</button>
        ) : null}
      </div>
    </article>
  )
}
