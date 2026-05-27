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

  return (
    <div className="rounded-3xl border border-black/5 bg-white px-6 py-8 text-black shadow-[0_10px_30px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-[#0B0F14] dark:text-white dark:shadow-[0_14px_34px_rgba(0,0,0,0.35)]">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-black/70 dark:text-white/75">Balance neto</p>
        <button
          onClick={() => setShowBalance(!showBalance)}
          className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/10"
          aria-label={showBalance ? "Ocultar balance" : "Mostrar balance"}
        >
          {showBalance ? (
            <Eye className="h-4 w-4 text-black/55 dark:text-white/60" />
          ) : (
            <EyeOff className="h-4 w-4 text-black/55 dark:text-white/60" />
          )}
        </button>
      </div>

      <h2 className="mt-3 text-4xl font-bold tracking-tight text-black dark:text-white">
        {isLoading ? (
          <span className="inline-block h-10 w-48 animate-pulse rounded bg-black/10 dark:bg-white/15" />
        ) : showBalance ? (
          formatCurrency(netBalance)
        ) : (
          "••••••••"
        )}
      </h2>

      {hasPending && (
        <p className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
          Incluye movimientos pendientes
        </p>
      )}

      <p className="mt-2 text-xs text-black/55 dark:text-white/55">Efectivo y débito</p>
      <p className={totalCreditDebt > 0 ? "mt-1 text-xs text-red-600 dark:text-red-300" : "mt-1 text-xs text-black/60 dark:text-white/60"}>
        Deuda total de tarjetas: {showBalance ? formatCurrency(totalCreditDebt, "DOP") : "••••••••"}
      </p>
    </div>
  )
}
