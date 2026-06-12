"use client"

import { useMemo, useState } from "react"
import { formatCurrency } from "@/lib/data"
import { useFinancialCalendarSummary } from "@/hooks/use-planning"
import { useAccounts } from "@/hooks/use-data"
import { useDebtsSummary } from "@/hooks/use-planning"
import { CalendarEventCard } from "@/components/planning/calendar-event-card"
import { CalendarFilterPills, type CalendarFilter } from "@/components/planning/calendar-filter-pills"
import { PlanningMiniCalendar } from "@/components/planning/planning-mini-calendar"
import { RotatingUpcomingPaymentsCard } from "@/components/planning/rotating-upcoming-payments-card"
import { QuickPayCardSheet } from "@/components/planning/quick-pay-card-sheet"
import { PayDebtSheet } from "@/components/planning/pay-debt-sheet"

function emptyByFilter(filter: CalendarFilter) {
  if (filter === "credit_card_payment") return "No hay tarjetas próximas."
  if (filter === "financial_subscription") return "No hay suscripciones próximas."
  if (filter === "debt_payment") return "No hay deudas próximas."
  return "No tienes compromisos próximos."
}

export function FinancialCalendarTab() {
  const { events, isLoading } = useFinancialCalendarSummary()
  const { data: accounts = [] } = useAccounts()
  const { debts = [] } = useDebtsSummary()
  const [filter, setFilter] = useState<CalendarFilter>("all")
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [quickCardOpen, setQuickCardOpen] = useState(false)
  const [quickCardTarget, setQuickCardTarget] = useState<any | null>(null)
  const [quickDebtOpen, setQuickDebtOpen] = useState(false)
  const [quickDebtTarget, setQuickDebtTarget] = useState<any | null>(null)

  const filtered = useMemo(() => {
    const byFilter = filter === "all" ? events : events.filter((event) => event.type === filter)
    const byDate = selectedDate ? byFilter.filter((event) => event.due_date === selectedDate) : byFilter
    return byDate
  }, [events, filter, selectedDate])

  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return []
    return events.filter((event) => event.due_date === selectedDate)
  }, [events, selectedDate])

  const selectedDateLabel = selectedDate
    ? new Date(`${selectedDate}T12:00:00`).toLocaleDateString("es-DO", { day: "2-digit", month: "long" })
    : null

  const navigateFromEvent = (event: (typeof events)[number]) => {
    if (event.type === "credit_card_payment") {
      const account = accounts.find((item) => item.id === event.source_id && item.type === "credit")
      if (!account) return
      const currency = (event.currency as "DOP" | "USD") || "DOP"
      const currentDebt = currency === "USD" ? Number(account.current_debt_usd || 0) : Number(account.current_debt_dop || account.current_debt || 0)
      const statementBalance = currency === "USD"
        ? Math.max(0, Number(account.statement_balance_usd || 0) - Number(account.paid_statement_amount_usd || 0))
        : Math.max(0, Number(account.statement_balance_dop || 0) - Number(account.paid_statement_amount_dop || 0))
      const minimumPayment = Number(account.minimum_payment || 0)
      setQuickCardTarget({
        id: account.id,
        name: account.name,
        currency,
        currentDebt,
        statementBalance,
        minimumPayment,
        dueDate: account.statement_due_date || null,
        suggestedAmount: Number(event.amount || 0) > 0 ? Number(event.amount || 0) : statementBalance > 0 ? statementBalance : minimumPayment > 0 ? minimumPayment : currentDebt,
      })
      setQuickCardOpen(true)
      return
    }
    if (event.type === "debt_payment") {
      const debt = debts.find((item) => item.id === event.source_id) || null
      if (debt) {
        setQuickDebtTarget(debt)
        setQuickDebtOpen(true)
      }
      return
    }
    window.location.href = "/settings/subscriptions"
  }

  return (
    <section className="space-y-4">
      <PlanningMiniCalendar events={events} selectedDate={selectedDate} onSelectDate={setSelectedDate} />

      <RotatingUpcomingPaymentsCard events={events} />

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Filtrar por tipo</p>
        <CalendarFilterPills value={filter} onChange={setFilter} />
      </div>

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

      {selectedDate ? (
        <div className="fixed inset-0 z-[60] flex items-end bg-foreground/18 backdrop-blur-[6px] dark:bg-black/45" data-no-edge-back="true">
          <section className="flex max-h-[82vh] w-full flex-col rounded-t-[28px] border border-border bg-card text-card-foreground">
            <header className="shrink-0 border-b border-border px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-foreground">Pagos del {selectedDateLabel}</h3>
                <button type="button" onClick={() => setSelectedDate(null)} className="rounded-full bg-muted px-3 py-1 text-sm font-semibold text-foreground">Cerrar</button>
              </div>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              {selectedDateEvents.length === 0 ? (
                <p className="rounded-xl bg-muted px-4 py-4 text-sm text-muted-foreground">No hay compromisos para este día.</p>
              ) : (
                <div className="space-y-3">
                  {selectedDateEvents.map((event) => (
                    <article key={event.id} className="rounded-2xl border border-border bg-background p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{event.type === "credit_card_payment" ? "Tarjeta" : event.type === "financial_subscription" ? "Suscripción" : "Deuda"}</p>
                      <p className="mt-1 text-base font-semibold text-foreground">{event.title}</p>
                      {event.amount ? <p className="mt-1 text-sm text-muted-foreground">Monto: {formatCurrency(Number(event.amount || 0), (event.currency as "DOP" | "USD") || "DOP")}</p> : null}
                      {event.detail ? <p className="mt-1 text-sm text-muted-foreground">{event.detail}</p> : null}
                      <button type="button" onClick={() => navigateFromEvent(event)} className="mt-3 h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">
                        {event.type === "credit_card_payment" ? "Pagar tarjeta" : event.type === "financial_subscription" ? "Ver suscripción" : "Pagar cuota"}
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}

      <QuickPayCardSheet open={quickCardOpen} onOpenChange={setQuickCardOpen} target={quickCardTarget} />
      <PayDebtSheet open={quickDebtOpen} onOpenChange={setQuickDebtOpen} debt={quickDebtTarget} />
    </section>
  )
}
