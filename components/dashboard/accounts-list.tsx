"use client"

import { useState } from "react"
import { ChevronDown, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAccounts } from "@/hooks/use-data"
import { BrandedAccountCard } from "@/components/accounts/branded-account-card"

export function AccountsList() {
  const { data: accounts, isLoading } = useAccounts()
  const [showAllCredit, setShowAllCredit] = useState(false)
  const [showAllCashDebit, setShowAllCashDebit] = useState(false)

  if (isLoading) {
    return <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-card" />)}</div>
  }

  if (!accounts || accounts.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-muted bg-card p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted"><Plus className="h-5 w-5 text-muted-foreground" /></div>
        <p className="mt-3 text-sm font-medium text-foreground">No tienes cuentas</p>
      </div>
    )
  }

  const creditAccounts = accounts.filter((a) => a.type === "credit")
  const cashDebitAccounts = accounts.filter((a) => a.type !== "credit")

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">Tarjetas de crédito</p>
          {creditAccounts.length > 1 && (
            <button onClick={() => setShowAllCredit((v) => !v)} className="flex items-center gap-1 text-xs text-muted-foreground">
              <ChevronDown className={cn("h-4 w-4 transition-transform", showAllCredit && "rotate-180")} />
              {showAllCredit ? "Ocultar" : "Ver más"}
            </button>
          )}
        </div>
        <div className="space-y-3">
          {(showAllCredit ? creditAccounts : creditAccounts.slice(0, 1)).map((account) => (
            <BrandedAccountCard key={account.id} account={account} compact />
          ))}
          {creditAccounts.length === 0 && <div className="rounded-2xl bg-card p-4 text-xs text-muted-foreground">No hay tarjetas de credito.</div>}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">Efectivo + Débito</p>
          {cashDebitAccounts.length > 1 && (
            <button onClick={() => setShowAllCashDebit((v) => !v)} className="flex items-center gap-1 text-xs text-muted-foreground">
              <ChevronDown className={cn("h-4 w-4 transition-transform", showAllCashDebit && "rotate-180")} />
              {showAllCashDebit ? "Ocultar" : "Ver más"}
            </button>
          )}
        </div>
        <div className="space-y-3">
          {(showAllCashDebit ? cashDebitAccounts : cashDebitAccounts.slice(0, 1)).map((account) => (
            <BrandedAccountCard key={account.id} account={account} compact />
          ))}
        </div>
      </div>
    </div>
  )
}
