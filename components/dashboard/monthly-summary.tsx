"use client"

import { ArrowDownLeft, ArrowUpRight } from "lucide-react"

export function MonthlySummary() {
  const income = 85000
  const expenses = 42500

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: "DOP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const savingsPercent = Math.round((1 - expenses / income) * 100)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">Este mes</p>
        <p className="text-xs text-muted-foreground">{savingsPercent}% ahorrado</p>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 rounded-2xl bg-card p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10">
            <ArrowDownLeft className="h-4 w-4 text-accent" />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Ingresos</p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {formatCurrency(income)}
          </p>
        </div>

        <div className="flex-1 rounded-2xl bg-card p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive/10">
            <ArrowUpRight className="h-4 w-4 text-destructive" />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Gastos</p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {formatCurrency(expenses)}
          </p>
        </div>
      </div>
    </div>
  )
}
