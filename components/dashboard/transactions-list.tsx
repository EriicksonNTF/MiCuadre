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
  Heart,
  Book,
  Home,
  Briefcase,
  Laptop,
  TrendingUp,
  PlusCircle,
  MinusCircle,
  Circle,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { useTransactions } from "@/hooks/use-data"
import { formatCurrency, formatDate } from "@/lib/data"
import type { AccountType } from "@/lib/types/database"

const categoryIcons: Record<string, typeof Circle> = {
  utensils: Utensils,
  car: Car,
  "shopping-bag": ShoppingBag,
  zap: Zap,
  film: Film,
  heart: Heart,
  book: Book,
  home: Home,
  briefcase: Briefcase,
  laptop: Laptop,
  "trending-up": TrendingUp,
  "plus-circle": PlusCircle,
  "minus-circle": MinusCircle,
  circle: Circle,
}

const accountIconsSmall: Record<AccountType, typeof Banknote> = {
  cash: Banknote,
  debit: Building2,
  credit: CreditCard,
}

export function TransactionsList() {
  const { data: transactions, isLoading } = useTransactions(10)

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">Movimientos</p>
          <Link href="/history" className="text-xs font-medium text-accent">Ver todos</Link>
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-card" />
          ))}
        </div>
      </div>
    )
  }

  if (!transactions || transactions.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">Movimientos</p>
          <Link href="/history" className="text-xs font-medium text-accent">Ver todos</Link>
        </div>
        <div className="rounded-2xl bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No hay movimientos recientes
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">Movimientos</p>
        <Link href="/history" className="text-xs font-medium text-accent">Ver todos</Link>
      </div>

      <div className="space-y-2">
        {transactions.map((transaction) => {
          const categoryIcon = transaction.category?.icon || "circle"
          const Icon = categoryIcons[categoryIcon] || Circle
          const categoryColor = transaction.category?.color || "#64748b"
          const accountType = transaction.account?.type || "cash"
          const AccountIcon = accountIconsSmall[accountType]

          return (
            <div
              key={transaction.id}
              className="flex items-center gap-4 rounded-2xl bg-card p-4"
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full"
                style={{
                  backgroundColor: `${categoryColor}15`,
                  color: categoryColor,
                }}
              >
                <Icon className="h-4 w-4" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {transaction.description || transaction.category?.name || "Transacción"}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <AccountIcon className="h-3 w-3" />
                  <span>{transaction.account?.name || "Cuenta"}</span>
                  <span>·</span>
                  <span>{formatDate(transaction.date)}</span>
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
                {formatCurrency(transaction.amount, transaction.currency)}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
