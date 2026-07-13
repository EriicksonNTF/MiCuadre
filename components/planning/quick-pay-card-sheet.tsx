"use client"

import { useMemo, useState, useRef, useEffect } from "react"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from "@/components/ui/drawer"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SwipeConfirmButton } from "@/components/ui/swipe-confirm-button"
import { formatCurrency, formatAmount, getCurrencySymbol } from "@/lib/data"
import { notify } from "@/lib/notifications"
import { payCreditCard, useAccounts, calculateCreditCardPaymentAmounts } from "@/hooks/use-data"
import { MovementReceipt } from "@/components/receipts/movement-receipt"

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
  const [exchangeRate, setExchangeRate] = useState("")
  const [loading, setLoading] = useState(false)
  const [receipt, setReceipt] = useState<{
    amount: number
    currency: "DOP" | "USD"
    sourceName: string
    sourceLast4: string
    cardName: string
    cardLast4: string
    date: string
    dgiiAmount: number
  } | null>(null)
  const preventResetRef = useRef(false)

  useEffect(() => {
    if (open) document.documentElement.dataset.modalOpen = "true"
    else delete document.documentElement.dataset.modalOpen
    return () => { delete document.documentElement.dataset.modalOpen }
  }, [open])

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
    ? null
    : totalDebit > Number(selectedSource.balance || 0)
      ? "Tu balance disponible es insuficiente."
      : null

  const canPay = Boolean(selectedSource) && !warning && (!conversionApplies || (Number.isFinite(parsedRate) && parsedRate > 0))

  const handlePayment = async () => {
    if (!selectedSource || !canPay) return
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
      setReceipt({
        amount,
        currency: target.currency,
        sourceName: selectedSource.name,
        sourceLast4: selectedSource.account_number?.slice(-4) || "",
        cardName: target.name,
        cardLast4: target.id.slice(-4),
        date: new Date().toISOString(),
        dgiiAmount,
      })
    } catch (error: any) {
      notify({ title: "No se pudo pagar", message: error?.message || "Inténtalo nuevamente." })
      throw error
    } finally {
      setLoading(false)
    }
  }

  const resetState = () => {
    setSourceAccountId("")
    setExchangeRate("")
    setReceipt(null)
  }

  return (
    <>
      <Drawer open={open} onOpenChange={(newOpen) => {
        if (newOpen) resetState()
        if (!newOpen && !preventResetRef.current) resetState()
        preventResetRef.current = false
        onOpenChange(newOpen)
      }} direction="bottom">
        <DrawerContent className="mx-auto max-w-md flex flex-col rounded-t-2xl border-border bg-card shadow-2xl ring-1 ring-border" style={{ maxHeight: '90dvh' }}>
          <DrawerHeader className="shrink-0 px-4">
            <DrawerTitle>Pago rápido</DrawerTitle>
          </DrawerHeader>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-2" data-vaul-no-drag>
            <article className="rounded-xl border border-border bg-muted/40 p-3">
              <p className="text-sm font-semibold text-foreground">{target.name}</p>
              <p className="text-xs text-muted-foreground">Deuda actual: {formatCurrency(target.currentDebt, target.currency)}</p>
              <p className="text-xs text-muted-foreground">Balance al corte: {formatCurrency(target.statementBalance, target.currency)}</p>
              <p className="text-xs text-muted-foreground">Pago mínimo: {formatCurrency(target.minimumPayment, target.currency)}</p>
              <p className="text-xs text-muted-foreground">Pagar antes del: {target.dueDate || "No definido"}</p>
            </article>

            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Cuenta de origen</span>
              <Select value={sourceAccountId} onValueChange={(v) => { setSourceAccountId(v); setExchangeRate("") }}>
                <SelectTrigger className="h-11 w-full">
                  <SelectValue placeholder="Selecciona una cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {sourceAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.name} · {formatCurrency(Number(acc.balance || 0), acc.currency)} ({acc.currency})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            {conversionApplies && (
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Tasa de cambio ({sourceCurrency} a {target.currency})</span>
                <input
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value.replace(/[^0-9.]/g, ""))}
                  inputMode="decimal"
                  placeholder="59.50"
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
                />
              </label>
            )}

            {selectedSource && (
              <article className="rounded-xl border border-border bg-background p-3 text-sm">
                <p className="flex items-center justify-between">
                  <span>Monto a pagar</span>
                  <span className="text-lg font-bold">{formatCurrency(amount, target.currency)}</span>
                </p>
                <p className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Disponible en origen</span>
                  <span>{formatCurrency(Number(selectedSource.balance || 0), selectedSource.currency)}</span>
                </p>
                {conversionApplies && (
                  <p className="mt-1 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Total a debitar (sin DGII)</span>
                    <span>{formatCurrency(sourceDebitAmount, sourceCurrency)}</span>
                  </p>
                )}
                {dgiiAmount > 0 && (
                  <p className="mt-1 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Impuesto DGII 0.20%</span>
                    <span className="text-amber-500">{formatCurrency(dgiiAmount, sourceCurrency)}</span>
                  </p>
                )}
                <p className="mt-1 flex items-center justify-between text-lg font-bold">
                  <span>Total a debitar</span>
                  <span>{formatCurrency(totalDebit, sourceCurrency)}</span>
                </p>
                <p className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Nuevo balance de tarjeta</span>
                  <span>{formatCurrency(Math.max(0, target.currentDebt - amount), target.currency)}</span>
                </p>
              </article>
            )}

            {warning && (
              <div className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
                {warning}
              </div>
            )}
          </div>

          <DrawerFooter>
            <SwipeConfirmButton
              label="Desliza para pagar"
              loading={loading}
              disabled={!canPay}
              onConfirm={handlePayment}
            />
            <button
              type="button"
              onClick={() => { preventResetRef.current = true; onOpenChange(false) }}
              className="h-11 w-full rounded-xl text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              Cancelar pago
            </button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <MovementReceipt
        open={receipt !== null}
        title="Pago exitoso"
        amount={formatCurrency(receipt?.amount ?? 0, receipt?.currency ?? "DOP")}
        sections={[
          {
            title: "Detalle del pago",
            lines: [
              { label: "Tipo", value: "Pago de tarjeta de crédito" },
              { label: "Origen", value: receipt ? `${receipt.sourceName} ·-${receipt.sourceLast4}` : "" },
              { label: "Destino", value: receipt ? `${receipt.cardName} ·-${receipt.cardLast4}` : "" },
              { label: "Fecha y hora", value: receipt ? new Date(receipt.date).toLocaleString("es-DO") : "" },
              { label: "Impuesto DGII", value: receipt ? formatCurrency(receipt.dgiiAmount, receipt.currency) : "" },
              { label: "No. Transacción", value: Math.random().toString(36).slice(2, 14).toUpperCase() },
            ],
          },
        ]}
        primaryActionLabel="Cerrar"
        secondaryActionLabel="Nuevo pago"
        onPrimaryAction={() => { setReceipt(null); onOpenChange(false) }}
        onSecondaryAction={() => { setReceipt(null); resetState() }}
        onClose={() => { setReceipt(null); onOpenChange(false) }}
      />
    </>
  )
}
