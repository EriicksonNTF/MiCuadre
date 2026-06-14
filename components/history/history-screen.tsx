"use client"

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import {
  Banknote,
  Building2,
  Car,
  ChevronDown,
  CreditCard,
  Film,
  GraduationCap,
  Heart,
  MoreHorizontal,
  Pencil,
  Plane,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Trash2,
  TrendingDown,
  TrendingUp,
  Utensils,
  X,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { BaseModalForm } from "@/components/ui/base-modal-form"
import { MoneyInput } from "@/components/ui/money-input"
import { notify } from "@/lib/notifications"
import { EventBus } from "@/lib/event-bus"
import { useAccounts, useTransactions, updateTransaction, deleteTransaction } from "@/hooks/use-data"
import { usePersistentState } from "@/hooks/use-persistent-state"
import { formatCurrency, getLocalDateString } from "@/lib/data"
import { isExcludedFromRealIncome } from "@/lib/transactions/reporting"
import type { AccountType } from "@/lib/types/database"
import { MobilePageShell } from "@/components/ui/mobile-foundation"

const categoryIcons: Record<string, typeof Utensils> = {
  food: Utensils,
  transport: Car,
  utilities: Zap,
  entertainment: Film,
  shopping: ShoppingBag,
  health: Heart,
  education: GraduationCap,
  travel: Plane,
  income: TrendingUp,
  other: MoreHorizontal,
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

const nameToSlug: Record<string, string> = {
  Comida: "food",
  Transporte: "transport",
  Entretenimiento: "entertainment",
  Compras: "shopping",
  Servicios: "utilities",
  Salud: "health",
  Educacion: "education",
  Hogar: "other",
  Supermercado: "shopping",
  Suscripciones: "utilities",
  "Otros Gastos": "other",
  Salario: "income",
  Freelance: "income",
  Inversiones: "income",
  Regalos: "other",
  Reembolsos: "income",
  "Otros Ingresos": "income",
}

const creditCardIncomeLabels: Record<string, string> = {
  card_payment: "Abono a tarjeta",
  card_refund: "Reembolso en tarjeta",
  card_adjustment: "Ajuste positivo",
  card_cashback: "Cashback",
}

type DatePreset = "today" | "week" | "month" | "custom"

type HistoryTx = {
  id: string
  accountId: string
  categoryId: string | null
  title: string
  category: string
  categoryName: string
  amount: number
  type: "income" | "expense"
  date: string
  currency: "DOP" | "USD"
  isCommission: boolean
  notes: string | null
  createdAt: string
  isTransfer?: boolean
  metadata?: any
}

function parseTxDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T12:00:00`)
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? new Date(`${getLocalDateString()}T12:00:00`) : parsed
}

function formatDateLabel(date: Date) {
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  const key = getLocalDateString(date)
  if (key === getLocalDateString(today)) return "Hoy"
  if (key === getLocalDateString(yesterday)) return "Ayer"
  return date.toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" })
}

function formatTime(value: string, createdAt?: string) {
  const dateToParse = createdAt || value
  const date = dateToParse.includes("T") ? new Date(dateToParse) : parseTxDate(dateToParse)
  return date.toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" })
}

export function HistoryScreen() {
  const [searchQuery, setSearchQuery] = useState("")
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const [accountFilter, setAccountFilter] = usePersistentState<string>("history:accountFilter:v2", "all")
  const [datePreset, setDatePreset] = usePersistentState<DatePreset>("history:datePreset", "month")
  const [startDate, setStartDate] = usePersistentState<string>("history:startDate", "")
  const [endDate, setEndDate] = usePersistentState<string>("history:endDate", "")
  const [showFilters, setShowFilters] = usePersistentState("history:showFilters:v2", false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [accountSearch, setAccountSearch] = useState("")

  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editType, setEditType] = useState<"income" | "expense">("expense")
  const [editAccountId, setEditAccountId] = useState("")
  const [editDate, setEditDate] = useState("")
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null)

  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null)
  const [swipeOffset, setSwipeOffset] = useState<{ id: string; offset: number } | null>(null)
  const pointerRef = useRef<{ id: string; startX: number; startY: number; swiping: boolean } | null>(null)

  const { data: rawAccounts = [] } = useAccounts()
  const { data: rawTransactions = [] } = useTransactions(300)

  const accounts = useMemo(
    () =>
      rawAccounts.map((acc) => ({
        id: acc.id,
        name: acc.name,
        type: acc.type,
      })),
    [rawAccounts]
  )

  const transactions = useMemo<HistoryTx[]>(
    () =>
      rawTransactions.map((tx) => ({
        id: tx.id,
        accountId: tx.account_id,
        categoryId: tx.category_id,
        title: tx.description || "Sin descripción",
        category: nameToSlug[tx.category?.name || ""] || "other",
        categoryName: tx.category?.name || "Sin categoría",
        amount: tx.amount,
        type: tx.type,
        date: tx.date,
        currency: tx.currency,
        isCommission: tx.metadata?.kind === "commission",
        notes: tx.notes,
        createdAt: tx.created_at,
        isTransfer: tx.metadata?.kind === "transfer" && tx.metadata?.transfer_type === "internal",
        metadata: tx.metadata,
      })),
    [rawTransactions]
  )

  useEffect(() => {
    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest("[data-history-row='true']") || target?.closest("[data-account-menu='true']")) return
      setOpenSwipeId(null)
      setSwipeOffset(null)
      setAccountMenuOpen(false)
    }

    document.addEventListener("pointerdown", closeOnOutside)
    return () => document.removeEventListener("pointerdown", closeOnOutside)
  }, [])

  const applyPreset = (preset: DatePreset) => {
    const today = new Date()
    const end = getLocalDateString(today)
    if (preset === "today") {
      setStartDate(end)
      setEndDate(end)
      return
    }
    if (preset === "week") {
      const start = new Date(today)
      start.setDate(today.getDate() - 6)
      setStartDate(getLocalDateString(start))
      setEndDate(end)
      return
    }
    if (preset === "month") {
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      setStartDate(getLocalDateString(start))
      setEndDate(end)
    }
  }

  useEffect(() => {
    if (datePreset !== "custom") applyPreset(datePreset)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datePreset])

  const filteredTransactions = useMemo(() => {
    const search = deferredSearchQuery.trim().toLowerCase()

    return transactions
      .filter((tx) => {
        if (search && !tx.title.toLowerCase().includes(search)) return false
        if (accountFilter !== "all" && tx.accountId !== accountFilter) return false

        const txDate = getLocalDateString(parseTxDate(tx.date))
        if (startDate && txDate < startDate) return false
        if (endDate && txDate > endDate) return false
        return true
      })
      .sort((a, b) => {
        const byDate = parseTxDate(b.date).getTime() - parseTxDate(a.date).getTime()
        if (byDate !== 0) return byDate
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
  }, [transactions, deferredSearchQuery, accountFilter, startDate, endDate])

  const groupedTransactions = useMemo(() => {
    const groups = new Map<string, { label: string; date: Date; items: HistoryTx[] }>()

    for (const tx of filteredTransactions) {
      const date = parseTxDate(tx.date)
      const key = getLocalDateString(date)
      if (!groups.has(key)) {
        groups.set(key, { label: formatDateLabel(date), date, items: [] })
      }
      groups.get(key)!.items.push(tx)
    }

    return Array.from(groups.entries())
      .sort((a, b) => b[1].date.getTime() - a[1].date.getTime())
      .map(([key, value]) => ({ key, ...value }))
  }, [filteredTransactions])

  const totals = useMemo(() => {
    let income = 0
    let expenses = 0
    for (const tx of filteredTransactions) {
      if (tx.isTransfer || isExcludedFromRealIncome(tx.metadata)) continue
      if (tx.type === "income") income += tx.amount
      else expenses += tx.amount
    }
    return { income, expenses, net: income - expenses }
  }, [filteredTransactions])

  const openEdit = (txId: string) => {
    const tx = transactions.find((item) => item.id === txId)
    if (!tx) return
    if (tx.isTransfer || tx.isCommission || tx.metadata?.kind === "credit_payment" || tx.metadata?.kind === "credit_card_income") {
      notify({ title: "No se puede editar", message: "Los pagos y transferencias no se pueden editar directamente. Elimínalo y vuelve a registrarlo." })
      return
    }
    setEditingId(txId)
    setEditAmount(String(tx.amount))
    setEditDescription(tx.title === "Sin descripción" ? "" : tx.title)
    setEditType(tx.type)
    setEditAccountId(tx.accountId)
    setEditDate(getLocalDateString(parseTxDate(tx.date)))
    setEditCategoryId(tx.categoryId)
    setOpenSwipeId(null)
    setSwipeOffset(null)
  }

  const saveEdit = async () => {
    if (!editingId || !editAccountId || !editAmount || !editDate) return
    const amount = parseFloat(editAmount)
    if (!amount || amount <= 0) return

    try {
      await updateTransaction(editingId, {
        account_id: editAccountId,
        type: editType,
        amount,
        description: editDescription || null,
        date: editDate,
        category_id: editCategoryId,
        notes: null,
        currency: "DOP",
        amount_base: amount,
        exchange_rate: 1,
        is_recurring: false,
      })
      notify({ title: "Transacción actualizada", message: "La transacción fue editada correctamente." })
      EventBus.emit({ type: "transaction_updated" })
      setEditingId(null)
    } catch {
      notify({ title: "Error", message: "No se pudo editar la transacción." })
    }
  }

  const confirmDelete = async () => {
    if (!deletingId) return
    try {
      await deleteTransaction(deletingId)
      notify({ title: "Transacción eliminada", message: "La transacción fue eliminada correctamente." })
      EventBus.emit({ type: "transaction_deleted" })
      setDeletingId(null)
      setOpenSwipeId(null)
      setSwipeOffset(null)
    } catch {
      notify({ title: "Error", message: "No se pudo eliminar la transacción." })
    }
  }

  const selectedAccountLabel = accountFilter === "all" ? "Todas" : accounts.find((a) => a.id === accountFilter)?.name || "Todas"

  const filteredAccounts = accounts.filter((account) => account.name.toLowerCase().includes(accountSearch.toLowerCase().trim()))

  return (
    <MobilePageShell fullBleed className="pb-nav-safe">
      <header className="px-6 pb-4 pt-8">
        <p className="section-kicker">Actividad</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-foreground">Historial</h1>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">Revisa el pulso de tu dinero y encuentra cualquier movimiento.</p>
        <div className="relative mt-5 overflow-hidden rounded-[1.8rem] border border-border/70 bg-card shadow-[var(--shadow-soft)]">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/[0.06] via-transparent to-transparent" />
          <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-accent/[0.04] blur-2xl" />
          <div className="relative px-5 py-5">
            <p className="section-kicker">Balance del filtro</p>
            <p className={cn("mt-1 text-2xl font-black tabular-nums tracking-tight text-foreground truncate", totals.net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
              {totals.net >= 0 ? "+" : "-"}{formatCurrency(Math.abs(totals.net))}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-muted/60 p-3 min-w-0">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-[0.6875rem] font-semibold text-muted-foreground truncate">Ingresos</span>
                </div>
                <p className="mt-1 text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400 truncate">+{formatCurrency(totals.income)}</p>
              </div>
              <div className="rounded-2xl bg-muted/60 p-3 min-w-0">
                <div className="flex items-center gap-1.5">
                  <TrendingDown className="h-3.5 w-3.5 shrink-0 text-red-600 dark:text-red-400" />
                  <span className="text-[0.6875rem] font-semibold text-muted-foreground truncate">Gastos</span>
                </div>
                <p className="mt-1 text-base font-bold tabular-nums text-red-600 dark:text-red-400 truncate">-{formatCurrency(totals.expenses)}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="px-6 pt-2">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar transacciones..."
              className="h-12 w-full rounded-2xl border border-border/60 bg-card/78 pl-11 pr-4 text-sm text-foreground shadow-sm outline-none backdrop-blur placeholder:text-muted-foreground/50 focus:border-ring focus:ring-2 focus:ring-ring/25"
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery("")} className="absolute right-4 top-1/2 -translate-y-1/2">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
          <button type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={cn("tap-lift flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm transition-colors", showFilters ? "bg-primary text-primary-foreground shadow-[var(--shadow-lift)]" : "bg-card/78 text-foreground ring-1 ring-border/60")}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="mx-6 mt-4 space-y-4 rounded-[1.45rem] border border-border/60 bg-card/76 p-4 shadow-sm backdrop-blur">
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Fecha</p>
            <div className="grid grid-cols-4 gap-2">
              {[
                { value: "today", label: "Hoy" },
                { value: "week", label: "Esta semana" },
                { value: "month", label: "Este mes" },
                { value: "custom", label: "Personalizado" },
              ].map((option) => (
                <button type="button"
                  key={option.value}
                  onClick={() => setDatePreset(option.value as DatePreset)}
                  className={cn("tap-lift rounded-xl px-2 py-2 text-[0.6875rem] font-bold transition-colors", datePreset === option.value ? "bg-primary text-primary-foreground" : "bg-background/70 text-foreground")}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input type="date" value={startDate} onChange={(e) => { setDatePreset("custom"); setStartDate(e.target.value) }} className="h-11 rounded-xl border border-input bg-card px-3 text-sm" />
              <input type="date" value={endDate} onChange={(e) => { setDatePreset("custom"); setEndDate(e.target.value) }} className="h-11 rounded-xl border border-input bg-card px-3 text-sm" />
            </div>
          </div>

          <div className="relative" data-account-menu="true">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Cuenta</p>
            <button type="button"
              onClick={() => setAccountMenuOpen((prev) => !prev)}
              className="flex h-11 w-full items-center justify-between rounded-xl border border-input bg-card px-3 text-sm"
            >
              <span className="truncate">{selectedAccountLabel}</span>
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", accountMenuOpen && "rotate-180")} />
            </button>

            {accountMenuOpen && (
              <div className="absolute z-20 mt-2 w-full rounded-xl border border-border bg-popover p-2 shadow-lg">
                <div className="relative mb-2">
                  <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={accountSearch}
                    onChange={(e) => setAccountSearch(e.target.value)}
                    placeholder="Buscar cuenta..."
                    className="h-9 w-full rounded-lg border border-input bg-background pl-7 pr-2 text-xs"
                  />
                </div>
                <div className="max-h-44 space-y-1 overflow-y-auto">
                  <button type="button"
                    onClick={() => {
                      setAccountFilter("all")
                      setAccountMenuOpen(false)
                    }}
                    className={cn("w-full rounded-lg px-2 py-2 text-left text-xs", accountFilter === "all" ? "bg-primary/10 text-primary" : "hover:bg-muted")}
                  >
                    Todas
                  </button>
                  {filteredAccounts.map((account) => (
                    <button type="button"
                      key={account.id}
                      onClick={() => {
                        setAccountFilter(account.id)
                        setAccountMenuOpen(false)
                      }}
                      className={cn("w-full rounded-lg px-2 py-2 text-left text-xs", accountFilter === account.id ? "bg-primary/10 text-primary" : "hover:bg-muted")}
                    >
                      {account.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-6 px-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Transacciones</h2>
          <span className="text-xs text-muted-foreground">{filteredTransactions.length} resultados</span>
        </div>

        <div className="motion-list mt-4 space-y-4">
          {groupedTransactions.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">No se encontraron transacciones</p>
            </div>
          ) : (
            groupedTransactions.map((group) => (
              <div key={group.key} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</p>

                {group.items.map((tx) => {
                  const CategoryIcon = categoryIcons[tx.category] || categoryIcons.other
                  const account = accounts.find((a) => a.id === tx.accountId)
                  const AccountIcon = account ? accountIcons[account.type] : Banknote
                  const isOpen = openSwipeId === tx.id
                  const currentOffset = swipeOffset?.id === tx.id ? swipeOffset.offset : isOpen ? -108 : 0

                  return (
                    <div key={tx.id} data-history-row="true" className="relative overflow-hidden rounded-[1.35rem]">
                      <div className="absolute inset-y-0 right-0 flex w-28 items-center justify-end gap-1 pr-2">
                        <button type="button"
                          aria-label="Editar transacción"
                          onClick={() => openEdit(tx.id)}
                          className="tap-lift flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-foreground"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button type="button"
                          aria-label="Eliminar transacción"
                          onClick={() => setDeletingId(tx.id)}
                          className="tap-lift flex h-10 w-10 items-center justify-center rounded-xl bg-destructive text-destructive-foreground"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div
                        className="relative z-10 rounded-[1.35rem] border border-border/55 bg-card p-4 shadow-sm transition-transform duration-200 ease-[var(--ease-out-ios)]"
                        style={{ transform: `translateX(${currentOffset}px)` }}
                        onPointerDown={(event) => {
                          const target = event.target as HTMLElement
                          if (target.closest("button") || target.closest("a")) return
                          pointerRef.current = {
                            id: tx.id,
                            startX: event.clientX,
                            startY: event.clientY,
                            swiping: false,
                          }
                        }}
                        onPointerMove={(event) => {
                          const pointer = pointerRef.current
                          if (!pointer || pointer.id !== tx.id) return

                          const dx = event.clientX - pointer.startX
                          const dy = event.clientY - pointer.startY
                          if (Math.abs(dx) <= Math.abs(dy) || (dx >= 0 && !isOpen)) return

                          pointer.swiping = true
                          setOpenSwipeId(tx.id)
                          const base = isOpen ? -108 : 0
                          setSwipeOffset({ id: tx.id, offset: Math.min(0, Math.max(-108, base + dx)) })
                        }}
                        onPointerUp={() => {
                          const pointer = pointerRef.current
                          if (!pointer || pointer.id !== tx.id) return
                          if (pointer.swiping) {
                            const finalOffset = swipeOffset?.id === tx.id ? swipeOffset.offset : 0
                            if (finalOffset < -54) {
                              setOpenSwipeId(tx.id)
                              setSwipeOffset({ id: tx.id, offset: -108 })
                            } else {
                              setOpenSwipeId(null)
                              setSwipeOffset(null)
                            }
                          }
                          pointerRef.current = null
                        }}
                        onPointerCancel={() => {
                          pointerRef.current = null
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn("mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full", categoryColors[tx.category] || categoryColors.other)}>
                            <CategoryIcon className="h-4 w-4" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <p className="truncate text-sm font-medium text-foreground">{tx.title}</p>
                                  {tx.metadata?.kind === "offline_pending" && (
                                    <span className={cn(
                                      "inline-flex items-center rounded-full px-1.5 py-0.5 text-[0.5rem] font-extrabold uppercase tracking-wide border shrink-0",
                                      tx.metadata.sync_status === "failed"
                                        ? "bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/50"
                                        : tx.metadata.sync_status === "syncing"
                                          ? "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/50 animate-pulse"
                                          : "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50"
                                    )}>
                                      {tx.metadata.sync_status === "failed"
                                        ? "Error"
                                        : tx.metadata.sync_status === "syncing"
                                          ? "Subiendo..."
                                          : "Pendiente"}
                                    </span>
                                  )}
                                </div>
                                <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                                  <AccountIcon className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{account?.name || "Cuenta"}</span>
                                  <span>·</span>
                                  <span className="truncate">{tx.categoryName}</span>
                                </div>
                                {tx.metadata?.kind === "credit_card_income" && (
                                  <span className="mt-2 inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-[0.625rem] font-semibold text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                                    {creditCardIncomeLabels[String(tx.metadata.movement_kind || "")] || "Movimiento positivo de tarjeta"}
                                  </span>
                                )}
                                {tx.metadata?.kind === "offline_pending" && tx.metadata?.sync_status === "failed" && tx.metadata?.last_error && (
                                  <p className="mt-1 text-[0.625rem] font-medium text-red-600 dark:text-red-400">
                                    Error: {tx.metadata.last_error}
                                  </p>
                                )}
                              </div>

                              <div className="shrink-0 text-right">
                                <p className={cn("text-xl font-bold tabular-nums", tx.type === "income" ? "text-emerald-600 dark:text-emerald-400" : tx.isCommission ? "text-amber-700 dark:text-amber-400" : "text-foreground")}>
                                  {tx.type === "income" ? "+" : "-"}
                                  {formatCurrency(tx.amount, tx.currency)}
                                </p>
                                <p className="mt-1 text-[0.6875rem] text-muted-foreground">{formatTime(tx.date, tx.createdAt)}</p>
                              </div>
                            </div>

                            {tx.isCommission && (
                              <span className="mt-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[0.625rem] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Comisión 0.15%</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>
      </div>

      {editingId && (
        <BaseModalForm title="Editar transacción" onClose={() => setEditingId(null)} footer={<Button onClick={saveEdit} className="h-12 w-full">Guardar cambios</Button>}>
          <div className="space-y-3 pt-2">
            <input className="w-full rounded-xl border bg-background px-3 py-3" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Descripción" />
            <MoneyInput className="w-full rounded-xl border bg-background px-3 py-3" value={editAmount} onValueChange={setEditAmount} placeholder="Monto" />
            <input className="w-full rounded-xl border bg-background px-3 py-3" type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
            <select className="w-full rounded-xl border bg-background px-3 py-3" value={editType} onChange={(e) => setEditType(e.target.value as "income" | "expense")}> 
              <option value="income">Ingreso</option>
              <option value="expense">Gasto</option>
            </select>
            <select className="w-full rounded-xl border bg-background px-3 py-3" value={editAccountId} onChange={(e) => setEditAccountId(e.target.value)}>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          </div>
        </BaseModalForm>
      )}

      {deletingId && (
        <BaseModalForm
          title="Eliminar transacción"
          onClose={() => setDeletingId(null)}
          footer={
            <div className="space-y-2">
              <Button variant="destructive" onClick={confirmDelete} className="h-12 w-full">Confirmar eliminación</Button>
              <Button variant="outline" onClick={() => setDeletingId(null)} className="h-12 w-full">Cancelar</Button>
            </div>
          }
        >
          <p className="pt-2 text-sm text-muted-foreground">Esta acción revertirá el impacto en el balance de la cuenta asociada.</p>
        </BaseModalForm>
      )}
    </MobilePageShell>
  )
}
