"use client"

import { Banknote, Building2, CreditCard } from "lucide-react"
import { cn } from "@/lib/utils"
import { accounts, formatCurrency, getAvailableCredit } from "@/lib/data"
import type { AccountType } from "@/lib/data"

const accountIcons: Record<AccountType, typeof Banknote> = {
  cash: Banknote,
  bank: Building2,
  credit: CreditCard,
}

const accountColors: Record<AccountType, string> = {
  cash: "bg-emerald-50 text-emerald-600",
  bank: "bg-blue-50 text-blue-600",
  credit: "bg-orange-50 text-orange-600",
}

export function AccountsList() {
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
                      -{formatCurrency(account.currentDebt || 0)}
                    </p>
                  ) : (
                    <p className="text-sm font-semibold text-foreground">
                      {formatCurrency(account.balance)}
                    </p>
                  )}
                </div>
              </div>

              {/* Credit card details */}
              {isCredit && account.creditLimit && (
                <div className="mt-4 space-y-2 border-t border-border pt-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Límite</span>
                    <span className="text-foreground">
                      {formatCurrency(account.creditLimit)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Disponible</span>
                    <span className="text-accent font-medium">
                      {formatCurrency(getAvailableCredit(account))}
                    </span>
                  </div>
                  {/* Credit usage bar */}
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-orange-500 transition-all"
                      style={{
                        width: `${((account.currentDebt || 0) / account.creditLimit) * 100}%`,
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
