"use client"

import { useMemo, useState } from "react"
import { MobileSheetLayout } from "@/components/ui/mobile-sheet-layout"

type CustomAmountSheetProps = {
  currencySymbol: "RD$" | "US$"
  maxAmount: number
  onClose: () => void
  onConfirm: (amount: number) => void
}

export function CustomAmountSheet({ currencySymbol, maxAmount, onClose, onConfirm }: CustomAmountSheetProps) {
  const [rawAmount, setRawAmount] = useState("")
  const amount = Number(rawAmount || 0)
  const error = useMemo(() => {
    if (!rawAmount) return null
    if (Number.isNaN(amount)) return "Ingresa un monto valido."
    if (amount <= 0) return "El monto debe ser mayor que cero."
    return null
  }, [amount, rawAmount])
  const canSubmit = rawAmount.length > 0 && !error

  return (
    <MobileSheetLayout
      title="Otro monto"
      onClose={onClose}
      footer={<button type="button" disabled={!canSubmit} onClick={() => onConfirm(amount)} className="h-14 w-full rounded-full bg-primary text-base font-bold text-primary-foreground disabled:bg-muted disabled:text-muted-foreground">Listo</button>}
    >
      <div className="space-y-3">
        <label className="block rounded-[24px] bg-muted px-5 py-4">
          <span className="text-sm text-muted-foreground">Monto a transferir</span>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-2xl font-bold text-foreground">{currencySymbol}</span>
            <input value={rawAmount} onChange={(event) => setRawAmount(event.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="0.00" autoFocus className="min-w-0 flex-1 bg-transparent text-3xl font-bold text-foreground outline-none placeholder:text-muted-foreground" />
          </div>
        </label>
        <p className="text-sm text-muted-foreground">Ingresa un monto entre {currencySymbol}1.00 y {currencySymbol}{maxAmount.toFixed(2)}</p>
        {error ? <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">{error}</p> : null}
      </div>
    </MobileSheetLayout>
  )
}
