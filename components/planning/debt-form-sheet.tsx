"use client"

import { useEffect, useMemo, useState } from "react"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { MoneyInput } from "@/components/ui/money-input"
import { useAccounts } from "@/hooks/use-data"
import { createDebt, updateDebt } from "@/hooks/use-planning"
import { notify } from "@/lib/notifications"
import type { Debt, DebtWithProgress } from "@/types/planning"
import { DateWheelPicker } from "@/components/ui/date-wheel-picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarDays } from "lucide-react"

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

// Guards against malformed stored dates (e.g. a stray extra digit in the
// year) producing an Invalid Date, which crashes date-fns' format() with
// "RangeError: Invalid time value" anywhere this gets rendered.
function parseDebtDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const parsed = new Date(`${value}T12:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function DebtFormSheet({
  open,
  onOpenChange,
  debt,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  debt?: DebtWithProgress | null
}) {
  const isEditing = Boolean(debt)
  const { data: accounts = [] } = useAccounts()

  const [name, setName] = useState("")
  const [debtType, setDebtType] = useState<Debt["debt_type"]>("loan")
  const [originalAmount, setOriginalAmount] = useState("")
  const [currentBalance, setCurrentBalance] = useState("")
  const [currency, setCurrency] = useState<"DOP" | "USD">("DOP")
  const [linkedAccount, setLinkedAccount] = useState("")

  // The linked account is the fixed payment source used by "Pagar cuota" — it
  // must share the debt's currency, otherwise a payment would silently treat
  // 1 DOP as 1 USD (see pay-debt-sheet.tsx).
  const sourceAccounts = useMemo(
    () => accounts.filter((acc) => (acc.type === "cash" || acc.type === "debit") && acc.currency === currency),
    [accounts, currency]
  )
  const [fixedPayment, setFixedPayment] = useState("")
  const [frequency, setFrequency] = useState<Debt["payment_frequency"]>("monthly")
  const [paymentDay, setPaymentDay] = useState("")
  const [startDate, setStartDate] = useState<Date | null>(null)
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
    setStartDate(null)
    setInterestRate("")
    setNotes("")
    setFormError(null)
  }

  useEffect(() => {
    if (!open) return
    if (debt) {
      setName(debt.name)
      setDebtType(debt.debt_type)
      setOriginalAmount(String(debt.original_amount ?? ""))
      setCurrentBalance(String(debt.current_balance ?? ""))
      setCurrency(debt.currency)
      setLinkedAccount(debt.linked_account_id || "")
      setFixedPayment(debt.fixed_payment_amount ? String(debt.fixed_payment_amount) : "")
      setFrequency(debt.payment_frequency || "monthly")
      setPaymentDay(debt.payment_day ? String(debt.payment_day) : "")
      setStartDate(parseDebtDate(debt.start_date))
      setInterestRate(debt.interest_rate ? String(debt.interest_rate) : "")
      setNotes(debt.notes || "")
      setFormError(null)
    } else {
      reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, debt])

  const onSave = async () => {
    const parsedOriginal = Number(originalAmount)
    const parsedPending = Number(currentBalance)
    const parsedFixedPayment = fixedPayment ? Number(fixedPayment) : null
    const parsedPaymentDay = paymentDay ? Number(paymentDay) : null

    if (!name.trim()) {
      setFormError("El nombre es obligatorio.")
      notify({ title: "Validación", message: "El nombre es obligatorio." })
      return
    }
    if (!Number.isFinite(parsedOriginal) || parsedOriginal <= 0) {
      setFormError("El monto original debe ser mayor que cero.")
      notify({ title: "Validación", message: "El monto original debe ser mayor que cero." })
      return
    }
    if (!Number.isFinite(parsedPending) || parsedPending < 0) {
      setFormError("El monto pendiente debe ser cero o mayor.")
      notify({ title: "Validación", message: "El monto pendiente debe ser cero o mayor." })
      return
    }
    if (parsedPending > parsedOriginal) {
      setFormError("El monto pendiente no puede ser mayor que el monto original.")
      notify({ title: "Validación", message: "El monto pendiente no puede ser mayor que el monto original." })
      return
    }
    if (parsedPaymentDay !== null && (!Number.isInteger(parsedPaymentDay) || parsedPaymentDay < 1 || parsedPaymentDay > 31)) {
      setFormError("El día de pago debe estar entre 1 y 31.")
      notify({ title: "Validación", message: "El día de pago debe estar entre 1 y 31." })
      return
    }
    if (parsedFixedPayment !== null && (!Number.isFinite(parsedFixedPayment) || parsedFixedPayment <= 0)) {
      setFormError("La cuota fija debe ser mayor que cero.")
      notify({ title: "Validación", message: "La cuota fija debe ser mayor que cero." })
      return
    }

    setFormError(null)
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        debt_type: debtType,
        original_amount: parsedOriginal,
        current_balance: parsedPending,
        currency,
        linked_account_id: linkedAccount || null,
        fixed_payment_amount: parsedFixedPayment,
        payment_frequency: frequency,
        payment_day: parsedPaymentDay,
        start_date: startDate ? format(startDate, "yyyy-MM-dd") : null,
        interest_rate: interestRate ? Number(interestRate) : null,
        notes: notes.trim() || null,
      }

      if (isEditing && debt) {
        await updateDebt({ debt_id: debt.id, ...payload })
      } else {
        await createDebt(payload)
      }

      notify({ title: "Guardado correctamente.", message: isEditing ? "Deuda actualizada correctamente." : "Deuda guardada correctamente." })
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
          <DrawerTitle>{isEditing ? "Editar deuda" : "Nueva deuda"}</DrawerTitle>
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
              <Select value={debtType} onValueChange={(v) => setDebtType(v as Debt["debt_type"])}>
                <SelectTrigger className="h-12 w-full">
                  <SelectValue placeholder="Selecciona..." />
                </SelectTrigger>
                <SelectContent>
                  {debtTypes.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Monto original</span>
                <MoneyInput value={originalAmount} onValueChange={setOriginalAmount} className="h-12 w-full rounded-xl border border-border bg-background px-3" />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Monto pendiente</span>
                <MoneyInput value={currentBalance} onValueChange={setCurrentBalance} className="h-12 w-full rounded-xl border border-border bg-background px-3" />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Moneda</span>
                <Select
                  value={currency}
                  onValueChange={(v) => {
                    setCurrency(v as "DOP" | "USD")
                    setLinkedAccount("")
                  }}
                >
                  <SelectTrigger className="h-12 w-full">
                    <SelectValue placeholder="Selecciona..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DOP">DOP</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Cuenta de origen</span>
                <Select value={linkedAccount || "none"} onValueChange={(v) => setLinkedAccount(v === "none" ? "" : v)}>
                  <SelectTrigger className="h-12 w-full">
                    <SelectValue placeholder="Sin asignar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin asignar</SelectItem>
                    {sourceAccounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">
              Esta es la cuenta desde la que se descontará cada "Pagar cuota". Sin una cuenta asignada no podrás pagar la deuda.
            </p>

            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Cuota fija</span>
                <MoneyInput value={fixedPayment} onValueChange={setFixedPayment} className="h-12 w-full rounded-xl border border-border bg-background px-3" />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Frecuencia</span>
                <Select value={frequency} onValueChange={(v) => setFrequency(v as Debt["payment_frequency"])}>
                  <SelectTrigger className="h-12 w-full">
                    <SelectValue placeholder="Selecciona..." />
                  </SelectTrigger>
                  <SelectContent>
                    {frequencies.map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Día de pago</span>
                <input type="number" min={1} max={31} className="h-12 w-full rounded-xl border border-border bg-background px-3" value={paymentDay} onChange={(e) => setPaymentDay(e.target.value)} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Fecha de inicio</span>
                <DateWheelPicker value={startDate ?? new Date()} onChange={setStartDate}>
                    <button type="button" className="h-12 w-full rounded-xl border border-border bg-background px-3 text-left text-sm text-foreground flex items-center gap-2">
                      <CalendarDays className="size-4 text-muted-foreground shrink-0" />
                      {startDate ? format(startDate, "d MMM yyyy", { locale: es }) : "Seleccionar fecha"}
                    </button>
                  </DateWheelPicker>
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
                {saving ? "Guardando..." : isEditing ? "Guardar cambios" : "Guardar deuda"}
              </button>
            </div>
          </footer>
        </form>
      </DrawerContent>
    </Drawer>
  )
}

