"use client"

import { useMemo, useState } from "react"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { useAccounts } from "@/hooks/use-data"
import { createDebt } from "@/hooks/use-planning"
import { notify } from "@/lib/notifications"
import type { Debt } from "@/types/planning"

const debtTypes: Array<{ value: Debt["debt_type"]; label: string }> = [
  { value: "loan", label: "Préstamo" },
  { value: "person", label: "Persona" },
  { value: "financing", label: "Financiamiento" },
  { value: "other", label: "Otro" },
]

const frequencies: Array<{ value: Debt["payment_frequency"]; label: string }> = [
  { value: "monthly", label: "Mensual" },
  { value: "biweekly", label: "Quincenal" },
  { value: "weekly", label: "Semanal" },
]

export function DebtFormSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: accounts = [] } = useAccounts()
  const sourceAccounts = useMemo(() => accounts.filter((acc) => acc.type === "cash" || acc.type === "debit"), [accounts])

  const [name, setName] = useState("")
  const [debtType, setDebtType] = useState<Debt["debt_type"]>("loan")
  const [originalAmount, setOriginalAmount] = useState("")
  const [currentBalance, setCurrentBalance] = useState("")
  const [currency, setCurrency] = useState<"DOP" | "USD">("DOP")
  const [linkedAccount, setLinkedAccount] = useState("")
  const [fixedPayment, setFixedPayment] = useState("")
  const [frequency, setFrequency] = useState<Debt["payment_frequency"]>("monthly")
  const [paymentDay, setPaymentDay] = useState("")
  const [startDate, setStartDate] = useState("")
  const [interestRate, setInterestRate] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const reset = () => {
    setName("")
    setDebtType("loan")
    setOriginalAmount("")
    setCurrentBalance("")
    setCurrency("DOP")
    setLinkedAccount("")
    setFixedPayment("")
    setFrequency("monthly")
    setPaymentDay("")
    setStartDate("")
    setInterestRate("")
    setNotes("")
    setFormError(null)
  }

  const onSave = async () => {
    const parsedOriginal = Number(originalAmount)
    const parsedPending = Number(currentBalance)
    const parsedFixedPayment = fixedPayment ? Number(fixedPayment) : null
    const parsedPaymentDay = paymentDay ? Number(paymentDay) : null

    if (!name.trim()) {
      setFormError("El nombre es obligatorio.")
      return
    }
    if (!Number.isFinite(parsedOriginal) || parsedOriginal <= 0) {
      setFormError("El monto original debe ser mayor que cero.")
      return
    }
    if (!Number.isFinite(parsedPending) || parsedPending < 0) {
      setFormError("El monto pendiente debe ser cero o mayor.")
      return
    }
    if (parsedPending > parsedOriginal) {
      setFormError("El monto pendiente no puede ser mayor que el monto original.")
      return
    }
    if (parsedPaymentDay !== null && (!Number.isInteger(parsedPaymentDay) || parsedPaymentDay < 1 || parsedPaymentDay > 31)) {
      setFormError("El día de pago debe estar entre 1 y 31.")
      return
    }
    if (parsedFixedPayment !== null && (!Number.isFinite(parsedFixedPayment) || parsedFixedPayment <= 0)) {
      setFormError("La cuota fija debe ser mayor que cero.")
      return
    }

    setFormError(null)
    setSaving(true)
    try {
      await createDebt({
        name: name.trim(),
        debt_type: debtType,
        original_amount: parsedOriginal,
        current_balance: parsedPending,
        currency,
        linked_account_id: linkedAccount || null,
        fixed_payment_amount: parsedFixedPayment,
        payment_frequency: frequency,
        payment_day: parsedPaymentDay,
        start_date: startDate || null,
        interest_rate: interestRate ? Number(interestRate) : null,
        notes: notes.trim() || null,
      })

      notify({ title: "Guardado correctamente.", message: "Deuda guardada correctamente." })
      onOpenChange(false)
      reset()
    } catch (error: any) {
      const message = error?.message || "No pudimos guardar la información."
      setFormError(message)
      notify({ title: "No pudimos guardar la información", message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
      <DrawerContent className="mx-auto flex max-h-[90dvh] max-w-md flex-col rounded-t-[2rem] border-border bg-card p-0 shadow-2xl ring-1 ring-border">
        <DrawerHeader className="shrink-0 border-b border-border px-5 pb-4 pt-5">
          <DrawerTitle>Nueva deuda</DrawerTitle>
        </DrawerHeader>

        <form
          onSubmit={async (event) => {
            event.preventDefault()
            await onSave()
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-5 pt-4">
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Nombre</span>
              <input className="h-12 w-full rounded-xl border border-border bg-background px-3" value={name} onChange={(e) => setName(e.target.value)} />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Tipo</span>
              <select className="h-12 w-full rounded-xl border border-border bg-background px-3" value={debtType} onChange={(e) => setDebtType(e.target.value as Debt["debt_type"])}>
                {debtTypes.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Monto original</span>
                <input type="number" inputMode="decimal" className="h-12 w-full rounded-xl border border-border bg-background px-3" value={originalAmount} onChange={(e) => setOriginalAmount(e.target.value)} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Monto pendiente</span>
                <input type="number" inputMode="decimal" className="h-12 w-full rounded-xl border border-border bg-background px-3" value={currentBalance} onChange={(e) => setCurrentBalance(e.target.value)} />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Moneda</span>
                <select className="h-12 w-full rounded-xl border border-border bg-background px-3" value={currency} onChange={(e) => setCurrency(e.target.value as "DOP" | "USD")}> 
                  <option value="DOP">DOP</option>
                  <option value="USD">USD</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Cuenta asociada</span>
                <select className="h-12 w-full rounded-xl border border-border bg-background px-3" value={linkedAccount} onChange={(e) => setLinkedAccount(e.target.value)}>
                  <option value="">Opcional</option>
                  {sourceAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Cuota fija</span>
                <input type="number" inputMode="decimal" className="h-12 w-full rounded-xl border border-border bg-background px-3" value={fixedPayment} onChange={(e) => setFixedPayment(e.target.value)} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Frecuencia</span>
                <select className="h-12 w-full rounded-xl border border-border bg-background px-3" value={frequency} onChange={(e) => setFrequency(e.target.value as Debt["payment_frequency"])}>
                  {frequencies.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Día de pago</span>
                <input type="number" min={1} max={31} className="h-12 w-full rounded-xl border border-border bg-background px-3" value={paymentDay} onChange={(e) => setPaymentDay(e.target.value)} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Fecha de inicio</span>
                <input type="date" className="h-12 w-full rounded-xl border border-border bg-background px-3" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </label>
            </div>

            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Interés opcional (%)</span>
              <input type="number" inputMode="decimal" className="h-12 w-full rounded-xl border border-border bg-background px-3" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Nota</span>
              <textarea className="min-h-[84px] w-full rounded-xl border border-border bg-background px-3 py-2" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>

            {formError ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {formError}
              </p>
            ) : null}
          </div>

          <footer className="shrink-0 border-t border-border bg-card px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="h-12 rounded-xl bg-muted text-sm font-bold text-foreground"
              >
                Cancelar
              </button>
              <button type="submit" disabled={saving} className="h-12 rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-60">
                {saving ? "Guardando..." : "Guardar deuda"}
              </button>
            </div>
          </footer>
        </form>
      </DrawerContent>
    </Drawer>
  )
}

