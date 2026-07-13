"use client"

import { useMemo, useState } from "react"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { MoneyInput } from "@/components/ui/money-input"
import { formatAmount } from "@/lib/data"

type CustomAmountSheetProps = {
  currencySymbol: string
  maxAmount: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (amount: number) => void
}

export function CustomAmountSheet({ currencySymbol, maxAmount, open, onOpenChange, onConfirm }: CustomAmountSheetProps) {
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
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
      <DrawerContent className="mx-auto flex max-h-[90dvh] max-w-md flex-col rounded-t-[2rem] border-border bg-card p-0 shadow-2xl ring-1 ring-border">
        <DrawerHeader className="shrink-0 border-b border-border px-5 pb-4 pt-5">
          <DrawerTitle>Otro monto</DrawerTitle>
        </DrawerHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-5 pt-4">
          <label className="block rounded-[24px] bg-muted px-5 py-4">
            <span className="text-sm text-muted-foreground">Monto a transferir</span>
            <div className="mt-2 flex items-center gap-2 overflow-x-auto scrollbar-none">
              <span className="shrink-0 text-2xl font-bold text-foreground">{currencySymbol}</span>
              <MoneyInput value={rawAmount} onValueChange={setRawAmount} placeholder="0.00" autoFocus wrapperClassName="flex-1 min-w-0" className="w-full bg-transparent text-3xl font-bold text-foreground outline-none placeholder:text-muted-foreground" />
            </div>
          </label>
          <p className="text-sm text-muted-foreground">Ingresa un monto entre {currencySymbol}1.00 y {currencySymbol}{formatAmount(maxAmount)}</p>
          {error ? <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">{error}</p> : null}
        </div>

        <footer className="shrink-0 border-t border-border bg-card px-5 py-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
          <button type="button" disabled={!canSubmit} onClick={() => { onConfirm(amount); onOpenChange(false) }} className="h-14 w-full rounded-full bg-primary text-base font-bold text-primary-foreground disabled:bg-muted disabled:text-muted-foreground">
            Listo
          </button>
        </footer>
      </DrawerContent>
    </Drawer>
  )
}
