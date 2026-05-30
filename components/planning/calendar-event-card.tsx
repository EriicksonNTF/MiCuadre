"use client"

import Link from "next/link"
import type { FinancialCalendarEvent } from "@/lib/planning/calendar"
import { formatCurrency, getLocalDateString } from "@/lib/data"

function relativeLabel(dueDate: string) {
  const today = getLocalDateString()
  const now = new Date(`${today}T12:00:00`)
  const due = new Date(`${dueDate}T12:00:00`)
  const days = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (days === 0) return "Hoy"
  if (days === 1) return "Mañana"
  if (days > 1) return `En ${days} días`
  return `${Math.abs(days)} días atrás`
}

function typeLabel(event: FinancialCalendarEvent) {
  if (event.type === "credit_card_payment") return "Tarjeta"
  if (event.type === "financial_subscription") return "Suscripción"
  if (event.type === "debt_payment") return "Deuda"
  return "Recordatorio"
}

function actionHref(event: FinancialCalendarEvent) {
  if (event.type === "credit_card_payment") {
    const query = event.source_id ? `?card=${encodeURIComponent(event.source_id)}` : ""
    return `/pay${query}`
  }
  if (event.type === "financial_subscription") return "/settings/subscriptions"
  if (event.type === "debt_payment") return event.source_table === "debts" ? `/planning?tab=debts&debt=${encodeURIComponent(event.source_id || "")}` : "/planning?tab=debts"
  return "/planning?tab=calendar"
}

function urgencyText(event: FinancialCalendarEvent) {
  if (event.status === "overdue") return "Atrasado"
  if (event.status === "due_today") return "Pagar hoy"
  const today = getLocalDateString()
  const now = new Date(`${today}T12:00:00`)
  const due = new Date(`${event.due_date}T12:00:00`)
  const days = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (days <= 3) return "Vence pronto"
  return ""
}

export function CalendarEventCard({ event }: { event: FinancialCalendarEvent }) {
  const urgency = urgencyText(event)
  return (
    <article className="rounded-2xl border border-border bg-card p-4 text-card-foreground">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{relativeLabel(event.due_date)}</p>
          <p className="text-sm font-semibold">{event.title}</p>
          {event.detail && <p className="text-xs text-muted-foreground">{event.detail}</p>}
          {event.amount ? <p className="mt-1 text-sm font-bold">{formatCurrency(event.amount, event.currency || "DOP")}</p> : null}
          <p className="text-[11px] text-muted-foreground">{typeLabel(event)}</p>
        </div>
        {urgency ? (
          <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${event.status === "overdue" ? "bg-destructive/15 text-destructive" : "bg-muted text-foreground"}`}>
            {urgency}
          </span>
        ) : null}
      </div>
      <Link href={actionHref(event)} className="mt-3 inline-flex h-9 items-center justify-center rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground">
        {event.action_label || "Ver"}
      </Link>
    </article>
  )
}

