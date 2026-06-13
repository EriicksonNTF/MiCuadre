"use client"

import { useMemo, useState } from "react"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { useAccounts } from "@/hooks/use-data"
import { payDebt } from "@/hooks/use-planning"
import { formatCurrency, getCurrencySymbol } from "@/lib/data"
import { notify } from "@/lib/notifications"
import { MovementReceipt } from "@/components/receipts/movement-receipt"
import { ConfirmPaymentSheet } from "@/components/credit-cards/pay-card/confirm-payment-sheet"
import type { DebtWithProgress } from "@/types/planning"

type PaymentReceipt = {
  amount: number
  previousDebtBalance: number
  newDebtBalance: number
  sourceName: string
  previousSourceBalance: number
  newSourceBalance: number
  date: string
  notes: string
}

export function PayDebtSheet({
  open,
  onOpenChange,
  debt,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  debt: DebtWithProgress | null
}) {
  const { data: accounts = [] } = useAccounts()
  const sourceAccounts = useMemo(() => accounts.filter((acc) => acc.type === "cash" || acc.type === "debit"), [accounts])

  const [sourceAccountId, setSourceAccountId] = useState("")
  const [mode, setMode] = useState<"installment" | "custom">("installment")
  const [customAmount, setCustomAmount] = useState("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null)

  if (!debt) return null

  const selectedAccount = sourceAccounts.find((acc) => acc.id === sourceAccountId) || null
  const suggestedInstallment = Number(debt.fixed_payment_amount || 0) > 0
    ? Math.min(Number(debt.fixed_payment_amount || 0), Number(debt.current_balance || 0))
    : Math.min(Number(debt.current_balance || 0), Number(debt.original_amount || 0))

  const amount = mode === "installment" ? suggestedInstallment : Number(customAmount || 0)
  const nextDebtBalance = Math.max(0, Number(debt.current_balance || 0) - Number(amount || 0))

  const reset = () => {
    setSourceAccountId("")
    setMode("installment")
    setCustomAmount("")
    setNotes("")
    setLoading(false)
  }

  const onConfirm = async () => {
    if (!sourceAccountId) {
      notify({ title: "Cuenta requerida", message: "Selecciona la cuenta de origen." })
      throw new Error("missing_source")
    }
    if (!amount || amount <= 0) {
      notify({ title: "Monto inválido", message: "Ingresa un monto mayor que cero." })
      throw new Error("invalid_amount")
    }

    setLoading(true)
    try {
      const result = await payDebt({
        debt_id: debt.id,
        source_account_id: sourceAccountId,
        amount,
        notes: notes.trim() || null,
      })

      setReceipt({
        amount: result.amount,
        previousDebtBalance: result.previousDebtBalance,
        newDebtBalance: result.newDebtBalance,
        sourceName: result.sourceAccount.name,
        previousSourceBalance: result.previousSourceBalance,
        newSourceBalance: result.newSourceBalance,
        date: result.paymentDate,
        notes: result.notes,
      })
      onOpenChange(false)
      notify({ title: "Pago registrado", message: "La cuota fue aplicada correctamente." })
      reset()
    } catch (error: any) {
      notify({ title: "No se pudo registrar el pago", message: error?.message || "Inténtalo nuevamente." })
      throw error
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
        <DrawerContent className="mx-auto max-w-md rounded-t-2xl border-border bg-card px-4 pb-6 shadow-2xl ring-1 ring-border">
          <DrawerHeader className="px-0">
            <DrawerTitle>Pagar deuda</DrawerTitle>
          </DrawerHeader>

          <div className="space-y-3">
            <article className="rounded-xl border border-border bg-muted/40 p-3 text-sm">
              <p className="font-semibold text-foreground">{debt.name}</p>
              <p className="text-xs text-muted-foreground">Pendiente actual: {formatCurrency(debt.current_balance, debt.currency)}</p>
            </article>

            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Cuenta de origen</span>
              <select className="h-11 w-full rounded-xl border border-border bg-background px-3" value={sourceAccountId} onChange={(e) => setSourceAccountId(e.target.value)}>
                <option value="">Selecciona una cuenta</option>
                {sourceAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>{acc.name} · {formatCurrency(acc.balance || 0, acc.currency)}</option>
                ))}
              </select>
            </label>

            <article className="rounded-xl border border-border bg-background p-3 text-sm">
              <p className="text-xs text-muted-foreground">Resumen</p>
              <div className="mt-2 space-y-1 text-sm">
              <p className="flex items-center justify-between"><span>Pendiente actual</span><span className="text-xl font-bold">{formatCurrency(debt.current_balance, debt.currency)}</span></p>
                <p className="flex items-center justify-between"><span>Cuota sugerida</span><span className="text-xl font-bold">{formatCurrency(suggestedInstallment, debt.currency)}</span></p>
                <p className="flex items-center justify-between"><span>Nuevo pendiente</span><span className="text-xl font-bold">{formatCurrency(nextDebtBalance, debt.currency)}</span></p>
                {selectedAccount && (
                  <p className="flex items-center justify-between text-xs text-muted-foreground"><span>Balance cuenta</span><span>{formatCurrency(selectedAccount.balance || 0, selectedAccount.currency)}</span></p>
                )}
              </div>
            </article>

            <div>
              <p className="mb-2 text-sm text-muted-foreground">Monto a pagar</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setMode("installment")} className={`h-10 rounded-xl text-sm font-bold ${mode === "installment" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  Cuota
                </button>
                <button type="button" onClick={() => setMode("custom")} className={`h-10 rounded-xl text-sm font-bold ${mode === "custom" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  Otro monto
                </button>
              </div>
              {mode === "custom" && (
                <input type="number" inputMode="decimal" className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3" value={customAmount} onChange={(e) => setCustomAmount(e.target.value)} />
              )}
            </div>

            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Nota</span>
              <textarea className="min-h-[82px] w-full rounded-xl border border-border bg-background px-3 py-2" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>

            <button type="button" onClick={() => setShowConfirm(true)} disabled={!sourceAccountId || !amount || amount <= 0} className="h-12 w-full rounded-2xl bg-primary text-sm font-bold text-primary-foreground disabled:bg-muted disabled:text-muted-foreground">
              Continuar
            </button>
          </div>
        </DrawerContent>
      </Drawer>

      {showConfirm && selectedAccount ? (
        <ConfirmPaymentSheet
          amount={amount || 0}
          taxAmount={0}
          totalDebit={amount || 0}
          currencySymbol={getCurrencySymbol(debt.currency)}
          sourceAccountName={selectedAccount.name}
          sourceAvailable={formatCurrency(Number(selectedAccount.balance || 0), selectedAccount.currency)}
          cardName={debt.name}
          warning={amount > Number(selectedAccount.balance || 0) ? "Tu balance disponible es insuficiente." : null}
          loading={loading}
          onClose={() => setShowConfirm(false)}
          onConfirm={onConfirm}
        />
      ) : null}

      <MovementReceipt
        open={!!receipt}
        title="Pago registrado"
        amount={formatCurrency(receipt?.amount || 0, debt.currency)}
        sections={[
          {
            title: "Deuda",
            lines: [
              { label: "Deuda", value: debt.name },
              { label: "Pendiente anterior", value: formatCurrency(receipt?.previousDebtBalance || 0, debt.currency) },
              { label: "Nuevo pendiente", value: formatCurrency(receipt?.newDebtBalance || 0, debt.currency) },
            ],
          },
          {
            title: "Cuenta origen",
            lines: [
              { label: "Cuenta", value: receipt?.sourceName || "-" },
              { label: "Balance anterior", value: formatCurrency(receipt?.previousSourceBalance || 0, debt.currency) },
              { label: "Balance nuevo", value: formatCurrency(receipt?.newSourceBalance || 0, debt.currency) },
            ],
          },
          {
            title: "Detalle",
            lines: [
              { label: "Fecha", value: receipt ? new Date(receipt.date).toLocaleString("es-DO") : "-" },
              { label: "Nota", value: receipt?.notes || "-" },
            ],
          },
        ]}
        primaryActionLabel="Ver deuda"
        secondaryActionLabel="Listo"
        onPrimaryAction={() => setReceipt(null)}
        onSecondaryAction={() => setReceipt(null)}
        onClose={() => setReceipt(null)}
      />
    </>
  )
}
