"use client"

import { CreditCard, Eye, EyeOff } from "lucide-react"
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
  const hiddenText = "••••••"
  const balanceText = showBalance ? formatCurrency(netBalance) : hiddenText

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-[var(--shadow-soft)]">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/[0.06] via-transparent to-transparent" />
      <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-accent/[0.04] blur-2xl" />

      <div className="relative px-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="section-kicker">Balance total</p>
            <p className="mt-1 text-xs text-muted-foreground">Efectivo, débito y tarjetas</p>
          </div>
          <button
            type="button"
            onClick={() => setShowBalance(!showBalance)}
            className="tap-lift flex h-10 w-10 items-center justify-center rounded-full bg-muted/80 text-muted-foreground ring-1 ring-border/60 transition-colors hover:bg-muted hover:text-foreground"
            aria-label={showBalance ? "Ocultar balance" : "Mostrar balance"}
          >
            {showBalance ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
        </div>

        <h2 className="relative mt-6 overflow-hidden text-ellipsis text-[clamp(1.75rem,8vw,2.75rem)] font-black leading-none tracking-tight text-foreground">
          {isLoading ? (
            <span className="inline-block h-11 w-52 max-w-full animate-pulse rounded-2xl bg-muted" />
          ) : (
            <span className="block truncate">{balanceText}</span>
          )}
        </h2>

        {hasPending && (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
            Pendientes por confirmar
          </p>
        )}

        <div className="mt-5 flex items-center gap-3 rounded-2xl bg-muted/50 px-4 py-3">
          <CreditCard className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="flex w-full items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">Deuda tarjetas</p>
            <p className="text-xl font-bold text-foreground tabular-nums">
              {showBalance ? formatCurrency(totalCreditDebt, "DOP") : hiddenText}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
