"use client"

import { Eye, EyeOff } from "lucide-react"
import { useState } from "react"
import { useAccounts } from "@/hooks/use-data"
import { calculateNetBalance, formatCurrency } from "@/lib/data"

export function BalanceCard() {
  const [showBalance, setShowBalance] = useState(true)
  const { data: accounts, isLoading } = useAccounts()
  const netBalance = accounts ? calculateNetBalance(accounts) : 0
  const totalCreditDebt = accounts
    ? accounts
        .filter((account) => account.type === "credit")
        .reduce((sum, account) => sum + Number(account.current_debt_dop || 0), 0)
    : 0

  const hasPending = accounts ? accounts.some((acc: any) => acc.hasPendingChanges) : false
  const balanceText = showBalance ? formatCurrency(netBalance) : "••••••••"

  return (
    <div className="mobile-card relative overflow-hidden px-6 py-7">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-accent via-gold to-primary/40" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--accent)_10%,transparent),transparent_42%)]" />
      <div className="relative flex items-center justify-between">
        <p className="section-kicker">Balance total</p>
        <button type="button"
          onClick={() => setShowBalance(!showBalance)}
          className="tap-lift flex h-10 w-10 items-center justify-center rounded-full bg-muted/80 transition-colors hover:bg-muted"
          aria-label={showBalance ? "Ocultar balance" : "Mostrar balance"}
        >
          {showBalance ? (
            <Eye className="h-4 w-4 text-muted-foreground" />
          ) : (
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </div>

      <h2 className="relative mt-5 overflow-hidden text-[clamp(1.9rem,8vw,2.7rem)] font-black leading-none tracking-tight text-foreground">
        {isLoading ? (
          <span className="inline-block h-12 w-52 max-w-full animate-pulse rounded-2xl bg-muted" />
        ) : (
          <span className="block max-w-full whitespace-nowrap">{balanceText}</span>
        )}
      </h2>

      {hasPending && (
        <p className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
          Incluye movimientos pendientes
        </p>
      )}

      <div className="relative mt-5 grid grid-cols-[1fr_auto] gap-3 rounded-2xl bg-background/58 p-3 ring-1 ring-border/55 backdrop-blur">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">Efectivo, débito y tarjetas</p>
          <p className={totalCreditDebt > 0 ? "mt-1 text-xs font-bold text-destructive" : "mt-1 text-xs text-muted-foreground"}>
            Deuda total: {showBalance ? formatCurrency(totalCreditDebt, "DOP") : "••••••••"}
          </p>
        </div>
        <span className="h-10 w-1 rounded-full bg-gradient-to-b from-accent to-gold" />
      </div>
    </div>
  )
}
