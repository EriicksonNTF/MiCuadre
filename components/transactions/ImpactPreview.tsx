"use client"

import { useEffect, useState } from "react"
import { AlertCircle, ArrowRight, TrendingDown, TrendingUp } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency } from "@/lib/data"
import { cn } from "@/lib/utils"

type PreviewData = {
  old_amount: number
  new_amount: number
  amount_diff: number
  old_commission: number
  new_commission: number
  commission_action: "create" | "remove" | "recalculate" | "unchanged"
  linked_accounts: Array<{
    id: string
    name: string
    old_balance: number
    new_balance: number
  }>
  kind?: string
  old_currency?: string
  new_currency?: string
  old_description?: string
  new_description?: string
}

export function ImpactPreview({
  transactionId,
  amount,
  currency,
  description,
  date,
  categoryId,
  notes,
}: {
  transactionId: string
  amount?: number
  currency?: string
  description?: string
  date?: string
  categoryId?: string | null
  notes?: string
}) {
  const [data, setData] = useState<PreviewData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!transactionId || amount === undefined) {
      setData(null)
      return
    }

    setLoading(true)
    setError(null)

    const supabase = createClient()
    const timer = setTimeout(async () => {
      try {
        const { data: preview, error: rpcError } = await supabase.rpc("update_transaction_preview", {
          p_transaction_id: transactionId,
          p_amount: amount,
          p_currency: currency || null,
          p_description: description || null,
          p_date: date ? date.split("T")[0] : null,
          p_category_id: categoryId || null,
          p_notes: notes || null,
        })

        if (rpcError) throw rpcError
        setData(preview as PreviewData)
      } catch (e) {
        setError(null)
        setData(null)
      } finally {
        setLoading(false)
      }
    }, 400)

    return () => clearTimeout(timer)
  }, [transactionId, amount, currency, description, date, categoryId, notes])

  if (!data || data.amount_diff === 0) return null

  const currencySymbol = data.new_currency === "USD" ? "USD" : "DOP"
  const isSameCurrency = data.old_currency === data.new_currency

  return (
    <div className="space-y-3 rounded-xl bg-muted/50 p-4 text-sm">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <AlertCircle className="h-3 w-3" />
        Impacto de los cambios
      </div>

      {/* Amount change */}
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Monto</span>
        <div className="flex items-center gap-1.5 text-right tabular-nums">
          <span className="text-muted-foreground line-through">
            {formatCurrency(data.old_amount)} {currencySymbol}
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-semibold text-foreground">
            {formatCurrency(data.new_amount)} {currencySymbol}
          </span>
        </div>
      </div>

      {/* Diff */}
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Diferencia</span>
        <span
          className={cn(
            "tabular-nums font-medium",
            data.amount_diff > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400",
          )}
        >
          {data.amount_diff > 0 ? "+" : ""}
          {formatCurrency(data.amount_diff)} {currencySymbol}
        </span>
      </div>

      {/* Commission */}
      {data.commission_action !== "unchanged" && (
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Comisión DGII (0.15%)</span>
          <div className="flex items-center gap-1.5 text-right tabular-nums">
            {data.old_commission > 0 && (
              <span className="text-muted-foreground line-through">
                {formatCurrency(data.old_commission)}
              </span>
            )}
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span className="font-medium text-amber-600 dark:text-amber-400">
              {data.new_commission > 0 ? formatCurrency(data.new_commission) : "0.00"}
            </span>
          </div>
        </div>
      )}

      {/* Linked accounts impact */}
      {data.linked_accounts?.length > 0 && (
        <div className="border-t border-border pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Impacto en cuentas vinculadas
          </p>
          {data.linked_accounts.map((acc) => {
            const balanceDiff = acc.new_balance - acc.old_balance
            return (
              <div key={acc.id} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-1.5">
                  {balanceDiff <= 0 ? (
                    <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                  ) : (
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                  )}
                  <span className="text-muted-foreground">{acc.name}</span>
                </div>
                <div className="flex items-center gap-1.5 tabular-nums text-xs">
                  <span className="text-muted-foreground line-through">{formatCurrency(acc.old_balance)}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="font-medium text-foreground">{formatCurrency(acc.new_balance)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
