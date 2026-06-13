"use client"

import {
  ArrowDownLeft,
  Banknote,
  Book,
  Briefcase,
  Building2,
  Car,
  Circle,
  CreditCard,
  Film,
  Heart,
  Home,
  Laptop,
  MinusCircle,
  Plus,
  PlusCircle,
  ShoppingBag,
  TrendingUp,
  Utensils,
  Zap,
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
    const date = parseTxDate(tx.date)
    const key = getLocalDateString(date)
    if (!acc[key]) {
      acc[key] = { label: formatGroupLabel(date), date, items: [] as Transaction[] }
    }
    acc[key].items.push(tx)
    return acc
  }, {} as Record<string, { label: string; date: Date; items: Transaction[] }>)

  const groups = Object.entries(grouped)
    .sort((a, b) => b[1].date.getTime() - a[1].date.getTime())
    .map(([key, value]) => ({ key, ...value }))

  if (isLoading) {
    return (
      <section className="space-y-4">
        <SectionHeader />
        <div className="space-y-2">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-16 animate-pulse rounded-2xl bg-card/80 shadow-sm" />
          ))}
        </div>
      </section>
    )
  }

  if (!transactions || transactions.length === 0) {
    return (
      <section className="space-y-4">
        <SectionHeader hideAction />
        <div className="mobile-card p-5 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/12 text-accent">
            <ArrowDownLeft className="h-5 w-5" />
          </div>
          <p className="mt-3 text-sm font-semibold text-foreground">Sin movimientos aún</p>
          <p className="mt-1 text-xs text-muted-foreground">Registra tu primer gasto o ingreso para ver tu actividad.</p>
          <Link
            href="/expense"
            className="tap-lift mt-4 inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-lift)]"
          >
            <Plus className="h-4 w-4" />
            Agregar movimiento
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <SectionHeader />

      <div className="overflow-hidden rounded-[1.65rem] border border-border/65 bg-card shadow-sm">
        {groups.map((group, groupIndex) => (
          <div key={group.key} className={cn(groupIndex > 0 && "border-t border-border/60")}>
            <div className="flex items-center justify-between bg-muted/45 px-4 py-2.5">
              <p className="text-[0.6875rem] font-black uppercase tracking-[0.16em] text-muted-foreground">{group.label}</p>
              <p className="text-[0.6875rem] font-semibold text-muted-foreground">{group.items.length} mov.</p>
            </div>
            <div>
              {group.items.map((transaction, index) => {
                const categoryIcon = transaction.category?.icon || "circle"
                const Icon = categoryIcons[categoryIcon] || Circle
                const categoryColor = transaction.category?.color || "#64748b"
                const accountType = transaction.account?.type || "cash"
                const AccountIcon = accountIconsSmall[accountType]
                const txDate = transaction.created_at ? new Date(transaction.created_at) : parseTxDate(transaction.date)
                const txTime = txDate.toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" })
                const isIncome = transaction.type === "income"

                return (
                  <div
                    key={transaction.id}
                    className={cn("flex items-center gap-3 px-4 py-3", index > 0 && "border-t border-border/50")}
                  >
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                      style={{
                        backgroundColor: `${categoryColor}16`,
                        color: categoryColor,
                      }}
                    >
                      <Icon className="h-4 w-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-foreground">
                        {transaction.description || transaction.category?.name || "Transacción"}
                      </p>
                      <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                        <AccountIcon className="h-3 w-3 shrink-0" />
                        <span className="truncate">{transaction.account?.name || "Cuenta"}</span>
                        <span className="shrink-0">·</span>
                        <span className="shrink-0">{txTime}</span>
                      </div>
                    </div>

                    <p
                      className={cn(
                        "shrink-0 text-right text-xl font-bold",
                        isIncome
                          ? "text-emerald-600 dark:text-emerald-400"
                          : accountType === "credit"
                            ? "text-orange-600 dark:text-orange-400"
                            : "text-foreground",
                      )}
                    >
                      {isIncome ? "+" : "-"}
                      {formatCurrency(transaction.amount, transaction.currency)}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function SectionHeader({ hideAction = false }: { hideAction?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="section-kicker">Movimientos</p>
        <p className="mt-1 text-sm font-bold text-foreground">Actividad reciente</p>
      </div>
      {!hideAction && (
        <Link href="/history" className="tap-lift rounded-full bg-muted px-3 py-1.5 text-xs font-bold text-muted-foreground">
          Ver todos
        </Link>
      )}
    </div>
  )
}
