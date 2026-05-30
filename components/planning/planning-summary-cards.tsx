"use client"

import { CreditCard, PiggyBank } from "lucide-react"
import { formatCurrency } from "@/lib/data"
import type { FinancialCalendarEvent } from "@/lib/planning/calendar"
import type { BudgetWithUsage } from "@/types/planning"
import { RotatingUpcomingPaymentsCard } from "@/components/planning/rotating-upcoming-payments-card"

export function PlanningSummaryCards({
  totalBudget,
  totalSpent,
  usagePercentage,
  closestToLimit,
  next7Amount,
  events,
  debtPendingDop,
  debtPendingUsd,
}: {
  totalBudget: number
  totalSpent: number
  usagePercentage: number
  closestToLimit: BudgetWithUsage | null
  next7Amount: number
  events: FinancialCalendarEvent[]
  debtPendingDop: number
  debtPendingUsd: number
}) {
  return (
    <div className="grid grid-cols-1 gap-3">
      <article className="rounded-2xl border border-border bg-card p-4 text-card-foreground">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <PiggyBank className="h-4 w-4" />
          Presupuesto usado
        </div>
        <p className="mt-2 text-xl font-bold tabular-nums">{Math.min(100, Math.round(usagePercentage))}%</p>
        <p className="text-xs text-muted-foreground">{formatCurrency(totalSpent)} de {formatCurrency(totalBudget)}</p>
      </article>

      <RotatingUpcomingPaymentsCard events={events} />

      <article className="rounded-2xl border border-border bg-card p-4 text-card-foreground">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <CreditCard className="h-4 w-4" />
          Deuda pendiente
        </div>
        <p className="mt-2 text-sm font-bold">{formatCurrency(debtPendingDop, "DOP")}</p>
        {debtPendingUsd > 0 ? <p className="text-sm font-bold">{formatCurrency(debtPendingUsd, "USD")}</p> : null}
        <p className="text-xs text-muted-foreground">
          {next7Amount > 0 ? `${formatCurrency(next7Amount)} en próximos 7 días` : "No tienes deudas pendientes"}
        </p>
      </article>

      {closestToLimit && (
        <article className="rounded-2xl border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
          Mas cerca del limite: <span className="font-semibold text-foreground">{closestToLimit.category_name}</span> ({Math.round(closestToLimit.percentage)}%)
        </article>
      )}
    </div>
  )
}

