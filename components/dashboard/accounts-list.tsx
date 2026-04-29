"use client"

import { Banknote, Building2, CreditCard, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAccounts } from "@/hooks/use-data"
import { formatCurrency, getAvailableCredit } from "@/lib/data"
import type { AccountType } from "@/lib/types/database"

const accountIcons: Record<AccountType, typeof Banknote> = {
  cash: Banknote,
  debit: Building2,
  credit: CreditCard,
}

const accountColors: Record<AccountType, string> = {
  cash: "bg-emerald-50 text-emerald-600",
  debit: "bg-blue-50 text-blue-600",
  credit: "bg-orange-50 text-orange-600",
}

export function AccountsList() {
  const { data: accounts, isLoading } = useAccounts()

  if (isLoading) {
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium text-muted-foreground">Cuentas</p>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-card" />
          ))}
        </div>
      </div>
    )
  }

  if (!accounts || accounts.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium text-muted-foreground">Cuentas</p>
        <div className="rounded-2xl border-2 border-dashed border-muted bg-card p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Plus className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="mt-3 text-sm font-medium text-foreground">
            No tienes cuentas
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Agrega tu primera cuenta para comenzar
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-muted-foreground">Cuentas</p>

      <div className="space-y-3">
        {accounts.map((account) => {
          const Icon = accountIcons[account.type]
          const isCredit = account.type === "credit"

          return (
            <div
              key={account.id}
              className="rounded-2xl bg-card p-4"
            >
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full",
                    accountColors[account.type]
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {account.name}
                  </p>
                  {isCredit ? (
                    <p className="text-xs text-muted-foreground">
                      Deuda actual
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Disponible
                    </p>
                  )}
                </div>

                <div className="text-right">
                  {isCredit ? (
                    <p className="text-sm font-semibold text-orange-600">
                      -{formatCurrency(account.current_debt || 0, account.currency)}
                    </p>
                  ) : (
                    <p className="text-sm font-semibold text-foreground">
                      {formatCurrency(account.balance, account.currency)}
                    </p>
                  )}
                </div>
              </div>

              {/* Credit card details */}
              {isCredit && account.credit_limit && (
                <div className="mt-4 space-y-2 border-t border-border pt-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Límite</span>
                    <span className="text-foreground">
                      {formatCurrency(account.credit_limit, account.currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Disponible</span>
                    <span className="text-accent font-medium">
                      {formatCurrency(getAvailableCredit(account), account.currency)}
                    </span>
                  </div>
                  {/* Credit usage bar */}
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-orange-500 transition-all"
                      style={{
                        width: `${((account.current_debt || 0) / account.credit_limit) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
