"use client"

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { Search, SlidersHorizontal, TrendingDown, TrendingUp, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { notify } from "@/lib/notifications"
import { useAccounts, useTransactions } from "@/hooks/use-data"
import { mutate } from "swr"
import { EditTransactionSheet, TransactionRow, TransactionGroup } from "@/components/transactions"
import type { TransactionRowData } from "@/components/transactions"
import { FilterSlideUpShell, HistoryFilterContent } from "@/components/filters"
import type { HistoryFilterValues } from "@/components/filters"
import { useUndoDelete } from "@/hooks/use-undo-delete"
import { usePersistentState } from "@/hooks/use-persistent-state"
import { formatCurrency, getLocalDateString } from "@/lib/data"
import { isExcludedFromRealIncome } from "@/lib/transactions/reporting"
import { MobilePageShell } from "@/components/ui/mobile-foundation"
import type { Transaction } from "@/lib/types/database"

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
  const initialMonthRange = useMemo(() => {
    const now = new Date()
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
    return { start: getLocalDateString(from), end: getLocalDateString(now) }
  }, [])
  const [startDate, setStartDate] = usePersistentState<string>("history:startDate", initialMonthRange.start)
  const [endDate, setEndDate] = usePersistentState<string>("history:endDate", initialMonthRange.end)
  const [amountMin, setAmountMin] = useState("")
  const [amountMax, setAmountMax] = useState("")
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all")
  const [filterModalOpen, setFilterModalOpen] = useState(false)

  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { pending: undoPending, deleteWithUndo, undo } = useUndoDelete(() => {
    mutate((key: any) => Array.isArray(key) && key[0] === "transactions")
    mutate("accounts")
  })

  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null)
  const [swipeOffset, setSwipeOffset] = useState<{ id: string; offset: number } | null>(null)
  const pointerRef = useRef<{ id: string; startX: number; startY: number; swiping: boolean } | null>(null)

  const { data: rawAccounts = [] } = useAccounts()
  const { data: rawTransactions = [] } = useTransactions(300)

  const accounts = useMemo(
    () => rawAccounts.map((acc) => ({ id: acc.id, name: acc.name, type: acc.type })),
    [rawAccounts]
  )

  const transactions = useMemo<HistoryTx[]>(
    () =>
      rawTransactions.map((tx) => ({
        id: tx.id,
        accountId: tx.account_id,
        categoryId: tx.category_id,
        title: tx.description || "Sin descripción",
        category: tx.category?.icon || "other",
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
      if (target?.closest("[data-tx-row='true']")) return
      setOpenSwipeId(null)
      setSwipeOffset(null)
    }
    document.addEventListener("pointerdown", closeOnOutside)
    return () => document.removeEventListener("pointerdown", closeOnOutside)
  }, [])

  const filteredTransactions = useMemo(() => {
    const search = deferredSearchQuery.trim().toLowerCase()
    const min = amountMin ? parseFloat(amountMin) : 0
    const max = amountMax ? parseFloat(amountMax) : Infinity
    return transactions
      .filter((tx) => {
        if (search && !tx.title.toLowerCase().includes(search)) return false
        if (accountFilter !== "all" && tx.accountId !== accountFilter) return false
        if (filterType !== "all" && tx.type !== filterType) return false
        if (min > 0 && tx.amount < min) return false
        if (max < Infinity && tx.amount > max) return false
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
  }, [transactions, deferredSearchQuery, accountFilter, startDate, endDate, amountMin, amountMax, filterType])

  const groupedTransactions = useMemo(() => {
    const groups = new Map<string, { label: string; date: Date; items: HistoryTx[] }>()
    for (const tx of filteredTransactions) {
      const date = parseTxDate(tx.date)
      const key = getLocalDateString(date)
      if (!groups.has(key)) groups.set(key, { label: formatDateLabel(date), date, items: [] })
      groups.get(key)!.items.push(tx)
    }
    return Array.from(groups.entries())
      .sort((a, b) => b[1].date.getTime() - a[1].date.getTime())
      .map(([key, value]) => ({ key, ...value }))
  }, [filteredTransactions])

  const totals = useMemo(() => {
    let income = 0, expenses = 0
    for (const tx of filteredTransactions) {
      if (tx.isTransfer || isExcludedFromRealIncome(tx.metadata)) continue
      if (tx.type === "income") income += tx.amount; else expenses += tx.amount
    }
    return { income, expenses, net: income - expenses }
  }, [filteredTransactions])

  const openEdit = (txId: string) => {
    const rawTx = rawTransactions.find((item) => item.id === txId)
    if (!rawTx) return
    setEditingTx(rawTx)
    setOpenSwipeId(null)
    setSwipeOffset(null)
  }

  const confirmDelete = async () => {
    if (!deletingId) return
    try {
      const { deleteTransaction } = await import("@/hooks/use-data")
      await deleteWithUndo(deletingId, async () => {
        await deleteTransaction(deletingId)
        setDeletingId(null)
        setOpenSwipeId(null)
        setSwipeOffset(null)
      })
    } catch (err) {
      console.error("Delete error:", err)
      notify({ title: "Error", message: "No se pudo eliminar la transacción." })
    }
  }

  const makeSwipeHandlers = (txId: string) => ({
    isOpen: openSwipeId === txId,
    offset: swipeOffset?.id === txId ? swipeOffset.offset : openSwipeId === txId ? -108 : 0,
    onPointerDown: (event: React.PointerEvent) => {
      const target = event.target as HTMLElement
      if (target.closest("button") || target.closest("a")) return
      pointerRef.current = { id: txId, startX: event.clientX, startY: event.clientY, swiping: false }
    },
    onPointerMove: (event: React.PointerEvent) => {
      const pointer = pointerRef.current
      if (!pointer || pointer.id !== txId) return
      const dx = event.clientX - pointer.startX
      const dy = event.clientY - pointer.startY
      if (Math.abs(dx) <= Math.abs(dy) || (dx >= 0 && openSwipeId !== txId)) return
      pointer.swiping = true
      setOpenSwipeId(txId)
      const base = openSwipeId === txId ? -108 : 0
      setSwipeOffset({ id: txId, offset: Math.min(0, Math.max(-108, base + dx)) })
    },
    onPointerUp: () => {
      const pointer = pointerRef.current
      if (!pointer || pointer.id !== txId) return
      if (pointer.swiping) {
        const finalOffset = swipeOffset?.id === txId ? swipeOffset.offset : 0
        if (finalOffset < -54) { setOpenSwipeId(txId); setSwipeOffset({ id: txId, offset: -108 }) }
        else { setOpenSwipeId(null); setSwipeOffset(null) }
      }
      pointerRef.current = null
    },
    onPointerCancel: () => { pointerRef.current = null },
  })

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
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-muted/60 p-3 min-w-0">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-[0.6875rem] font-semibold text-muted-foreground text-reflow-1">Ingresos</span>
                </div>
                <p className="mt-1 amount-fluid font-bold tabular-nums text-income">{formatCurrency(totals.income)}</p>
              </div>
              <div className="rounded-2xl bg-muted/60 p-3 min-w-0">
                <div className="flex items-center gap-1.5">
                  <TrendingDown className="h-3.5 w-3.5 shrink-0 text-red-600 dark:text-red-400" />
                  <span className="text-[0.6875rem] font-semibold text-muted-foreground text-reflow-1">Gastos</span>
                </div>
                <p className="mt-1 amount-fluid font-bold tabular-nums text-expense">-{formatCurrency(totals.expenses)}</p>
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
            onClick={() => setFilterModalOpen(true)}
            className={cn("tap-lift flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm transition-colors shrink-0", "bg-card/78 text-foreground ring-1 ring-border/60")}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      <FilterSlideUpShell<HistoryFilterValues>
        isOpen={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        initialFilters={{
          dateRange: { from: startDate, to: endDate },
          amountMin,
          amountMax,
          filterType,
          accountId: accountFilter,
        }}
        onApply={(values) => {
          setStartDate(values.dateRange.from)
          setEndDate(values.dateRange.to)
          setAmountMin(values.amountMin)
          setAmountMax(values.amountMax)
          setFilterType(values.filterType)
          setAccountFilter(values.accountId)
        }}
        title="Filtrar historial"
      >
        <HistoryFilterContent accounts={accounts} />
      </FilterSlideUpShell>

      <div className="mt-6 px-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Transacciones</h2>
          <span className="text-xs text-muted-foreground">{filteredTransactions.length} resultados</span>
        </div>

        <div className="motion-list mt-4 flex flex-col gap-4">
          {groupedTransactions.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">No se encontraron transacciones</p>
            </div>
          ) : (
            groupedTransactions.map((group) => (
              <TransactionGroup key={group.key} label={group.label}>
                {group.items.map((tx) => {
                  const account = accounts.find((a) => a.id === tx.accountId)
                  const row: TransactionRowData = {
                    id: tx.id,
                    title: tx.title,
                    category: tx.category,
                    categoryName: tx.categoryName,
                    amount: tx.amount,
                    type: tx.type,
                    currency: tx.currency,
                    accountName: account?.name || "Cuenta",
                    accountType: account?.type || "cash",
                    time: formatTime(tx.date, tx.createdAt),
                    isCommission: tx.isCommission,
                    isTransfer: tx.isTransfer,
                    metadata: tx.metadata,
                  }

                  return (
                    <TransactionRow
                      key={tx.id}
                      tx={row}
                      showCategory
                      actions={{ onEdit: () => openEdit(tx.id), onDelete: () => setDeletingId(tx.id) }}
                      swipe={makeSwipeHandlers(tx.id)}
                    />
                  )
                })}
              </TransactionGroup>
            ))
          )}
        </div>
      </div>

      <EditTransactionSheet
        open={!!editingTx}
        onOpenChange={(open) => { if (!open) setEditingTx(null) }}
        transaction={editingTx}
      />

      {deletingId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl">
            <h3 className="text-lg font-bold text-foreground">Eliminar transacción</h3>
            <p className="mt-2 text-sm text-muted-foreground">Esta acción revertirá el impacto en el balance de la cuenta asociada. Puedes deshacerla dentro de los próximos 10 segundos.</p>
            <div className="mt-6 flex flex-col gap-2">
              <Button variant="destructive" onClick={confirmDelete} className="h-12 w-full">Confirmar eliminación</Button>
              <Button variant="outline" onClick={() => setDeletingId(null)} className="h-12 w-full">Cancelar</Button>
            </div>
          </div>
        </div>
      )}

      {undoPending && (
        <div className="fixed bottom-20 left-4 right-4 z-[110] animate-slide-up">
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 shadow-lg backdrop-blur-md">
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Transacción eliminada</p>
              <p className="text-xs text-muted-foreground">Deshacer en {undoPending.count}s</p>
            </div>
            <Button variant="default" size="sm" onClick={async () => { await undo() }} disabled={false} className="shrink-0">
              Deshacer
            </Button>
          </div>
        </div>
      )}
    </MobilePageShell>
  )
}
