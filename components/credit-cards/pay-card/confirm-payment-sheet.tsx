"use client"

import { MobileSheetLayout } from "@/components/ui/mobile-sheet-layout"
import { SwipeConfirmButton } from "@/components/ui/swipe-confirm-button"

type ConfirmPaymentSheetProps = {
  amount: number
  taxAmount?: number
  totalDebit: number
  currencySymbol: "RD$" | "US$"
  sourceAccountName: string
  sourceAvailable: string
  cardName: string
  warning?: string | null
  loading?: boolean
  onClose: () => void
  onConfirm: () => Promise<void> | void
}

export function ConfirmPaymentSheet({ amount, taxAmount = 0, totalDebit, currencySymbol, sourceAccountName, sourceAvailable, cardName, warning, loading, onClose, onConfirm }: ConfirmPaymentSheetProps) {
  return (
    <MobileSheetLayout
      title="Confirma la informacion"
      onClose={onClose}
      footer={<SwipeConfirmButton label="Desliza para pagar" loading={loading} disabled={Boolean(warning)} onConfirm={onConfirm} />}
    >
      <div className="space-y-5">
        {warning ? <div className="rounded-[24px] bg-destructive/10 p-4 text-sm font-medium text-destructive">{warning}</div> : null}
        <section className="overflow-hidden rounded-[24px] border border-border bg-card">
          <div className="p-5 text-center">
            <p className="text-sm text-muted-foreground">Monto</p>
            <p className="mt-1 text-4xl font-extrabold text-foreground">{currencySymbol} {amount.toFixed(2)}</p>
          </div>
          <div className="border-t border-border px-5 py-4">
            <div className="flex items-center justify-between gap-4"><p className="text-base text-foreground">Impuesto DGII: 0.15%</p><p className="font-semibold text-foreground">{currencySymbol} {taxAmount.toFixed(2)}</p></div>
            <div className="mt-4 flex items-center justify-between gap-4"><p className="text-base font-semibold text-foreground">Total a debitar</p><p className="font-bold text-foreground">{currencySymbol} {totalDebit.toFixed(2)}</p></div>
          </div>
        </section>
        <section className="space-y-4">
          <div className="flex items-start justify-between gap-4 border-b border-border pb-4"><p className="text-base text-muted-foreground">Desde</p><div className="text-right"><p className="font-bold text-foreground">{sourceAccountName}</p><p className="text-sm text-muted-foreground">Disponible {sourceAvailable}</p></div></div>
          <div className="flex items-start justify-between gap-4"><p className="text-base text-muted-foreground">Destino</p><p className="text-right font-bold text-foreground">{cardName}</p></div>
        </section>
      </div>
    </MobileSheetLayout>
  )
}
