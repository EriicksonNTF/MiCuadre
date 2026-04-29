"use client"

import { Eye, EyeOff } from "lucide-react"
import { useState } from "react"
import { useAccounts } from "@/hooks/use-data"
import { calculateNetBalance, formatCurrency } from "@/lib/data"

export function BalanceCard() {
  const [showBalance, setShowBalance] = useState(true)
  const { data: accounts, isLoading } = useAccounts()
  const netBalance = accounts ? calculateNetBalance(accounts) : 0

  return (
    <div className="rounded-3xl bg-primary px-6 py-8 text-primary-foreground">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium opacity-70">Balance neto</p>
        <button
          onClick={() => setShowBalance(!showBalance)}
          className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/10"
          aria-label={showBalance ? "Ocultar balance" : "Mostrar balance"}
        >
          {showBalance ? (
            <Eye className="h-4 w-4 opacity-70" />
          ) : (
            <EyeOff className="h-4 w-4 opacity-70" />
          )}
        </button>
      </div>

      <h2 className="mt-3 text-4xl font-bold tracking-tight">
        {isLoading ? (
          <span className="inline-block h-10 w-48 animate-pulse rounded bg-white/20" />
        ) : showBalance ? (
          formatCurrency(netBalance)
        ) : (
          "••••••••"
        )}
      </h2>

      <p className="mt-2 text-xs opacity-60">
        Activos menos deudas
      </p>
    </div>
  )
}
