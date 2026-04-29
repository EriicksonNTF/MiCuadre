"use client"

import { Eye, EyeOff } from "lucide-react"
import { useState } from "react"
import { accounts, calculateNetBalance, formatCurrency } from "@/lib/data"

export function BalanceCard() {
  const [showBalance, setShowBalance] = useState(true)
  const netBalance = calculateNetBalance(accounts)

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
        {showBalance ? formatCurrency(netBalance) : "••••••••"}
      </h2>

      <p className="mt-2 text-xs opacity-60">
        Activos menos deudas
      </p>
    </div>
  )
}
