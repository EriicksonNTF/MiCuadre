"use client"

import { useState, useMemo } from "react"
import {
  Search,
  SlidersHorizontal,
  X,
  ChevronDown,
  Utensils,
  Car,
  Zap,
  Film,
  ShoppingBag,
  Heart,
  GraduationCap,
  Plane,
  MoreHorizontal,
  Banknote,
  Building2,
  CreditCard,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  Calendar,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { BaseModalForm } from "@/components/ui/base-modal-form"
import { notify } from "@/lib/notifications"
import { EventBus } from "@/lib/event-bus"
import { useAccounts, useTransactions, updateTransaction, deleteTransaction } from "@/hooks/use-data"
import { formatCurrency, formatDate } from "@/lib/data"
import type { AccountType } from "@/lib/types/database"


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
  food: "bg-orange-100 text-orange-600",
  transport: "bg-blue-100 text-blue-600",
  utilities: "bg-yellow-100 text-yellow-600",
  entertainment: "bg-purple-100 text-purple-600",
  shopping: "bg-pink-100 text-pink-600",
  health: "bg-red-100 text-red-600",
  education: "bg-indigo-100 text-indigo-600",
  travel: "bg-cyan-100 text-cyan-600",
  income: "bg-emerald-100 text-emerald-600",
  other: "bg-gray-100 text-gray-600",
}

const accountIcons: Record<AccountType, typeof Banknote> = {
  cash: Banknote,
  debit: Building2,
  credit: CreditCard,
}

type TransactionType = "all" | "income" | "expense"
type DateRange = "today" | "week" | "month" | "all"

