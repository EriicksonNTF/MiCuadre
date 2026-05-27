"use client"

import type { FinancialCalendarEvent } from "@/lib/planning/calendar"

type Props = {
  events: FinancialCalendarEvent[]
  selectedDate: string | null
  onSelectDate: (date: string | null) => void
}

const weekDays = ["L", "M", "X", "J", "V", "S", "D"]

function toDateKey(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function PlanningMiniCalendar({ events, selectedDate, onSelectDate }: Props) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  const monthLabel = now.toLocaleDateString("es-DO", { month: "long", year: "numeric" })
  const firstDay = new Date(year, month, 1)
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayKey = toDateKey(now)

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
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold">{monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</p>
        {selectedDate ? (
          <button onClick={() => onSelectDate(null)} className="text-xs font-semibold text-primary">Limpiar</button>
        ) : null}
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

          return (
            <button
              key={cell.key}
              onClick={() => onSelectDate(isSelected ? null : key)}
              className={`relative h-8 rounded-lg text-xs ${isSelected ? "bg-primary text-primary-foreground" : isToday ? "bg-muted text-foreground" : "text-foreground"}`}
            >
              {cell.day}
              {markers && markers.size > 0 ? (
                <span className="absolute inset-x-0 bottom-0.5 flex justify-center gap-0.5">
                  {Array.from(markers).slice(0, 3).map((marker) => (
                    <span
                      key={marker}
                      className={`h-1.5 w-1.5 rounded-full ${marker === "card" ? "bg-primary" : marker === "sub" ? "bg-accent-foreground" : "bg-destructive"}`}
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
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-accent-foreground" />Suscripción</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-destructive" />Deuda</span>
      </div>
    </article>
  )
}
