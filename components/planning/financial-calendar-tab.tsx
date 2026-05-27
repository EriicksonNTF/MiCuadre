"use client"

import { useMemo, useState } from "react"
import { formatCurrency } from "@/lib/data"
import { useFinancialCalendarSummary } from "@/hooks/use-planning"
import { CalendarEventCard } from "@/components/planning/calendar-event-card"
import { CalendarFilterPills, type CalendarFilter } from "@/components/planning/calendar-filter-pills"
import { PlanningMiniCalendar } from "@/components/planning/planning-mini-calendar"

function emptyByFilter(filter: CalendarFilter) {
  if (filter === "credit_card_payment") return "No hay tarjetas próximas."
  if (filter === "financial_subscription") return "No hay suscripciones próximas."
  if (filter === "debt_payment") return "No hay deudas próximas."
  return "No tienes compromisos próximos."
}

export function FinancialCalendarTab() {
  const { events, next7Amount, monthCommitted, isLoading } = useFinancialCalendarSummary()
  const [filter, setFilter] = useState<CalendarFilter>("all")
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const byFilter = filter === "all" ? events : events.filter((event) => event.type === filter)
    const byDate = selectedDate ? byFilter.filter((event) => event.due_date === selectedDate) : byFilter
    return byDate
  }, [events, filter, selectedDate])

  return (
    <section className="space-y-4">
      <article className="rounded-2xl border border-border bg-card p-4 text-card-foreground">
        <p className="text-sm font-semibold">Calendario financiero</p>
        <p className="mt-2 text-lg font-bold">Próximos 7 días</p>
        <p className="text-sm text-muted-foreground">{formatCurrency(next7Amount)} en compromisos</p>
        <p className="mt-2 text-xs text-muted-foreground">Total comprometido del mes: {formatCurrency(monthCommitted)}</p>
      </article>

      <PlanningMiniCalendar events={events} selectedDate={selectedDate} onSelectDate={setSelectedDate} />

      <CalendarFilterPills value={filter} onChange={setFilter} />

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : filtered.length === 0 ? (
        <article className="rounded-2xl border border-border bg-card p-5 text-center text-sm text-muted-foreground">
          {emptyByFilter(filter)}
        </article>
      ) : (
        <div className="space-y-3">
          {filtered.map((event) => (
            <CalendarEventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </section>
  )
}
