"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { formatCurrency, getLocalDateString } from "@/lib/data"
import type { FinancialCalendarEvent } from "@/lib/planning/calendar"

function daysFromToday(dateStr: string) {
  const now = new Date(`${getLocalDateString()}T12:00:00`)
  const target = new Date(`${dateStr}T12:00:00`)
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function formatDueLabel(event: FinancialCalendarEvent) {
  const dueDate = new Date(`${event.due_date}T12:00:00`)
  const dayMonth = dueDate.toLocaleDateString("es-DO", { day: "2-digit", month: "short" })

  if (event.type === "credit_card_payment") return `Pagar antes del ${dayMonth}`
  if (event.type === "financial_subscription") return `Cobro: ${dayMonth}`
  if (event.type === "debt_payment") return `Vence: ${dayMonth}`
  return dayMonth
}

function formatDetail(event: FinancialCalendarEvent) {
  const days = daysFromToday(event.due_date)
  if (days < 0) return "Atrasado generando intereses"
  if (event.type === "credit_card_payment") return event.detail || "Pago minimo pendiente"
  if (event.type === "financial_subscription") return "Suscripción próxima"
  if (event.type === "debt_payment") return event.detail || "Cuota pendiente"
  return ""
}

function urgencyPrefix(event: FinancialCalendarEvent) {
  const days = daysFromToday(event.due_date)

  if (days < 0) return "Atrasado"
  if (days === 0) return "Pagar hoy"
  if (days <= 3) return "Vence pronto"
  return ""
}

export function RotatingUpcomingPaymentsCard({
  events,
  intervalMs = 5000,
  onAction,
}: {
  events: FinancialCalendarEvent[]
  intervalMs?: number
  onAction?: (event: FinancialCalendarEvent) => void
}) {
  const [activeIndex, setActiveIndex] = useState(0)

  const sortedEvents = useMemo(() => {
    const filtered = events.filter((event) => {
      const days = daysFromToday(event.due_date)
      return days < 0 || days <= 5
    })
    return filtered.sort((a, b) => a.due_date.localeCompare(b.due_date))
  }, [events])

  // React 19: Use useEffect for prev/current comparison instead of render-phase setState
  useEffect(() => {
    if (sortedEvents.length !== prevEventsLen.current) {
      prevEventsLen.current = sortedEvents.length
      setActiveIndex(0)
    }
  }, [sortedEvents.length])

  const prevEventsLen = useRef(sortedEvents.length)

  useEffect(() => {
    if (sortedEvents.length <= 1) return
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % sortedEvents.length)
    }, intervalMs)

    return () => {
      window.clearInterval(timer)
    }
  }, [sortedEvents.length, intervalMs])

  if (!sortedEvents.length) {
    return (
      <article className="rounded-2xl border border-border bg-card p-4 text-card-foreground">
        <p className="text-sm font-semibold">Proximos pagos</p>
        <p className="mt-2 text-sm text-muted-foreground">No tienes pagos próximos</p>
        <Link href="/planning?tab=calendar" className="mt-3 inline-flex h-9 items-center justify-center rounded-xl bg-accent px-3 text-xs font-bold text-accent-foreground">
          Ver calendario
        </Link>
      </article>
    )
  }

  const active = sortedEvents[Math.min(activeIndex, sortedEvents.length - 1)]
  const urgency = urgencyPrefix(active)
  const isOverdue = daysFromToday(active.due_date) < 0

  return (
    <article className={`rounded-2xl border p-4 text-card-foreground transition-colors duration-300 ${isOverdue ? "border-destructive/60 bg-destructive/5" : "border-border bg-card"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {isOverdue ? (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">!</span>
          ) : null}
          <p className="text-sm font-semibold">Proximos pagos</p>
        </div>
        {urgency ? (
          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${isOverdue ? "bg-destructive text-destructive-foreground" : "bg-muted text-foreground"}`}>{urgency}</span>
        ) : null}
      </div>

      <div className={`mt-2 animate-in fade-in duration-300 ${isOverdue ? "text-destructive" : ""}`}>
        <p className="text-base font-bold">{active.title}</p>
        <p className="text-xs text-muted-foreground">{formatDueLabel(active)}</p>
        {active.amount ? (
          <p className={`mt-1 text-lg font-bold ${isOverdue ? "text-destructive" : ""}`}>{formatCurrency(active.amount, active.currency || "DOP")}</p>
        ) : null}
        <p className={`text-xs ${isOverdue ? "font-semibold text-destructive" : "text-muted-foreground"}`}>{formatDetail(active)}</p>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <button type="button" onClick={() => onAction?.(active)} className={`inline-flex h-9 items-center justify-center rounded-xl px-3 text-xs font-bold ${isOverdue ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"}`}>
          {isOverdue ? "Pagar ahora" : active.action_label || "Ver"}
        </button>
        <Link href="/planning?tab=calendar" className="inline-flex h-9 items-center justify-center rounded-xl bg-accent px-3 text-xs font-bold text-accent-foreground">
          Ver calendario
        </Link>
      </div>
    </article>
  )
}

