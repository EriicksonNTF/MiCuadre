"use client"

import { Progress } from "@/components/ui/progress"
import { formatCurrency } from "@/lib/data"
import type { DebtWithProgress } from "@/types/planning"

const typeLabel: Record<string, string> = {
  loan: "Préstamo",
  person: "Persona",
  financing: "Financiamiento",
  other: "Otro",
}

export function DebtCard({ debt, onPay }: { debt: DebtWithProgress; onPay: (debt: DebtWithProgress) => void }) {
  return (
    <article className="rounded-2xl border border-border bg-card p-4 text-card-foreground">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{debt.name}</p>
          <p className="text-xs text-muted-foreground">{typeLabel[debt.debt_type] || "Deuda"}</p>
        </div>
        <button type="button" onClick={() => onPay(debt)} className="h-9 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground">
          Pagar cuota
        </button>
      </div>

      <p className="mt-3 text-lg font-bold">Pendiente {formatCurrency(debt.current_balance, debt.currency)}</p>
      <p className="text-xs text-muted-foreground">
        {debt.fixed_payment_amount ? `Cuota ${formatCurrency(debt.fixed_payment_amount, debt.currency)} ${debt.payment_frequency}` : "Sin cuota fija"}
      </p>

      <div className="mt-3 space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{Math.round(debt.paid_percentage)}% pagado</span>
          <span className="font-semibold text-foreground">{formatCurrency(debt.paid_amount, debt.currency)} abonado</span>
        </div>
        <Progress value={Math.min(100, Math.max(0, debt.paid_percentage))} className="h-2" />
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Próximo pago: {debt.next_payment_date ? new Date(`${debt.next_payment_date}T12:00:00`).toLocaleDateString("es-DO", { day: "numeric", month: "long" }) : "No definido"}
      </p>
    </article>
  )
}
