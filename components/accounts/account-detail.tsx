"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import {
  ChevronLeft,
  Banknote,
  Building2,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Minus,
  Utensils,
  Car,
  Zap,
  Film,
  ShoppingBag,
  Heart,
  GraduationCap,
  Plane,
  MoreHorizontal,
  Calendar,
  AlertTriangle,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useAccounts, useTransactions } from "@/hooks/use-data"
import { formatCurrency, getAvailableCredit, formatDate } from "@/lib/data"
import type { AccountType } from "@/lib/types/database"


const accountIcons: Record<AccountType, typeof Banknote> = {
  cash: Banknote,
  debit: Building2,
  credit: CreditCard,
}

const accountGradients: Record<AccountType, string> = {
  cash: "from-emerald-500 to-emerald-600",
  debit: "from-blue-500 to-blue-600",
  credit: "from-orange-500 to-orange-600",
}

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

type DateRange = "week" | "month" | "all"

interface AccountDetailProps {
  accountId: string
}

export function AccountDetail({ accountId }: AccountDetailProps) {
  const [dateFilter, setDateFilter] = useState<DateRange>("month")
  const [showPayment, setShowPayment] = useState(false)
  const [paymentSource, setPaymentSource] = useState<string>("")
  const [paymentAmount, setPaymentAmount] = useState("")
  const [isPaying, setIsPaying] = useState(false)

  const { data: rawAccounts = [] } = useAccounts()
  const { data: rawTransactions = [] } = useTransactions(100)

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

  const account = accounts.find((a) => a.id === accountId)
  const Icon = account ? accountIcons[account.type] : Banknote

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

  const transactions = useMemo(() => {
    return rawTransactions.map(tx => ({
      id: tx.id,
      accountId: tx.account_id,
      title: tx.description || "Sin descripción",
      category: nameToSlug[tx.category?.name || ""] || "other",
      amount: tx.amount,
      type: tx.type,
      date: formatDate(tx.date),
    }))
  }, [rawTransactions])


  const accountTransactions = useMemo(() => {
    return transactions.filter((tx) => tx.accountId === accountId)
  }, [accountId])

  const monthlyIncome = accountTransactions
    .filter((tx) => tx.type === "income")
    .reduce((sum, tx) => sum + tx.amount, 0)

  const monthlyExpenses = accountTransactions
    .filter((tx) => tx.type === "expense")
    .reduce((sum, tx) => sum + tx.amount, 0)

  const netFlow = monthlyIncome - monthlyExpenses

  const handlePayment = async () => {
    if (!paymentSource || !paymentAmount) return
    setIsPaying(true)
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setIsPaying(false)
    setShowPayment(false)
    setPaymentSource("")
    setPaymentAmount("")
  }

  const parsedAmount = parseFloat(paymentAmount.replace(/[^0-9.]/g, "")) || 0
  const sourceAccount = accounts.find((a) => a.id === paymentSource)

  if (!account) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Cuenta no encontrada</p>
      </div>
    )
  }

  const isCredit = account.type === "credit"

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header with gradient */}
      <div
        className={cn(
          "bg-gradient-to-br px-6 pb-8 pt-8",
          accountGradients[account.type]
        )}
      >
        {/* Back button */}
        <Link
          href="/accounts"
          className="mb-6 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>

        {/* Account info */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
            <Icon className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-sm font-medium text-white/80">{account.name}</p>
            <p className="text-3xl font-bold text-white">
              {isCredit
                ? `-${formatCurrency(account.currentDebt || 0)}`
                : formatCurrency(account.balance)}
            </p>
          </div>
        </div>

        {/* Credit card specific info */}
        {isCredit && account.creditLimit && (
          <div className="mt-6 space-y-4">
            {/* Usage bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-white/80">
                <span>Disponible</span>
                <span className="font-semibold text-white">
                  {formatCurrency(getAvailableCredit(account))}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-white transition-all"
                  style={{
                    width: `${((account.currentDebt || 0) / account.creditLimit) * 100}%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-white/60">
                <span>Límite: {formatCurrency(account.creditLimit)}</span>
                <span>
                  {Math.round(((account.currentDebt || 0) / account.creditLimit) * 100)}% usado
                </span>
              </div>
            </div>

            {/* Billing dates */}
            <div className="flex gap-4 rounded-2xl bg-white/10 p-4">
              <div className="flex-1">
                <p className="text-xs text-white/60">Fecha de corte</p>
                <p className="mt-1 font-semibold text-white">
                  {account.cutoffDate} de cada mes
                </p>
              </div>
              <div className="w-px bg-white/20" />
              <div className="flex-1">
                <p className="text-xs text-white/60">Fecha de pago</p>
                <p className="mt-1 font-semibold text-white">
                  {account.dueDate} de cada mes
                </p>
              </div>
            </div>

            {/* Pay button */}
            <Button
              onClick={() => setShowPayment(true)}
              className="h-12 w-full rounded-2xl bg-white text-orange-600 hover:bg-white/90"
            >
              Pagar tarjeta
            </Button>
          </div>
        )}
      </div>

      {/* Summary Section */}
      <div className="px-6 pt-6">
        <h2 className="text-sm font-semibold text-foreground">Resumen del mes</h2>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-card p-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Ingresos</p>
            <p className="mt-1 font-semibold text-emerald-600">
              +{formatCurrency(monthlyIncome)}
            </p>
          </div>
          <div className="rounded-2xl bg-card p-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
              <TrendingDown className="h-4 w-4 text-red-600" />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Gastos</p>
            <p className="mt-1 font-semibold text-red-600">
              -{formatCurrency(monthlyExpenses)}
            </p>
          </div>
          <div className="rounded-2xl bg-card p-4">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full",
                netFlow >= 0 ? "bg-emerald-100" : "bg-red-100"
              )}
            >
              <Minus
                className={cn(
                  "h-4 w-4",
                  netFlow >= 0 ? "text-emerald-600" : "text-red-600"
                )}
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Neto</p>
            <p
              className={cn(
                "mt-1 font-semibold",
                netFlow >= 0 ? "text-emerald-600" : "text-red-600"
              )}
            >
              {netFlow >= 0 ? "+" : ""}
              {formatCurrency(netFlow)}
            </p>
          </div>
        </div>
      </div>

      {/* Date Filter */}
      <div className="mt-6 px-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Movimientos</h2>
          <div className="flex gap-1 rounded-xl bg-card p-1">
            {[
              { value: "week", label: "7d" },
              { value: "month", label: "Mes" },
              { value: "all", label: "Todo" },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setDateFilter(option.value as DateRange)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  dateFilter === option.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Transaction List */}
        <div className="mt-4 space-y-2">
          {accountTransactions.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">
                No hay movimientos en esta cuenta
              </p>
            </div>
          ) : (
            accountTransactions.map((tx) => {
              const CategoryIcon = categoryIcons[tx.category] || categoryIcons.other

              return (
                <div
                  key={tx.id}
                  className="flex items-center gap-4 rounded-2xl bg-card p-4"
                >
                  <div
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-full",
                      categoryColors[tx.category] || categoryColors.other
                    )}
                  >
                    <CategoryIcon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {tx.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {tx.date}
                    </p>
                  </div>
                  <p
                    className={cn(
                      "font-semibold tabular-nums",
                      tx.type === "income"
                        ? "text-emerald-600"
                        : "text-foreground"
                    )}
                  >
                    {tx.type === "income" ? "+" : "-"}
                    {formatCurrency(tx.amount)}
                  </p>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {showPayment && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-3xl bg-card p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                Pagar tarjeta
              </h2>
              <button
                onClick={() => setShowPayment(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Current debt */}
            <div className="mt-4 rounded-2xl bg-orange-50 p-4">
              <p className="text-xs text-orange-600">Deuda actual</p>
              <p className="mt-1 text-2xl font-bold text-orange-600">
                {formatCurrency(account.currentDebt || 0)}
              </p>
            </div>

            <div className="mt-6 space-y-4">
              {/* Source Account */}
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Pagar desde
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {accounts
                    .filter((a) => a.type !== "credit")
                    .map((acc) => {
                      const AccIcon = accountIcons[acc.type]
                      const isSelected = paymentSource === acc.id
                      return (
                        <button
                          key={acc.id}
                          onClick={() => setPaymentSource(acc.id)}
                          className={cn(
                            "flex flex-col items-center gap-1 rounded-xl p-4 transition-all",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-foreground"
                          )}
                        >
                          <AccIcon className="h-5 w-5" />
                          <span className="text-xs font-medium">{acc.name}</span>
                          <span className="text-[10px] opacity-70">
                            {formatCurrency(acc.balance)}
                          </span>
                        </button>
                      )
                    })}
                </div>
              </div>

              {/* Amount */}
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Monto a pagar
                </p>
                <div className="flex items-center gap-2 rounded-xl bg-muted p-4">
                  <span className="text-lg font-medium text-muted-foreground">
                    RD$
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={paymentAmount}
                    onChange={(e) =>
                      setPaymentAmount(e.target.value.replace(/[^0-9.]/g, ""))
                    }
                    placeholder="0"
                    className="flex-1 bg-transparent text-2xl font-bold text-foreground outline-none placeholder:text-muted-foreground/30"
                  />
                </div>
                {/* Quick amounts */}
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => setPaymentAmount(String(account.currentDebt || 0))}
                    className="flex-1 rounded-xl bg-muted px-3 py-2 text-xs font-medium text-foreground"
                  >
                    Pago total
                  </button>
                  <button
                    onClick={() => setPaymentAmount(String(Math.round((account.currentDebt || 0) / 2)))}
                    className="flex-1 rounded-xl bg-muted px-3 py-2 text-xs font-medium text-foreground"
                  >
                    50%
                  </button>
                  <button
                    onClick={() => setPaymentAmount(String(Math.round((account.currentDebt || 0) * 0.1)))}
                    className="flex-1 rounded-xl bg-muted px-3 py-2 text-xs font-medium text-foreground"
                  >
                    Mínimo
                  </button>
                </div>
              </div>

              {/* Warning if insufficient funds */}
              {sourceAccount && parsedAmount > sourceAccount.balance && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-red-600">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-xs">Fondos insuficientes</span>
                </div>
              )}

              {/* Confirm Button */}
              <Button
                onClick={handlePayment}
                disabled={
                  !paymentSource ||
                  parsedAmount <= 0 ||
                  (sourceAccount && parsedAmount > sourceAccount.balance) ||
                  isPaying
                }
                className="h-12 w-full rounded-2xl text-base font-semibold"
              >
                {isPaying ? "Procesando..." : `Pagar ${formatCurrency(parsedAmount)}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
