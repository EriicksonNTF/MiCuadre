"use client"

import { MobileSheetLayout } from "@/components/ui/mobile-sheet-layout"
import { SwipeConfirmButton } from "@/components/ui/swipe-confirm-button"

type ConfirmPaymentSheetProps = {
  amount: number
  taxAmount?: number
  totalDebit: number
  currencySymbol: "RD$" | "US$"
  sourceCurrencySymbol?: "RD$" | "US$"
  sourceAccountName: string
  sourceAvailable: string
  cardName: string
  warning?: string | null
  loading?: boolean
  onClose: () => void
  onConfirm: () => Promise<void> | void
  conversionSummary?: string
}

export function ConfirmPaymentSheet({ amount, taxAmount = 0, totalDebit, currencySymbol, sourceCurrencySymbol, sourceAccountName, sourceAvailable, cardName, warning, loading, onClose, onConfirm, conversionSummary }: ConfirmPaymentSheetProps) {
  const sym = sourceCurrencySymbol || currencySymbol
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
            <p className="text-sm text-muted-foreground">Monto a acreditar</p>
            <p className="mt-1 text-display-balance font-extrabold text-foreground">{currencySymbol}{amount.toFixed(2)}</p>
            {conversionSummary ? <p className="mt-1 text-xs text-muted-foreground">{conversionSummary}</p> : null}
          </div>
          <div className="border-t border-border px-5 py-4">
            {taxAmount > 0 ? (
              <div className="flex items-center justify-between gap-4"><p className="text-base text-foreground">Impuesto DGII 0.15%</p><p className="font-semibold text-foreground">{sym} {taxAmount.toFixed(2)}</p></div>
            ) : null}
            <div className={taxAmount > 0 ? "mt-4 flex items-center justify-between gap-4" : "flex items-center justify-between gap-4"}>
              <p className="text-base font-semibold text-foreground">Total a debitar</p>
              <p className="font-bold text-foreground">{sym} {totalDebit.toFixed(2)}</p>
            </div>
          </div>
        </section>
        <section className="space-y-4">
          <div className="flex items-start justify-between gap-4 border-b border-border pb-4"><p className="text-base text-muted-foreground">Desde</p><div className="text-right"><p className="font-bold text-foreground">{sourceAccountName}</p><p className="text-sm text-muted-foreground">Disponible {sourceAvailable}</p></div></div>
          <div className="flex items-start justify-between gap-4"><p className="text-base text-muted-foreground">Destino</p><p className="text-right font-bold text-foreground">{cardName} · {currencySymbol}</p></div>
        </section>
      </div>
    </MobileSheetLayout>
  )
}
