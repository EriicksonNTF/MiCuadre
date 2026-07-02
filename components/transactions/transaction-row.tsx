"use client"

import {
  Banknote,
  Building2,
  Car,
  CreditCard,
  Film,
  GraduationCap,
  Heart,
  MoreHorizontal,
  Pencil,
  Plane,
  ShoppingBag,
  Trash2,
  TrendingUp,
  Utensils,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/data"
import type { AccountType } from "@/lib/types/database"

/* ──────────────────────────────────────────────────────────
   CATEGORY MAPPING — single source of truth for all modules
   ────────────────────────────────────────────────────────── */

const categoryIcons: Record<string, typeof Utensils> = {
  food: Utensils,
  utensils: Utensils,
  transport: Car,
  car: Car,
  utilities: Zap,
  zap: Zap,
  entertainment: Film,
  film: Film,
  shopping: ShoppingBag,
  "shopping-bag": ShoppingBag,
  health: Heart,
  heart: Heart,
  education: GraduationCap,
  book: GraduationCap,
  travel: Plane,
  income: TrendingUp,
  "trending-up": TrendingUp,
  other: MoreHorizontal,
  circle: MoreHorizontal,
  "plus-circle": TrendingUp,
  "minus-circle": MoreHorizontal,
  briefcase: MoreHorizontal,
  laptop: MoreHorizontal,
  home: MoreHorizontal,
}

const categoryColors: Record<string, string> = {
  food: "bg-orange-100/30 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400",
  transport: "bg-blue-100/30 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
  utilities: "bg-yellow-100/30 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400",
  entertainment: "bg-purple-100/30 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
  shopping: "bg-pink-100/30 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400",
  health: "bg-red-100/30 dark:bg-red-900/30 text-red-600 dark:text-red-400",
  education: "bg-indigo-100/30 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400",
  travel: "bg-cyan-100/30 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400",
  income: "bg-emerald-100/30 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400",
  other: "bg-muted/50 text-muted-foreground",
}

const accountIcons: Record<AccountType, typeof Banknote> = {
  cash: Banknote,
  debit: Building2,
  credit: CreditCard,
}

/* ──────────────────────────────────────────────────────────
   NORMALIZED DATA TYPE — all modules map to this shape
   ────────────────────────────────────────────────────────── */

export type TransactionRowData = {
  id: string
  title: string
  category: string
  categoryName?: string
  amount: number
  type: "income" | "expense"
  currency?: "DOP" | "USD"
  accountName?: string
  accountType?: AccountType
  time?: string
  date?: string
  isCommission?: boolean
  isTransfer?: boolean
  metadata?: Record<string, any>
}

/* ──────────────────────────────────────────────────────────
   TRANSACTION ROW — consistent across all modules
   ────────────────────────────────────────────────────────── */

type TransactionRowProps = {
  tx: TransactionRowData
  /** Show account name in subtitle (default: true) */
  showAccount?: boolean
  /** Show time in subtitle (default: true) */
  showTime?: boolean
  /** Show category name in subtitle (default: false) */
  showCategory?: boolean
  /** Show date below subtitle (default: false) */
  showDate?: boolean
  /** Swipe action buttons */
  actions?: {
    onEdit?: () => void
    onDelete?: () => void
  }
  /** Swipe state (for parent-controlled swipe) */
  swipe?: {
    isOpen: boolean
    offset: number
    onPointerDown: (e: React.PointerEvent) => void
    onPointerMove: (e: React.PointerEvent) => void
    onPointerUp: () => void
    onPointerCancel: () => void
  }
}

export function TransactionRow({
  tx,
  showAccount = true,
  showTime = true,
  showCategory = false,
  showDate = false,
  actions,
  swipe,
}: TransactionRowProps) {
  const Icon = categoryIcons[tx.category] || categoryIcons.other
  const colorClass = categoryColors[tx.category] || categoryColors.other
  const AccountIcon = tx.accountType ? accountIcons[tx.accountType] : null
  const isIncome = tx.type === "income"

  const subtitleParts: string[] = []
  if (showAccount && tx.accountName) subtitleParts.push(tx.accountName)
  if (showTime && tx.time) subtitleParts.push(tx.time)
  if (showCategory && tx.categoryName) subtitleParts.push(tx.categoryName)

  const hasSwipe = Boolean(swipe && actions)
  const swipeOffset = swipe?.offset ?? 0

  const rowContent = (
    <div className="flex items-center gap-3 p-4">
      <div
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
          colorClass
        )}
      >
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-reflow text-sm font-medium text-foreground">
          {tx.title}
        </p>
        {subtitleParts.length > 0 && (
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            {AccountIcon && (
              <AccountIcon className="h-3 w-3 shrink-0" />
            )}
            {subtitleParts.map((part, i) => (
              <span key={i}>
                {i > 0 && <span className="mx-1">·</span>}
                <span className="text-reflow-1">{part}</span>
              </span>
            ))}
          </div>
        )}
        {showDate && tx.date && (
          <p className="mt-0.5 text-xs text-muted-foreground">{tx.date}</p>
        )}
      </div>

      <div className="tx-amount amount-inline shrink-0 text-right font-bold tabular-nums">
        {!isIncome && (
          <span className="text-expense">-</span>
        )}
        <span
          className={cn(
            isIncome
              ? "text-income"
              : tx.accountType === "credit"
                ? "text-expense-credit"
                : "text-expense"
          )}
        >
          {formatCurrency(tx.amount, tx.currency)}
        </span>
      </div>
    </div>
  )

  if (!hasSwipe) {
    return <div className="relative">{rowContent}</div>
  }

  return (
    <div data-tx-row="true" className="relative overflow-hidden rounded-2xl">
      {/* Swipe action buttons */}
      <div className="absolute inset-y-0 right-0 flex w-28 items-center justify-end gap-1 pr-2">
        <button
          type="button"
          aria-label="Editar transacción"
          onClick={actions!.onEdit}
          className="tap-lift flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-foreground"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Eliminar transacción"
          onClick={actions!.onDelete}
          className="tap-lift flex h-10 w-10 items-center justify-center rounded-xl bg-destructive text-destructive-foreground"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Main row */}
      <div
        className="relative z-10 rounded-2xl border border-border/55 bg-card shadow-sm transition-transform duration-200 ease-[var(--ease-out-ios)]"
        style={{ transform: `translateX(${swipeOffset}px)` }}
        onPointerDown={swipe!.onPointerDown}
        onPointerMove={swipe!.onPointerMove}
        onPointerUp={swipe!.onPointerUp}
        onPointerCancel={swipe!.onPointerCancel}
      >
        {rowContent}
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────
   TRANSACTION GROUP — consistent date separator
   ────────────────────────────────────────────────────────── */

type TransactionGroupProps = {
  label: string
  count?: number
  children: React.ReactNode
}

export function TransactionGroup({ label, count, children }: TransactionGroupProps) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {count !== undefined && (
          <p className="text-xs text-muted-foreground">{count} mov.</p>
        )}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  )
}