export function HistoryScreen() {
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<TransactionType>("all")
  const [accountFilter, setAccountFilter] = useState<string>("all")
  const [dateFilter, setDateFilter] = useState<DateRange>("month")
  const [showFilters, setShowFilters] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editType, setEditType] = useState<"income" | "expense">("expense")
  const [editAccountId, setEditAccountId] = useState("")
  const [editDate, setEditDate] = useState("")
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null)
  const { data: rawAccounts = [] } = useAccounts()

  const { data: rawTransactions = [] } = useTransactions(100)

  const nameToSlug: Record<string, string> = {
    'Comida': 'food',
    'Transporte': 'transport',
    'Entretenimiento': 'entertainment',
    'Compras': 'shopping',
    'Servicios': 'utilities',
    'Salud': 'health',
    'Educacion': 'education',
    'Hogar': 'other',
    'Supermercado': 'shopping',
    'Suscripciones': 'utilities',
    'Otros Gastos': 'other',
    'Salario': 'income',
    'Freelance': 'income',
    'Inversiones': 'income',
    'Regalos': 'other',
    'Reembolsos': 'income',
    'Otros Ingresos': 'income',
  }

  const accounts = useMemo(() => {
    return rawAccounts.map(acc => ({
      id: acc.id,
      name: acc.name,
      type: acc.type,
      balance: acc.balance,
      currency: acc.currency,
      creditLimit: acc.credit_limit,
      currentDebt: acc.current_debt,
      cutoffDate: acc.closing_date,
      dueDate: acc.due_date,
    }))
  }, [rawAccounts])

  const transactions = useMemo(() => {
    return rawTransactions.map(tx => ({
      id: tx.id,
      accountId: tx.account_id,
      categoryId: tx.category_id,
      title: tx.description || "Sin descripción",
      category: nameToSlug[tx.category?.name || ""] || "other",
      amount: tx.amount,
      type: tx.type,
      date: tx.date,
      currency: tx.currency,
      notes: tx.notes,
      amount_base: tx.amount_base,
      exchange_rate: tx.exchange_rate,
      is_recurring: tx.is_recurring,
    }))
  }, [rawTransactions])


  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Search filter
      if (searchQuery && !tx.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false
      }
      // Type filter
      if (typeFilter !== "all" && tx.type !== typeFilter) {
        return false
      }
      // Account filter
      if (accountFilter !== "all" && tx.accountId !== accountFilter) {
        return false
      }
      return true
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [searchQuery, typeFilter, accountFilter, dateFilter])

  const openEdit = (txId: string) => {
    const tx = transactions.find((item) => item.id === txId)
    if (!tx) return
    setEditingId(txId)
    setEditAmount(String(tx.amount))
    setEditDescription(tx.title === "Sin descripción" ? "" : tx.title)
    setEditType(tx.type)
    setEditAccountId(tx.accountId)
    setEditDate(new Date(tx.date).toISOString().slice(0, 10))
    setEditCategoryId(tx.categoryId)
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
        date: new Date(`${editDate}T12:00:00`).toISOString(),
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
    } catch (error) {
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
    } catch {
      notify({ title: "Error", message: "No se pudo eliminar la transacción." })
    }
  }

  const totalIncome = filteredTransactions
    .filter((tx) => tx.type === "income")
    .reduce((sum, tx) => sum + tx.amount, 0)

  const totalExpenses = filteredTransactions
    .filter((tx) => tx.type === "expense")
    .reduce((sum, tx) => sum + tx.amount, 0)

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <header className="px-6 pb-4 pt-8">
        <h1 className="text-2xl font-bold text-foreground">Historial</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Todas tus transacciones
        </p>
      </header>

      {/* Search Bar */}
      <div className="px-6 pt-2">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar transacciones..."
              className="h-12 w-full rounded-2xl bg-card pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-2xl transition-colors",
              showFilters ? "bg-primary text-primary-foreground" : "bg-card text-foreground"
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="mt-4 space-y-4 px-6">
          {/* Type Filter */}
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Tipo</p>
            <div className="flex gap-2">
              {[
                { value: "all", label: "Todos", icon: ArrowUpDown },
                { value: "income", label: "Ingresos", icon: TrendingUp },
                { value: "expense", label: "Gastos", icon: TrendingDown },
              ].map((option) => {
                const Icon = option.icon
                return (
                  <button
                    key={option.value}
                    onClick={() => setTypeFilter(option.value as TransactionType)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-medium transition-colors",
                      typeFilter === option.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-card text-foreground"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Account Filter */}
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Cuenta</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setAccountFilter("all")}
                className={cn(
                  "rounded-xl px-4 py-2.5 text-xs font-medium transition-colors",
                  accountFilter === "all"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-foreground"
                )}
              >
                Todas
              </button>
              {accounts.map((account) => {
                const Icon = accountIcons[account.type]
                return (
                  <button
                    key={account.id}
                    onClick={() => setAccountFilter(account.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium transition-colors",
                      accountFilter === account.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-card text-foreground"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {account.name}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Date Filter */}
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Período</p>
            <div className="flex gap-2">
              {[
                { value: "today", label: "Hoy" },
                { value: "week", label: "7 días" },
                { value: "month", label: "Este mes" },
                { value: "all", label: "Todo" },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setDateFilter(option.value as DateRange)}
                  className={cn(
                    "flex-1 rounded-xl px-3 py-2.5 text-xs font-medium transition-colors",
                    dateFilter === option.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-foreground"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="mt-6 flex gap-3 px-6">
        <div className="flex-1 rounded-2xl bg-card p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
            <span className="text-xs text-muted-foreground">Ingresos</span>
          </div>
          <p className="mt-2 text-lg font-bold text-emerald-600">
            +{formatCurrency(totalIncome)}
          </p>
        </div>
        <div className="flex-1 rounded-2xl bg-card p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
              <TrendingDown className="h-4 w-4 text-red-600" />
            </div>
            <span className="text-xs text-muted-foreground">Gastos</span>
          </div>
          <p className="mt-2 text-lg font-bold text-red-600">
            -{formatCurrency(totalExpenses)}
          </p>
        </div>
      </div>

      {/* Transaction List */}
      <div className="mt-6 px-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Transacciones
          </h2>
          <span className="text-xs text-muted-foreground">
            {filteredTransactions.length} resultados
          </span>
        </div>

        <div className="mt-4 space-y-2">
          {filteredTransactions.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">
                No se encontraron transacciones
              </p>
            </div>
          ) : (
            filteredTransactions.map((tx) => {
              const CategoryIcon = categoryIcons[tx.category] || categoryIcons.other
              const account = accounts.find((a) => a.id === tx.accountId)
              const AccountIcon = account ? accountIcons[account.type] : Banknote

              return (
                <div
                  key={tx.id}
                  className="flex items-center gap-4 rounded-2xl bg-card p-4"
                >
                  {/* Category Icon */}
                  <div
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-full",
                      categoryColors[tx.category] || categoryColors.other
                    )}
                  >
                    <CategoryIcon className="h-5 w-5" />
                  </div>

                  {/* Transaction Details */}
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {tx.title}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <AccountIcon className="h-3 w-3" />
                        <span>{account?.name}</span>
                      </div>
                      <span>·</span>
                      <span>{formatDate(tx.date)}</span>
                    </div>
                  </div>

                  {/* Amount */}
                  <p
                    className={cn(
                      "font-semibold tabular-nums",
                      tx.type === "income"
                        ? "text-emerald-600"
                        : "text-foreground"
                    )}
                  >
                    {tx.type === "income" ? "+" : "-"}
                    {formatCurrency(tx.amount, tx.currency)}
                  </p>
                  <div className="ml-2 flex gap-2">
                    <button onClick={() => openEdit(tx.id)} className="text-xs text-muted-foreground">Editar</button>
                    <button onClick={() => setDeletingId(tx.id)} className="text-xs text-destructive">Eliminar</button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {editingId && (
        <BaseModalForm
          title="Editar transacción"
          onClose={() => setEditingId(null)}
          footer={<Button onClick={saveEdit} className="h-12 w-full">Guardar cambios</Button>}
        >
          <div className="space-y-3 pt-2">
            <input className="w-full rounded-xl border bg-background px-3 py-3" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Descripción" />
            <input className="w-full rounded-xl border bg-background px-3 py-3" inputMode="decimal" value={editAmount} onChange={(e) => setEditAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="Monto" />
            <input className="w-full rounded-xl border bg-background px-3 py-3" type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
            <select className="w-full rounded-xl border bg-background px-3 py-3" value={editType} onChange={(e) => setEditType(e.target.value as "income" | "expense")}>
              <option value="income">Ingreso</option>
              <option value="expense">Gasto</option>
            </select>
            <select className="w-full rounded-xl border bg-background px-3 py-3" value={editAccountId} onChange={(e) => setEditAccountId(e.target.value)}>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </select>
          </div>
        </BaseModalForm>
      )}

      {deletingId && (
        <BaseModalForm
          title="Eliminar transacción"
          onClose={() => setDeletingId(null)}
          footer={<Button variant="destructive" onClick={confirmDelete} className="h-12 w-full">Confirmar eliminación</Button>}
        >
          <p className="pt-2 text-sm text-muted-foreground">Esta acción revertirá el impacto en el balance de la cuenta asociada.</p>
        </BaseModalForm>
      )}
    </div>
  )
}
