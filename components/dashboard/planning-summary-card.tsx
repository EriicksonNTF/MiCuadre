"use client"

import Link from "next/link"
import { CalendarCog } from "lucide-react"
import { formatCurrency } from "@/lib/data"
import { useDebtsSummary, useFinancialCalendarSummary, usePlanningSummary } from "@/hooks/use-planning"

export function PlanningSummaryCard() {
  const { summary } = usePlanningSummary()
  const { next7Amount, nextEvent } = useFinancialCalendarSummary()
  const { summary: debtsSummary } = useDebtsSummary()

  return (
    <section className="rounded-2xl border border-border bg-card p-4 text-card-foreground">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Planificacion</p>
        <CalendarCog className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-2 text-lg font-bold">{summary.budgetUsedLabel} de presupuesto usado</p>
      <p className="text-xs text-muted-foreground">
        {summary.closestToLimit
          ? `Mas cerca del limite: ${summary.closestToLimit.category_name}`
          : "Aun no tienes presupuestos activos"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">Proximos pagos: {formatCurrency(next7Amount)} esta semana</p>
      <p className="text-xs text-muted-foreground">{nextEvent ? `${nextEvent.title} vence ${nextEvent.due_date}` : "Sin pagos próximos"}</p>
      <p className="mt-1 text-xs text-muted-foreground">Deuda pendiente: {formatCurrency(debtsSummary.totalPending)}</p>
      <Link href="/planning" className="mt-3 inline-block text-sm font-semibold text-primary">
        Ver planificación
      </Link>
    </section>
  )
}
