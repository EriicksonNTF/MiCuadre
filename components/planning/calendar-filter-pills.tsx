"use client"

import type { CalendarEventType } from "@/lib/planning/calendar"

export type CalendarFilter = "all" | CalendarEventType

const options: Array<{ id: CalendarFilter; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "credit_card_payment", label: "Tarjetas" },
  { id: "financial_subscription", label: "Suscripciones" },
  { id: "debt_payment", label: "Deudas" },
]

export function CalendarFilterPills({
  value,
  onChange,
}: {
  value: CalendarFilter
  onChange: (value: CalendarFilter) => void
}) {
  return (
    <div className="grid grid-cols-4 gap-2 rounded-2xl border border-border bg-card p-1">
      {options.map((opt) => (
        <button type="button"
          key={opt.id}
          onClick={() => onChange(opt.id)}
          className={`h-9 rounded-xl text-[0.6875rem] font-bold ${value === opt.id ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

