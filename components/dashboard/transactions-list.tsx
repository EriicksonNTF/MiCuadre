"use client"

import {
  ShoppingBag,
  Utensils,
  Car,
  Zap,
  ArrowDownLeft,
  Film,
  Banknote,
  Building2,
  CreditCard,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { transactions, accounts, formatCurrency } from "@/lib/data"

const categoryIcons = {
  food: Utensils,
  transport: Car,
  shopping: ShoppingBag,
  utilities: Zap,
  income: ArrowDownLeft,
  entertainment: Film,
}

const categoryColors: Record<string, string> = {
  food: "bg-orange-50 text-orange-500",
  transport: "bg-blue-50 text-blue-500",
  shopping: "bg-pink-50 text-pink-500",
  utilities: "bg-amber-50 text-amber-500",
  income: "bg-emerald-50 text-emerald-500",
  entertainment: "bg-violet-50 text-violet-500",
}

const accountIconsSmall = {
  cash: Banknote,
  bank: Building2,
  credit: CreditCard,
}

export function TransactionsList() {
  const getAccountName = (accountId: string) => {
    const account = accounts.find(a => a.id === accountId)
    return account?.name || accountId
  }

  const getAccountType = (accountId: string) => {
    const account = accounts.find(a => a.id === accountId)
    return account?.type || "cash"
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">Movimientos</p>
        <button className="text-xs font-medium text-accent">Ver todos</button>
      </div>

      <div className="space-y-2">
        {transactions.map((transaction) => {
          const Icon = categoryIcons[transaction.category as keyof typeof categoryIcons] || Utensils
          const accountType = getAccountType(transaction.accountId)
          const AccountIcon = accountIconsSmall[accountType]

          return (
            <div
              key={transaction.id}
              className="flex items-center gap-4 rounded-2xl bg-card p-4"
            >
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full",
                  categoryColors[transaction.category] || "bg-gray-50 text-gray-500"
                )}
              >
                <Icon className="h-4 w-4" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {transaction.title}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <AccountIcon className="h-3 w-3" />
                  <span>{getAccountName(transaction.accountId)}</span>
                  <span>·</span>
                  <span>{transaction.date}</span>
                </div>
              </div>

              <p
                className={cn(
                  "text-sm font-semibold",
                  transaction.type === "income"
                    ? "text-accent"
                    : accountType === "credit"
                    ? "text-orange-600"
                    : "text-foreground"
                )}
              >
                {transaction.type === "income" ? "+" : "-"}
                {formatCurrency(transaction.amount)}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
