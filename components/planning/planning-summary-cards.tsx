"use client"

import { AlertTriangle, CreditCard, PiggyBank, TrendingUp } from "lucide-react"
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
  const cappedUsage = Math.min(100, Math.max(0, Math.round(usagePercentage)))
  const budgetStatus = usagePercentage >= 90 ? "Al límite" : usagePercentage >= 70 ? "Vigila" : "Controlado"
  const budgetTone = usagePercentage >= 90 ? "text-red-600 dark:text-red-400" : usagePercentage >= 70 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"

  return (
    <div className="grid grid-cols-1 gap-3">
      <article className="relative overflow-hidden rounded-[1.45rem] border border-border/60 bg-card/82 p-4 text-card-foreground shadow-sm backdrop-blur">
        <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-primary/8" />
        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                <PiggyBank className="h-4 w-4" />
              </span>
              <div>
                <p>Presupuesto usado</p>
                <p className="text-sm font-semibold text-muted-foreground">{formatCurrency(totalSpent)} de {formatCurrency(totalBudget)}</p>
              </div>
            </div>
            <span className={`rounded-full bg-muted px-2.5 py-1 text-[0.625rem] font-black uppercase tracking-wide ${budgetTone}`}>
              {budgetStatus}
            </span>
          </div>
          <div className="mt-4 flex items-end justify-between gap-3">
            <p className="text-3xl font-black tabular-nums tracking-tight">{cappedUsage}%</p>
            <p className="text-right text-xs text-muted-foreground">Uso del mes</p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-red-500"
              style={{ width: `${cappedUsage}%` }}
            />
          </div>
        </div>
      </article>

      <RotatingUpcomingPaymentsCard events={events} />

      <article className="rounded-[1.45rem] border border-border/60 bg-card/82 p-4 text-card-foreground shadow-sm backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <CreditCard className="h-4 w-4" />
            </span>
            <div>
              <p>Deuda pendiente</p>
              <p className="text-xs font-medium text-muted-foreground">
                {next7Amount > 0 ? `${formatCurrency(next7Amount)} próximos 7 días` : "Sin presión esta semana"}
              </p>
            </div>
          </div>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-muted/60 p-3">
            <p className="text-[0.625rem] font-bold uppercase tracking-wide text-muted-foreground">DOP</p>
            <p className="mt-1 text-xl font-bold tabular-nums">{formatCurrency(debtPendingDop, "DOP")}</p>
          </div>
          <div className="rounded-2xl bg-muted/60 p-3">
            <p className="text-[0.625rem] font-bold uppercase tracking-wide text-muted-foreground">USD</p>
            <p className="mt-1 text-xl font-bold tabular-nums">{debtPendingUsd > 0 ? formatCurrency(debtPendingUsd, "USD") : "$0.00"}</p>
          </div>
        </div>
      </article>

      {closestToLimit && (
        <article className="flex items-center gap-3 rounded-[1.35rem] border border-amber-200/70 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-200">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4" />
          </span>
          <p>
            Más cerca del límite: <span className="font-bold">{closestToLimit.category_name}</span> ({Math.round(closestToLimit.percentage)}%)
          </p>
        </article>
      )}
    </div>
  )
}

