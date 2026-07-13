"use client"

import { useMemo, useState, useRef, useEffect } from "react"
import { CalendarDays } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from "@/components/ui/drawer"
import { MoneyInput } from "@/components/ui/money-input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DateWheelPicker } from "@/components/ui/date-wheel-picker"
import { SwipeConfirmButton } from "@/components/ui/swipe-confirm-button"
import { useAccounts } from "@/hooks/use-data"
import { payDebt } from "@/hooks/use-planning"
import { formatCurrency } from "@/lib/data"
import { notify } from "@/lib/notifications"
import { MovementReceipt } from "@/components/receipts/movement-receipt"
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
  const [dateVar, setDateVar] = useState(new Date())
  const [loading, setLoading] = useState(false)
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null)
  const preventResetRef = useRef(false)

  useEffect(() => {
    if (open) document.documentElement.dataset.modalOpen = "true"
    else delete document.documentElement.dataset.modalOpen
    return () => { delete document.documentElement.dataset.modalOpen }
  }, [open])

  if (!debt) return null

  const selectedAccount = sourceAccounts.find((acc) => acc.id === sourceAccountId) || null
  const suggestedInstallment = Number(debt.fixed_payment_amount || 0) > 0
    ? Math.min(Number(debt.fixed_payment_amount || 0), Number(debt.current_balance || 0))
    : Math.min(Number(debt.current_balance || 0), Number(debt.original_amount || 0))

  const amount = mode === "installment" ? suggestedInstallment : Number(customAmount || 0)
  const nextDebtBalance = Math.max(0, Number(debt.current_balance || 0) - Number(amount || 0))
  const warning = selectedAccount && amount > Number(selectedAccount.balance || 0)
    ? "Tu balance disponible es insuficiente."
    : null
  const canPay = Boolean(selectedAccount) && amount > 0 && !warning

  const resetState = () => {
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
      notify({ title: "Pago registrado", message: "La cuota fue aplicada correctamente." })
      resetState()
    } catch (error: any) {
      notify({ title: "No se pudo registrar el pago", message: error?.message || "Inténtalo nuevamente." })
      throw error
    } finally {
      setLoading(false)
    }
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
            <DrawerTitle>Pagar deuda</DrawerTitle>
          </DrawerHeader>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-2" data-vaul-no-drag>
            <article className="rounded-xl border border-border bg-muted/40 p-3">
              <p className="text-sm font-semibold text-foreground">{debt.name}</p>
              <p className="text-xs text-muted-foreground">Pendiente: {formatCurrency(debt.current_balance, debt.currency)}</p>
            </article>

            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Cuenta de origen</span>
              <Select value={sourceAccountId} onValueChange={setSourceAccountId}>
                <SelectTrigger className="h-11 w-full">
                  <SelectValue placeholder="Selecciona una cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {sourceAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.name} · {formatCurrency(acc.balance || 0, acc.currency)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <article className="rounded-xl border border-border bg-background p-3 text-sm">
              <p className="text-xs text-muted-foreground">Resumen</p>
              <div className="mt-2 space-y-1">
                <p className="flex items-center justify-between"><span>Pendiente</span><span className="text-lg font-bold">{formatCurrency(debt.current_balance, debt.currency)}</span></p>
                <p className="flex items-center justify-between"><span>Cuota sugerida</span><span className="text-lg font-bold">{formatCurrency(suggestedInstallment, debt.currency)}</span></p>
                <p className="flex items-center justify-between"><span>Nuevo pendiente</span><span className="text-lg font-bold">{formatCurrency(nextDebtBalance, debt.currency)}</span></p>
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
                <MoneyInput value={customAmount} onValueChange={setCustomAmount} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3" />
              )}
            </div>

            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Nota</span>
              <textarea className="min-h-[82px] w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Fecha del pago</span>
              <DateWheelPicker value={dateVar} onChange={setDateVar}>
                <button type="button" className="h-11 w-full rounded-xl border border-border bg-background px-3 text-left text-sm text-foreground">
                  <CalendarDays className="mr-2 inline h-4 w-4 text-muted-foreground" />
                  {format(dateVar, "d MMM yyyy", { locale: es })}
                </button>
              </DateWheelPicker>
            </label>

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
              onConfirm={onConfirm}
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
        onPrimaryAction={() => { setReceipt(null); onOpenChange(false) }}
        onSecondaryAction={() => { setReceipt(null); resetState() }}
        onClose={() => { setReceipt(null); onOpenChange(false) }}
      />
    </>
  )
}
