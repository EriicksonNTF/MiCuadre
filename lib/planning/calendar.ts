import { createClient } from "@/lib/supabase/client"
import { getLocalDateString } from "@/lib/data"

export type CalendarEventType =
  | "credit_card_payment"
  | "financial_subscription"
  | "debt_payment"
  | "manual_reminder"

export type FinancialCalendarEvent = {
  id: string
  user_id: string
  type: CalendarEventType
  title: string
  amount?: number | null
  currency?: "DOP" | "USD" | null
  due_date: string
  source_id?: string | null
  source_table?: string | null
  status: "upcoming" | "due_today" | "overdue" | "paid"
  action_label?: string
  detail?: string
}

function daysDiffFromToday(dateStr: string) {
  const now = new Date()
  const target = new Date(`${dateStr}T12:00:00`)
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const to = new Date(target.getFullYear(), target.getMonth(), target.getDate())
  return Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
}

function statusForDueDate(dateStr: string): FinancialCalendarEvent["status"] {
  const diff = daysDiffFromToday(dateStr)
  if (diff < 0) return "overdue"
  if (diff === 0) return "due_today"
  return "upcoming"
}

export async function getFinancialCalendarEvents(
  userId: string,
  options?: { fromDate?: string; toDate?: string }
): Promise<FinancialCalendarEvent[]> {
  const supabase = createClient()
  const fromDate = options?.fromDate || getLocalDateString()
  const toDate = options?.toDate

  const [{ data: accounts }, { data: subscriptions }, { data: debts }] = await Promise.all([
    supabase
      .from("accounts")
      .select("id,name,type,currency,statement_due_date,pending_amount,minimum_payment,current_debt,current_debt_dop,current_debt_usd,financed_balance_dop,financed_balance_usd")
      .eq("user_id", userId)
      .eq("is_active", true),
    supabase
      .from("subscriptions")
      .select("id,name,amount,currency,next_payment_date,status")
      .eq("user_id", userId)
      .eq("status", "active"),
    supabase
      .from("debts")
      .select("id,name,current_balance,currency,fixed_payment_amount,payment_day,is_active")
      .eq("user_id", userId)
      .eq("is_active", true),
  ])

  const events: FinancialCalendarEvent[] = []

  for (const acc of accounts || []) {
    if (acc.type === "credit" && acc.statement_due_date) {
      const pending = Number((acc as any).pending_amount || 0)
      const minimumPayment = Number((acc as any).minimum_payment || 0)
      const currentDebtDop = Number((acc as any).current_debt_dop || (acc as any).current_debt || 0)
      const currentDebtUsd = Number((acc as any).current_debt_usd || 0)
      const amount = pending > 0 ? pending : minimumPayment > 0 ? minimumPayment : currentDebtDop > 0 ? currentDebtDop : currentDebtUsd

      events.push({
        id: `cc_${acc.id}_${acc.statement_due_date}`,
        user_id: userId,
        type: "credit_card_payment",
        title: acc.name,
        amount,
        currency: currentDebtUsd > 0 && currentDebtDop <= 0 ? "USD" : "DOP",
        due_date: acc.statement_due_date,
        source_id: acc.id,
        source_table: "accounts",
        status: statusForDueDate(acc.statement_due_date),
        action_label: "Pagar tarjeta",
        detail: `Pagar antes del ${new Date(`${acc.statement_due_date}T12:00:00`).toLocaleDateString("es-DO", { day: "2-digit", month: "short" })}${minimumPayment > 0 ? ` · Pago minimo ${minimumPayment.toLocaleString("en-US")}` : ""}`,
      })
    }

    const financedDop = Number((acc as any).financed_balance_dop || 0)
    const financedUsd = Number((acc as any).financed_balance_usd || 0)
    if ((financedDop > 0 || financedUsd > 0) && acc.statement_due_date) {
      events.push({
        id: `debt_${acc.id}_${acc.statement_due_date}`,
        user_id: userId,
        type: "debt_payment",
        title: `Deuda ${acc.name}`,
        amount: financedDop > 0 ? financedDop : financedUsd,
        currency: financedDop > 0 ? "DOP" : "USD",
        due_date: acc.statement_due_date,
        source_id: acc.id,
        source_table: "accounts",
        status: statusForDueDate(acc.statement_due_date),
        action_label: "Pagar cuota",
        detail: `Pendiente: ${financedDop > 0 ? "RD$" : "US$"}${(financedDop > 0 ? financedDop : financedUsd).toLocaleString("en-US")}`,
      })
    }
  }

  for (const sub of subscriptions || []) {
    if (!sub.next_payment_date) continue
    events.push({
      id: `sub_${sub.id}_${sub.next_payment_date}`,
      user_id: userId,
      type: "financial_subscription",
      title: sub.name,
      amount: Number(sub.amount || 0),
      currency: (sub.currency as "DOP" | "USD") || "DOP",
      due_date: sub.next_payment_date,
      source_id: sub.id,
      source_table: "subscriptions",
      status: statusForDueDate(sub.next_payment_date),
      action_label: "Registrar pago",
      detail: "Suscripcion mensual",
    })
  }

  const now = new Date()
  for (const debt of debts || []) {
    if (!debt.payment_day) continue
    const safeDay = Math.min(Number(debt.payment_day), 31)
    const currentMonthDue = new Date(now.getFullYear(), now.getMonth(), safeDay)
    const due = currentMonthDue >= new Date(now.getFullYear(), now.getMonth(), now.getDate())
      ? currentMonthDue
      : new Date(now.getFullYear(), now.getMonth() + 1, safeDay)
    const dueDate = getLocalDateString(due)
    events.push({
      id: `debt_table_${debt.id}_${dueDate}`,
      user_id: userId,
      type: "debt_payment",
      title: debt.name,
      amount: Number(debt.fixed_payment_amount || 0) || Number(debt.current_balance || 0),
      currency: (debt.currency as "DOP" | "USD") || "DOP",
      due_date: dueDate,
      source_id: debt.id,
      source_table: "debts",
      status: statusForDueDate(dueDate),
      action_label: "Pagar cuota",
      detail: `Pendiente: ${debt.currency === "USD" ? "US$" : "RD$"}${Number(debt.current_balance || 0).toLocaleString("en-US")}`,
    })
  }

  return events
    .filter((event) => event.due_date >= fromDate && (!toDate || event.due_date <= toDate))
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
}
