"use client"

import { Pencil } from "lucide-react"
import { formatCurrency } from "@/lib/data"
import { cn } from "@/lib/utils"
import type { BudgetWithUsage } from "@/types/planning"

const statusCopy = {
  healthy: "Saludable",
  near_limit: "Cerca del limite",
  warning: "Advertencia",
  exceeded: "Excedido",
} as const

const statusStyle = {
  healthy: "bg-accent/20 text-accent-foreground",
  near_limit: "bg-muted text-foreground",
  warning: "bg-primary/15 text-foreground",
  exceeded: "bg-destructive/15 text-destructive",
} as const

export function BudgetCard({ budget, onEdit }: { budget: BudgetWithUsage; onEdit: () => void }) {
  const progress = Math.min(100, Math.max(0, budget.percentage))
  return (
    <article className="rounded-2xl border border-border bg-card p-4 text-card-foreground">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{budget.name}</p>
          <p className="text-xs text-muted-foreground">{budget.category_name}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("rounded-full px-2 py-1 text-[10px] font-semibold", statusStyle[budget.status])}>
            {statusCopy[budget.status]}
          </span>
          <button onClick={onEdit} className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground" aria-label="Editar presupuesto">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <p className="mt-3 text-sm font-semibold tabular-nums">
        {formatCurrency(budget.spent, budget.currency)} / {formatCurrency(budget.amount, budget.currency)}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">Restante: {formatCurrency(Math.max(0, budget.remaining), budget.currency)}</p>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", budget.status === "exceeded" ? "bg-destructive" : "bg-primary")} style={{ width: `${progress}%` }} />
      </div>
      {budget.includesPending && (
        <p className="mt-2 text-[11px] text-muted-foreground">Incluye movimientos pendientes</p>
      )}
    </article>
  )
}
