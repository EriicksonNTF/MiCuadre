"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Banknote,
  Building2,
  CreditCard,
  ArrowRightLeft,
  Plus,
  ChevronRight,
  X,
  ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { accounts, formatCurrency, getAvailableCredit } from "@/lib/data"
import type { AccountType } from "@/lib/data"

const accountIcons: Record<AccountType, typeof Banknote> = {
  cash: Banknote,
  bank: Building2,
  credit: CreditCard,
}

const accountGradients: Record<AccountType, string> = {
  cash: "from-emerald-500 to-emerald-600",
  bank: "from-blue-500 to-blue-600",
  credit: "from-orange-500 to-orange-600",
}

export function AccountsScreen() {
  const [showTransfer, setShowTransfer] = useState(false)
  const [fromAccount, setFromAccount] = useState<string>("")
  const [toAccount, setToAccount] = useState<string>("")
  const [transferAmount, setTransferAmount] = useState("")
  const [isTransferring, setIsTransferring] = useState(false)

  const handleTransfer = async () => {
    if (!fromAccount || !toAccount || !transferAmount) return
    setIsTransferring(true)
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsTransferring(false)
    setShowTransfer(false)
    setFromAccount("")
    setToAccount("")
    setTransferAmount("")
  }

  const parsedTransferAmount = parseFloat(transferAmount.replace(/[^0-9.]/g, "")) || 0

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <header className="px-6 pb-4 pt-8">
        <h1 className="text-2xl font-bold text-foreground">Cuentas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Administra tu dinero
        </p>
      </header>

      {/* Account Cards */}
      <div className="space-y-4 px-6 pt-4">
        {accounts.map((account) => {
          const Icon = accountIcons[account.type]
          const isCredit = account.type === "credit"

          return (
            <Link
              key={account.id}
              href={`/accounts/${account.id}`}
              className={cn(
                "relative block overflow-hidden rounded-3xl bg-gradient-to-br p-6 text-white transition-transform active:scale-[0.98]",
                accountGradients[account.type]
              )}
            >
              {/* Card pattern */}
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
              <div className="absolute -bottom-4 -right-4 h-20 w-20 rounded-full bg-white/5" />

              <div className="relative">
                {/* Top row */}
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                    <Icon className="h-5 w-5" />
                  </div>
                  <ChevronRight className="h-5 w-5 opacity-50" />
                </div>

                {/* Account name */}
                <p className="mt-6 text-sm font-medium opacity-80">
                  {account.name}
                </p>

                {/* Balance */}
                <p className="mt-1 text-2xl font-bold">
                  {isCredit
                    ? `-${formatCurrency(account.currentDebt || 0)}`
                    : formatCurrency(account.balance)
                  }
                </p>

                {/* Credit card details */}
                {isCredit && account.creditLimit && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-sm opacity-80">
                      <span>Disponible</span>
                      <span className="font-semibold">
                        {formatCurrency(getAvailableCredit(account))}
                      </span>
                    </div>
                    {/* Usage bar */}
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                      <div
                        className="h-full rounded-full bg-white transition-all"
                        style={{
                          width: `${((account.currentDebt || 0) / account.creditLimit) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs opacity-60">
                      <span>Límite: {formatCurrency(account.creditLimit)}</span>
                      <span>
                        {Math.round(((account.currentDebt || 0) / account.creditLimit) * 100)}% usado
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </Link>
          )
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 px-6 pt-6">
        <Button
          variant="outline"
          onClick={() => setShowTransfer(true)}
          className="h-12 flex-1 gap-2 rounded-2xl"
        >
          <ArrowRightLeft className="h-4 w-4" />
          Transferir
        </Button>
        <Button
          variant="outline"
          className="h-12 flex-1 gap-2 rounded-2xl"
        >
          <Plus className="h-4 w-4" />
          Nueva cuenta
        </Button>
      </div>

      {/* Transfer Modal */}
      {showTransfer && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-3xl bg-card p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                Transferir dinero
              </h2>
              <button
                onClick={() => setShowTransfer(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {/* From Account */}
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Desde
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {accounts
                    .filter(a => a.type !== "credit")
                    .map((account) => {
                      const Icon = accountIcons[account.type]
                      const isSelected = fromAccount === account.id
                      return (
                        <button
                          key={account.id}
                          onClick={() => setFromAccount(account.id)}
                          className={cn(
                            "flex flex-col items-center gap-1 rounded-xl p-3 transition-all",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-foreground"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          <span className="text-xs font-medium">{account.name}</span>
                        </button>
                      )
                    })}
                </div>
              </div>

              {/* Arrow */}
              <div className="flex justify-center">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              {/* To Account */}
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Hacia
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {accounts.map((account) => {
                    const Icon = accountIcons[account.type]
                    const isSelected = toAccount === account.id
                    const isDisabled = fromAccount === account.id
                    return (
                      <button
                        key={account.id}
                        onClick={() => !isDisabled && setToAccount(account.id)}
                        disabled={isDisabled}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-xl p-3 transition-all",
                          isDisabled && "opacity-30 cursor-not-allowed",
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="text-xs font-medium">{account.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Amount */}
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Monto
                </p>
                <div className="flex items-center gap-2 rounded-xl bg-muted p-4">
                  <span className="text-lg font-medium text-muted-foreground">RD$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder="0"
                    className="flex-1 bg-transparent text-2xl font-bold text-foreground outline-none placeholder:text-muted-foreground/30"
                  />
                </div>
              </div>

              {/* Confirm Button */}
              <Button
                onClick={handleTransfer}
                disabled={!fromAccount || !toAccount || parsedTransferAmount <= 0 || isTransferring}
                className="h-12 w-full rounded-2xl text-base font-semibold"
              >
                {isTransferring ? "Transfiriendo..." : "Confirmar transferencia"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
