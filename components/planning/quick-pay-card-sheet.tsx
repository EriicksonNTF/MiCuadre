"use client"

import { useMemo, useState } from "react"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { ConfirmPaymentSheet } from "@/components/credit-cards/pay-card/confirm-payment-sheet"
import { formatCurrency } from "@/lib/data"
import { notify } from "@/lib/notifications"
import { payCreditCard, useAccounts } from "@/hooks/use-data"

type QuickCardTarget = {
  id: string
  name: string
  currency: "DOP" | "USD"
  currentDebt: number
  statementBalance: number
  minimumPayment: number
  dueDate: string | null
  suggestedAmount: number
}

export function QuickPayCardSheet({
  open,
  onOpenChange,
  target,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: QuickCardTarget | null
}) {
  const { data: accounts = [] } = useAccounts()
  const [sourceAccountId, setSourceAccountId] = useState("")
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const sourceAccounts = useMemo(
    () => accounts.filter((acc) => (acc.type === "cash" || acc.type === "debit") && acc.currency === target?.currency),
    [accounts, target?.currency]
  )

  if (!target) return null

  const selectedSource = sourceAccounts.find((item) => item.id === sourceAccountId) || null
  const amount = Math.max(0, Number(target.suggestedAmount || 0))
  const warning = !selectedSource
    ? "Selecciona una cuenta de origen."
    : amount > Number(selectedSource.balance || 0)
      ? "Tu balance disponible es insuficiente."
      : amount > Number(target.currentDebt || 0)
        ? "El monto no puede ser mayor que la deuda de la tarjeta."
        : null

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
        <DrawerContent className="mx-auto max-w-md rounded-t-3xl border-border bg-card px-4 pb-6">
          <DrawerHeader className="px-0">
            <DrawerTitle>Pago rápido</DrawerTitle>
          </DrawerHeader>

          <div className="space-y-3">
            <article className="rounded-xl border border-border bg-muted/40 p-3">
              <p className="text-sm font-semibold text-foreground">{target.name}</p>
              <p className="text-xs text-muted-foreground">Deuda actual: {formatCurrency(target.currentDebt, target.currency)}</p>
              <p className="text-xs text-muted-foreground">Balance al corte: {formatCurrency(target.statementBalance, target.currency)}</p>
              <p className="text-xs text-muted-foreground">Pago mínimo: {formatCurrency(target.minimumPayment, target.currency)}</p>
              <p className="text-xs text-muted-foreground">Pagar antes del: {target.dueDate || "No definido"}</p>
            </article>

            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Cuenta de origen</span>
              <select className="h-11 w-full rounded-xl border border-border bg-background px-3" value={sourceAccountId} onChange={(event) => setSourceAccountId(event.target.value)}>
                <option value="">Selecciona una cuenta</option>
                {sourceAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>{acc.name} · {formatCurrency(Number(acc.balance || 0), acc.currency)}</option>
                ))}
              </select>
            </label>

            <article className="rounded-xl border border-border bg-background p-3 text-sm">
              <p className="flex items-center justify-between"><span>Monto a pagar</span><span className="font-semibold">{formatCurrency(amount, target.currency)}</span></p>
              {selectedSource ? <p className="mt-1 flex items-center justify-between text-xs text-muted-foreground"><span>Disponible</span><span>{formatCurrency(Number(selectedSource.balance || 0), selectedSource.currency)}</span></p> : null}
              <p className="mt-1 flex items-center justify-between text-xs text-muted-foreground"><span>Nuevo balance de tarjeta</span><span>{formatCurrency(Math.max(0, target.currentDebt - amount), target.currency)}</span></p>
            </article>

            <button type="button" disabled={Boolean(warning)} onClick={() => setShowConfirm(true)} className="h-12 w-full rounded-2xl bg-primary text-sm font-bold text-primary-foreground disabled:bg-muted disabled:text-muted-foreground">Continuar</button>
          </div>
        </DrawerContent>
      </Drawer>

      {showConfirm && selectedSource ? (
        <ConfirmPaymentSheet
          amount={amount}
          taxAmount={0}
          totalDebit={amount}
          currencySymbol={target.currency === "USD" ? "US$" : "RD$"}
          sourceAccountName={selectedSource.name}
          sourceAvailable={formatCurrency(Number(selectedSource.balance || 0), selectedSource.currency)}
          cardName={target.name}
          warning={warning}
          loading={loading}
          onClose={() => setShowConfirm(false)}
          onConfirm={async () => {
            if (!selectedSource) return
            setLoading(true)
            try {
              await payCreditCard({
                credit_account_id: target.id,
                source_account_id: selectedSource.id,
                amount,
                currency: target.currency,
                payment_kind: "custom",
                notes: "Pago rápido desde planificación",
                apply_commission: false,
              })
              notify({ title: "Pago registrado", message: "Tu pago de tarjeta fue aplicado." })
              setShowConfirm(false)
              onOpenChange(false)
            } catch (error: any) {
              notify({ title: "No se pudo pagar", message: error?.message || "Inténtalo nuevamente." })
              throw error
            } finally {
              setLoading(false)
            }
          }}
        />
      ) : null}
    </>
  )
}
