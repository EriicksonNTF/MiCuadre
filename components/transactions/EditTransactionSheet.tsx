"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { ArrowLeft, Calendar as CalendarIcon, ChevronDown, Pencil, Save } from "lucide-react"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { MoneyInput } from "@/components/ui/money-input"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { formatCurrency, getCurrencySymbol } from "@/lib/data"
import { notify } from "@/lib/notifications"
import { updateTransaction, useAccounts, useCategories } from "@/hooks/use-data"
import { createClient } from "@/lib/supabase/client"
import { EventBus } from "@/lib/event-bus"
import { ImpactPreview } from "@/components/transactions/ImpactPreview"
import { getLocalDateString } from "@/lib/data"
import type { Transaction } from "@/lib/types/database"

export type EditTransactionSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction: Transaction | null
}

const KIND_LABELS: Record<string, string> = {
  credit_payment: "Pago de tarjeta",
  credit_card_income: "Abono a tarjeta",
  transfer: "Transferencia",
  debt_payment: "Pago de deuda",
  commission: "Comisión",
}

type FormState = {
  amount: string
  description: string
  date: Date
  categoryId: string | null
  accountId: string
  currency: string
  notes: string
  movementKind: string
}

export function EditTransactionSheet({ open, onOpenChange, transaction }: EditTransactionSheetProps) {
  const { data: accounts = [] } = useAccounts()
  const { data: dbCategories = [] } = useCategories()

  const supabase = useMemo(() => createClient(), [])

  const kind = transaction?.metadata?.kind as string | undefined
  const isComplex = kind === "transfer" || kind === "credit_payment"
  const isCreditCardIncome = kind === "credit_card_income"
  const isDebtPayment = kind === "debt_payment"
  const isCommission = kind === "commission"

  const [form, setForm] = useState<FormState>({
    amount: "",
    description: "",
    date: new Date(),
    categoryId: null,
    accountId: "",
    currency: "DOP",
    notes: "",
    movementKind: "card_payment",
  })
  const [saving, setSaving] = useState(false)
  const [datePickerOpen, setDatePickerOpen] = useState(false)

  useEffect(() => {
    if (transaction) {
      setForm({
        amount: String(transaction.amount),
        description: transaction.description || "",
        date: new Date(transaction.date),
        categoryId: transaction.category_id,
        accountId: transaction.account_id,
        currency: transaction.currency,
        notes: transaction.notes || "",
        movementKind: (transaction.metadata?.movement_kind as string) || "card_payment",
      })
    }
  }, [transaction])

  const parsedAmount = useMemo(() => {
    const n = Number.parseFloat(form.amount)
    return isNaN(n) ? 0 : n
  }, [form.amount])

  const accountsForType = useMemo(() => {
    if (!transaction || isComplex) return accounts.filter((a) => a.id === transaction?.account_id)
    return accounts
  }, [accounts, isComplex, transaction])

  const categories = useMemo(() => {
    if (isCreditCardIncome) return dbCategories.filter((c) => c.type === "income" || c.type === "both")
    return dbCategories.filter((c) => c.type === "expense" || c.type === "both")
  }, [dbCategories, isCreditCardIncome])

  const handleChange = (field: keyof FormState, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    if (!transaction || saving) return
    const amount = Number.parseFloat(form.amount)
    if (!amount || amount <= 0) {
      notify({ title: "Validación", message: "El monto debe ser mayor a 0." })
      return
    }

    setSaving(true)
    try {
      if (isComplex) {
        await supabase.rpc("update_transaction_safe", {
          p_transaction_id: transaction.id,
          p_amount: amount,
          p_description: form.description || null,
          p_date: format(form.date, "yyyy-MM-dd"),
        })
      } else {
        await updateTransaction(transaction.id, {
          account_id: form.accountId,
          type: transaction.type,
          amount,
          description: form.description || null,
          date: format(form.date, "yyyy-MM-dd"),
          category_id: form.categoryId || null,
          notes: form.notes || null,
          currency: form.currency as "DOP" | "USD",
          amount_base: amount,
          exchange_rate: 1,
          is_recurring: transaction.is_recurring,
        })
      }

      notify({ title: "Transacción actualizada", message: "Los cambios se guardaron correctamente." })
      EventBus.emit({ type: "transaction_updated" })
      onOpenChange(false)
    } catch (e: any) {
      notify({ title: "Error", message: e?.message || "No se pudo actualizar la transacción." })
    } finally {
      setSaving(false)
    }
  }

  const typeLabel = transaction ? (kind ? KIND_LABELS[kind] || (transaction.type === "income" ? "Ingreso" : "Gasto") : transaction.type === "income" ? "Ingreso" : "Gasto") : ""

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90dvh]">
          <DrawerHeader className="relative border-b border-border px-4 pb-3 pt-5">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="-ml-1 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/60"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <DrawerTitle className="text-left text-base font-bold">Editar transacción</DrawerTitle>
                {transaction && <p className="mt-0.5 text-xs text-muted-foreground">{typeLabel}</p>}
              </div>
            </div>
          </DrawerHeader>

          {transaction && isCommission && (
            <div className="space-y-4 p-5">
              <div className="rounded-xl bg-amber-100/30 dark:bg-amber-900/30 p-4 text-center">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                  Las comisiones no se editan individualmente. Se recalculan automáticamente al editar la transacción
                  original.
                </p>
              </div>
              <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>
                Cerrar
              </Button>
            </div>
          )}

          {transaction && !isCommission && (
            <div className="overflow-y-auto px-5 pb-8 pt-4">
              <div className="space-y-5">
                {/* Amount — always visible */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Monto
                  </label>
                  <MoneyInput
                    value={form.amount}
                    onValueChange={(v) => handleChange("amount", v)}
                    placeholder="0.00"
                    className="text-[clamp(2.75rem,15vw,4.5rem)]"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Descripción
                  </label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) => handleChange("description", e.target.value)}
                    placeholder="¿Para qué fue este movimiento?"
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base outline-none placeholder:text-muted-foreground/50 focus:border-primary/40"
                  />
                </div>

                {/* Date */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Fecha
                  </label>
                  <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-left text-base outline-none focus:border-primary/40"
                      >
                        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                        <span>{format(form.date, "d MMM yyyy", { locale: es })}</span>
                        <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={form.date}
                        onSelect={(d) => {
                          if (d) {
                            handleChange("date", d)
                            setDatePickerOpen(false)
                          }
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Account selector (hidden for complex types) */}
                {!isComplex && (
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Cuenta
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {accountsForType.map((acc) => (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => handleChange("accountId", acc.id)}
                          className={cn(
                            "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                            form.accountId === acc.id
                              ? "bg-foreground text-background"
                              : "bg-muted text-muted-foreground hover:bg-muted/80",
                          )}
                        >
                          {acc.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Category selector (for regular + credit card income) */}
                {!isComplex && (
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Categoría
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {categories.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => handleChange("categoryId", cat.id)}
                          className={cn(
                            "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                            form.categoryId === cat.id
                              ? "bg-foreground text-background"
                              : "bg-muted text-muted-foreground hover:bg-muted/80",
                          )}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Notas
                  </label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => handleChange("notes", e.target.value)}
                    placeholder="Notas adicionales (opcional)"
                    rows={2}
                    className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-base outline-none placeholder:text-muted-foreground/50 focus:border-primary/40"
                  />
                </div>

                {/* Impact Preview */}
                <ImpactPreview
                  transactionId={transaction.id}
                  amount={parsedAmount}
                  currency={form.currency}
                  description={form.description}
                  date={format(form.date, "yyyy-MM-dd")}
                  categoryId={form.categoryId}
                  notes={form.notes}
                />

                {/* Save button */}
                <Button
                  onClick={handleSave}
                  disabled={saving || !form.amount || Number.parseFloat(form.amount) <= 0}
                  className="w-full gap-2"
                >
                  {saving ? (
                    "Guardando..."
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Guardar cambios
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </>
  )
}
