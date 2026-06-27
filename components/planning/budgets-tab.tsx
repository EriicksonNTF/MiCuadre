"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { BudgetCard } from "@/components/planning/budget-card"
import { BudgetFormSheet } from "@/components/planning/budget-form-sheet"
import { usePlanningSummary } from "@/hooks/use-planning"
import { useEntitlements } from "@/hooks/use-entitlements"
import { notify } from "@/lib/notifications"
import type { BudgetWithUsage } from "@/types/planning"

export function BudgetsTab() {
  const { budgets, summary, isLoading } = usePlanningSummary()
  const { limits } = useEntitlements()
  const [open, setOpen] = useState(false)
  const [selectedBudget, setSelectedBudget] = useState<BudgetWithUsage | null>(null)

  const createPressed = () => {
    if (limits.max_budgets !== "unlimited" && budgets.length >= limits.max_budgets) {
      notify({ title: "Limite alcanzado", message: "Tu plan actual permite hasta 3 presupuestos." })
      return
    }
    setSelectedBudget(null)
    setOpen(true)
  }

  return (
    <section className="space-y-4">
      <article className="rounded-2xl border border-border bg-card p-4 text-card-foreground">
        <p className="text-sm font-semibold">Resumen mensual</p>
        <p className="mt-2 text-xl font-bold">{summary.budgetUsedLabel} usado</p>
        <p className="text-xs text-muted-foreground">{summary.totalSpentLabel} de {summary.totalBudgetLabel}</p>
      </article>

      <button type="button" onClick={createPressed} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground">
        <Plus className="h-4 w-4" />
        Crear presupuesto
      </button>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : budgets.length === 0 ? (
        <article className="rounded-2xl border border-border bg-card p-5 text-center">
          <p className="text-sm font-semibold">Aun no tienes presupuestos</p>
          <p className="mt-1 text-xs text-muted-foreground">Crea tu primer presupuesto para saber cuanto puedes gastar por categoria este mes.</p>
          <button type="button" onClick={createPressed} className="mt-3 h-10 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground">Crear presupuesto</button>
        </article>
      ) : (
        <div className="space-y-3">
          {budgets.map((budget) => (
            <BudgetCard
              key={budget.id}
              budget={budget}
              onEdit={() => {
                setSelectedBudget(budget)
                setOpen(true)
              }}
            />
          ))}
        </div>
      )}

      <BudgetFormSheet open={open} onOpenChange={setOpen} budget={selectedBudget} />
    </section>
  )
}
