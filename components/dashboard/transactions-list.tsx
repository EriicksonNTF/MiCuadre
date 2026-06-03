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
  Plus,
  PlusCircle,
  MinusCircle,
  Circle,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { useTransactions } from "@/hooks/use-data"
import { formatCurrency, getLocalDateString } from "@/lib/data"
import type { AccountType, Transaction } from "@/lib/types/database"

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

  const parseTxDate = (value: string) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T12:00:00`)
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed
  }

  const formatGroupLabel = (date: Date) => {
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(today.getDate() - 1)
    const key = getLocalDateString(date)
    if (key === getLocalDateString(today)) return "Hoy"
    if (key === getLocalDateString(yesterday)) return "Ayer"
    return date.toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" })
  }

  const grouped = (transactions || []).reduce((acc, tx) => {
    const d = parseTxDate(tx.date)
    const key = getLocalDateString(d)
    if (!acc[key]) {
      acc[key] = { label: formatGroupLabel(d), date: d, items: [] as Transaction[] }
    }
    acc[key].items.push(tx)
    return acc
  }, {} as Record<string, { label: string; date: Date; items: Transaction[] }>)

  const groups = Object.entries(grouped)
    .sort((a, b) => b[1].date.getTime() - a[1].date.getTime())
    .map(([key, value]) => ({ key, ...value }))

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="section-kicker">Movimientos</p>
          <Link href="/history" className="text-xs font-medium text-accent">Ver todos</Link>
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-card/80 shadow-sm" />
          ))}
        </div>
      </div>
    )
  }

  if (!transactions || transactions.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="section-kicker">Movimientos</p>
        </div>
        <div className="mobile-card p-5 text-center">
          <p className="text-sm font-semibold text-foreground">Sin movimientos aún</p>
          <p className="mt-1 text-xs text-muted-foreground">Registra tu primer gasto o ingreso para ver tu actividad.</p>
          <Link
            href="/expense"
            className="tap-lift mt-4 inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-lift)]"
          >
            <Plus className="h-4 w-4" />
            Agregar mi primer movimiento
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="section-kicker">Movimientos</p>
        <Link href="/history" className="tap-lift rounded-full px-2 text-xs font-bold text-accent">Ver todos</Link>
      </div>

      <div className="space-y-3">
        {groups.map((group) => (
          <div key={group.key} className="space-y-2">
            <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</p>
            {group.items.map((transaction) => {
          const categoryIcon = transaction.category?.icon || "circle"
          const Icon = categoryIcons[categoryIcon] || Circle
          const categoryColor = transaction.category?.color || "#64748b"
          const accountType = transaction.account?.type || "cash"
          const AccountIcon = accountIconsSmall[accountType]
          const txDate = transaction.created_at ? new Date(transaction.created_at) : parseTxDate(transaction.date)
          const txTime = txDate.toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" })

          return (
            <div
              key={transaction.id}
              className="tap-lift flex items-center gap-4 rounded-[1.35rem] border border-border/55 bg-card/78 p-4 shadow-sm backdrop-blur transition-colors hover:bg-card"
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
                  <span>{txTime}</span>
                </div>
              </div>

              <p
                className={cn(
                  "text-sm font-semibold",
                  transaction.type === "income"
                    ? "text-emerald-600 dark:text-emerald-400"
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
        ))}
      </div>
    </div>
  )
}
