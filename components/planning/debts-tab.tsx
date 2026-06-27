"use client"

import { useMemo, useState } from "react"
import { Plus } from "lucide-react"
import { DebtCard } from "@/components/planning/debt-card"
import { DebtFormSheet } from "@/components/planning/debt-form-sheet"
import { PayDebtSheet } from "@/components/planning/pay-debt-sheet"
import { QuickPayCardSheet } from "@/components/planning/quick-pay-card-sheet"
import { useDebtsSummary } from "@/hooks/use-planning"
import { useEntitlements } from "@/hooks/use-entitlements"
import { useAccounts, useFinancialSubscriptions } from "@/hooks/use-data"
import { notify } from "@/lib/notifications"
import { formatCurrency } from "@/lib/data"
import type { DebtWithProgress } from "@/types/planning"

type CreditDebtCard = {
  id: string
  name: string
  dueDate: string | null
  minimumPayment: number
  debtDop: number
  debtUsd: number
}

function formatDueDate(value: string | null) {
  if (!value) return "No definido"
  return new Date(`${value}T12:00:00`).toLocaleDateString("es-DO", { day: "numeric", month: "long" })
}

export function DebtsTab() {
  const { debts, summary, isLoading } = useDebtsSummary()
  const { limits } = useEntitlements()
  const { data: accounts = [] } = useAccounts()
  const { data: subscriptions = [] } = useFinancialSubscriptions()
  const [createOpen, setCreateOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [selectedDebt, setSelectedDebt] = useState<DebtWithProgress | null>(null)
  const [cardQuickOpen, setCardQuickOpen] = useState(false)
  const [selectedCardQuick, setSelectedCardQuick] = useState<CreditDebtCard | null>(null)

  const creditDebts = useMemo<CreditDebtCard[]>(() => {
    return accounts
      .filter((account) => account.type === "credit")
      .map((account) => ({
        id: account.id,
        name: account.name,
        dueDate: account.statement_due_date || null,
        minimumPayment: Number(account.minimum_payment || 0),
        debtDop: Number(account.current_debt_dop || account.current_debt || 0),
        debtUsd: Number(account.current_debt_usd || 0),
      }))
      .filter((card) => card.debtDop > 0 || card.debtUsd > 0)
      .sort((a, b) => (a.dueDate || "9999-99-99").localeCompare(b.dueDate || "9999-99-99"))
  }, [accounts])

  const onCreate = () => {
    if (limits.max_active_debts !== "unlimited" && debts.length >= limits.max_active_debts) {
      notify({ title: "Limite alcanzado", message: "Tu plan actual permite hasta 2 deudas activas." })
      return
    }
    setCreateOpen(true)
  }

  const onPay = (debt: DebtWithProgress) => {
    setSelectedDebt(debt)
    setPayOpen(true)
  }

  const onQuickPayCard = (card: CreditDebtCard) => {
    setSelectedCardQuick(card)
    setCardQuickOpen(true)
  }

  return (
    <section className="space-y-4">
      <article className="rounded-2xl border border-border bg-card p-4 text-card-foreground">
        <p className="text-sm font-semibold">Deudas</p>
        <p className="mt-2 text-lg font-bold">Total pendiente {summary.totalPendingDopLabel}</p>
        {summary.totalPendingUsd > 0 ? <p className="text-sm font-bold">{summary.totalPendingUsdLabel}</p> : null}
        <p className="text-xs text-muted-foreground">Pagos este mes: {summary.paymentsThisMonthLabel}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Proximo pago: {summary.nextDebt ? `${summary.nextDebt.name} · ${summary.nextDebt.next_payment_date}` : "No definido"}
        </p>
      </article>

      <button type="button" onClick={onCreate} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground">
        <Plus className="h-4 w-4" />
        Agregar deuda
      </button>

      <article className="space-y-3 rounded-2xl border border-border bg-card p-4 text-card-foreground">
        <p className="text-sm font-semibold">Tarjetas de credito</p>
        {creditDebts.length === 0 ? (
          <p className="text-xs text-muted-foreground">No hay deuda de tarjetas pendiente.</p>
        ) : (
          creditDebts.map((card) => (
            <div key={card.id} className="rounded-xl border border-border bg-background p-3">
              <p className="text-sm font-semibold">{card.name}</p>
              {card.debtDop > 0 ? <p className="text-xs text-muted-foreground">Deuda actual: {formatCurrency(card.debtDop, "DOP")}</p> : null}
              {card.debtUsd > 0 ? <p className="text-xs text-muted-foreground">Deuda actual: {formatCurrency(card.debtUsd, "USD")}</p> : null}
              {card.minimumPayment > 0 ? <p className="text-xs text-muted-foreground">Pago minimo: {formatCurrency(card.minimumPayment, "DOP")}</p> : null}
              <p className="text-xs text-muted-foreground">Pagar antes del: {formatDueDate(card.dueDate)}</p>
              <button type="button" onClick={() => onQuickPayCard(card)} className="mt-2 inline-flex h-8 items-center justify-center rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground">
                Pagar tarjeta
              </button>
            </div>
          ))
        )}
      </article>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : debts.length === 0 ? (
        <article className="rounded-2xl border border-border bg-card p-5 text-center">
          <p className="text-sm font-semibold">No tienes deudas registradas</p>
          <p className="mt-1 text-xs text-muted-foreground">Agrega prestamos, cuotas o deudas personales para darles seguimiento.</p>
          <button type="button" onClick={onCreate} className="mt-3 h-10 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground">Agregar deuda</button>
        </article>
      ) : (
        <article className="space-y-3">
          <p className="text-sm font-semibold text-foreground">Prestamos y deudas</p>
          {debts.map((debt) => <DebtCard key={debt.id} debt={debt} onPay={onPay} />)}
        </article>
      )}

      <article className="space-y-3 rounded-2xl border border-border bg-card p-4 text-card-foreground">
        <p className="text-sm font-semibold">Suscripciones</p>
        {subscriptions.length === 0 ? (
          <p className="text-xs text-muted-foreground">No tienes suscripciones activas.</p>
        ) : (
          subscriptions.map((sub) => (
            <div key={sub.id} className="rounded-xl border border-border bg-background p-3">
              <p className="text-sm font-semibold">{sub.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(Number(sub.amount || 0), (sub.currency as "DOP" | "USD") || "DOP")} ·{" "}
                {sub.next_payment_date
                  ? new Date(`${sub.next_payment_date}T12:00:00`).toLocaleDateString("es-DO", { day: "numeric", month: "long" })
                  : "Sin fecha"}
              </p>
              {sub.status ? <p className="text-xs text-muted-foreground capitalize">Estado: {sub.status}</p> : null}
            </div>
          ))
        )}
      </article>

      <DebtFormSheet open={createOpen} onOpenChange={setCreateOpen} />
      <PayDebtSheet open={payOpen} onOpenChange={setPayOpen} debt={selectedDebt} />
      <QuickPayCardSheet
        open={cardQuickOpen}
        onOpenChange={setCardQuickOpen}
        target={selectedCardQuick ? {
          id: selectedCardQuick.id,
          name: selectedCardQuick.name,
          currency: selectedCardQuick.debtUsd > 0 && selectedCardQuick.debtDop <= 0 ? "USD" : "DOP",
          currentDebt: selectedCardQuick.debtUsd > 0 && selectedCardQuick.debtDop <= 0 ? selectedCardQuick.debtUsd : selectedCardQuick.debtDop,
          statementBalance: selectedCardQuick.debtUsd > 0 && selectedCardQuick.debtDop <= 0 ? selectedCardQuick.debtUsd : selectedCardQuick.debtDop,
          minimumPayment: selectedCardQuick.minimumPayment,
          dueDate: selectedCardQuick.dueDate,
          suggestedAmount: selectedCardQuick.minimumPayment > 0 ? selectedCardQuick.minimumPayment : (selectedCardQuick.debtUsd > 0 && selectedCardQuick.debtDop <= 0 ? selectedCardQuick.debtUsd : selectedCardQuick.debtDop),
        } : null}
      />
    </section>
  )
}

