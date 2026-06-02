"use client"

import { useMemo, useState } from "react"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { ConfirmPaymentSheet } from "@/components/credit-cards/pay-card/confirm-payment-sheet"
import { formatCurrency } from "@/lib/data"
import { notify } from "@/lib/notifications"
import { payCreditCard, useAccounts, calculateCreditCardPaymentAmounts } from "@/hooks/use-data"

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

const LAST_RATE_KEY = "micuadre:last-card-payment-rate"

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
  const [exchangeRate, setExchangeRate] = useState("")
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const sourceAccounts = useMemo(
    () => accounts.filter((acc) => acc.type === "cash" || acc.type === "debit"),
    [accounts]
  )

  if (!target) return null

  const selectedSource = sourceAccounts.find((item) => item.id === sourceAccountId) || null
  const sourceCurrency = selectedSource?.currency as "DOP" | "USD" | undefined
  const conversionApplies = Boolean(sourceCurrency && sourceCurrency !== target.currency)
  const parsedRate = Number(exchangeRate)
  const amount = Math.max(0, Number(target.suggestedAmount || 0))

  const paymentCalculations = amount > 0 && sourceCurrency
    ? (() => {
        try {
          return calculateCreditCardPaymentAmounts({
            paymentAmount: amount,
            sourceCurrency,
            targetCurrency: target.currency,
            exchangeRate: conversionApplies ? parsedRate : undefined,
            applyDgiiTax: true,
          })
        } catch {
          return null
        }
      })()
    : null

  const sourceDebitAmount = paymentCalculations?.sourceAmount || amount
  const dgiiAmount = paymentCalculations?.dgiiTaxAmount || 0
  const totalDebit = paymentCalculations?.totalDebit || sourceDebitAmount

  const warning = !selectedSource
    ? "Selecciona una cuenta de origen."
    : totalDebit > Number(selectedSource.balance || 0)
      ? "Tu balance disponible es insuficiente."
      : amount > Number(target.currentDebt || 0)
        ? "El monto no puede ser mayor que la deuda de la tarjeta."
        : null

  const validRate = !conversionApplies || (Number.isFinite(parsedRate) && parsedRate > 0)

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
        <DrawerContent className="mx-auto max-w-md rounded-t-2xl border-border bg-card px-4 pb-6 shadow-2xl ring-1 ring-border">
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
              <select className="h-11 w-full rounded-xl border border-border bg-background px-3" value={sourceAccountId} onChange={(event) => { setSourceAccountId(event.target.value); setExchangeRate("") }}>
                <option value="">Selecciona una cuenta</option>
                {sourceAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>{acc.name} · {formatCurrency(Number(acc.balance || 0), acc.currency)} ({acc.currency})</option>
                ))}
              </select>
            </label>

            {conversionApplies && (
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Tasa de cambio ({sourceCurrency} a {target.currency})</span>
                <input value={exchangeRate} onChange={(e) => setExchangeRate(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="59.50" className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm" />
              </label>
            )}

            <article className="rounded-xl border border-border bg-background p-3 text-sm">
              <p className="flex items-center justify-between"><span>Monto a pagar</span><span className="font-semibold">{formatCurrency(amount, target.currency)}</span></p>
              {selectedSource ? <p className="mt-1 flex items-center justify-between text-xs text-muted-foreground"><span>Disponible en origen</span><span>{formatCurrency(Number(selectedSource.balance || 0), selectedSource.currency)}</span></p> : null}
              {selectedSource && conversionApplies ? <p className="mt-1 flex items-center justify-between text-xs"><span className="text-muted-foreground">Total a debitar (sin DGII)</span><span>{formatCurrency(sourceDebitAmount, sourceCurrency)}</span></p> : null}
              {dgiiAmount > 0 ? <p className="mt-1 flex items-center justify-between text-xs"><span className="text-muted-foreground">Impuesto DGII 0.15%</span><span className="text-amber-500">{formatCurrency(dgiiAmount, sourceCurrency)}</span></p> : null}
              <p className="mt-1 flex items-center justify-between text-sm font-semibold"><span>Total a debitar</span><span>{formatCurrency(totalDebit, sourceCurrency)}</span></p>
              <p className="mt-1 flex items-center justify-between text-xs text-muted-foreground"><span>Nuevo balance de tarjeta</span><span>{formatCurrency(Math.max(0, target.currentDebt - amount), target.currency)}</span></p>
            </article>

            <button type="button" disabled={Boolean(warning) || !validRate} onClick={() => setShowConfirm(true)} className="h-12 w-full rounded-2xl bg-primary text-sm font-bold text-primary-foreground disabled:bg-muted disabled:text-muted-foreground">Continuar</button>
          </div>
        </DrawerContent>
      </Drawer>

      {showConfirm && selectedSource ? (
        <ConfirmPaymentSheet
          amount={amount}
          taxAmount={dgiiAmount}
          totalDebit={totalDebit}
          currencySymbol={target.currency === "USD" ? "US$" : "RD$"}
          sourceCurrencySymbol={sourceCurrency === "USD" ? "US$" : "RD$"}
          sourceAccountName={selectedSource.name}
          sourceAvailable={formatCurrency(Number(selectedSource.balance || 0), selectedSource.currency)}
          cardName={target.name}
          warning={warning}
          loading={loading}
          conversionSummary={conversionApplies ? `Al pagar ${target.currency === "USD" ? "US$" : "RD$"}${amount.toFixed(2)} se debitaran ${sourceCurrency === "USD" ? "US$" : "RD$"}${sourceDebitAmount.toFixed(2)}` : undefined}
          onClose={() => setShowConfirm(false)}
          onConfirm={async () => {
            if (!selectedSource || !validRate) return
            setLoading(true)
            try {
              await payCreditCard({
                credit_account_id: target.id,
                source_account_id: selectedSource.id,
                amount,
                currency: target.currency,
                exchange_rate: conversionApplies ? parsedRate : undefined,
                payment_kind: "custom",
                notes: "Pago rápido desde planificación",
                apply_commission: true,
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
