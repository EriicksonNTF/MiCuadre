"use client"

import Link from "next/link"
import { formatCurrency } from "@/lib/data"
import { useFinancialCalendarSummary } from "@/hooks/use-planning"

export function CalendarPreviewCard() {
  const { events, isLoading } = useFinancialCalendarSummary()
  const upcoming = events.filter((event) => event.status !== "paid").slice(0, 3)

  return (
    <section className="rounded-[28px] border border-border bg-card p-5 text-card-foreground">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Calendario financiero</p>
          <p className="text-xs text-muted-foreground">Próximos pagos</p>
        </div>
        <Link href="/planning?tab=calendar" className="text-sm font-semibold text-primary">Ver calendario</Link>
      </div>

      <div className="mt-4 space-y-3">
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-12 animate-pulse rounded-xl bg-muted" />
            <div className="h-12 animate-pulse rounded-xl bg-muted" />
          </div>
        ) : upcoming.length === 0 ? (
          <p className="rounded-xl bg-muted px-3 py-4 text-sm text-muted-foreground">No tienes pagos próximos</p>
        ) : (
          upcoming.map((event) => (
            <article key={event.id} className="rounded-xl border border-border bg-background px-3 py-3">
              <p className="text-sm font-semibold text-foreground">{event.title}</p>
              <p className="text-xs text-muted-foreground">{event.detail || "Próximo compromiso"}</p>
              {event.amount ? <p className="mt-1 text-sm font-semibold text-foreground">{formatCurrency(Number(event.amount || 0), (event.currency as "DOP" | "USD") || "DOP")}</p> : null}
            </article>
          ))
        )}
      </div>
    </section>
  )
}
