"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { mutate } from "swr"
import {
  ChevronLeft,
  Banknote,
  Building2,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Minus,
  CalendarDays,
  AlertTriangle,
  Settings,
  Trash2,
  Pencil,
  Search,
  ChevronDown,
  Lock,
  Info,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { BaseModalForm } from "@/components/ui/base-modal-form"
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { MoneyInput } from "@/components/ui/money-input"
import { AccountCarouselSelector } from "@/components/ui/account-carousel-selector"
import { notify } from "@/lib/notifications"
import { EventBus } from "@/lib/event-bus"
import { useAccounts, useTransactions, updateAccount, deleteAccount, getAccountDeletionImpact, payCreditCard, updateTransaction, deleteTransaction, calculateCreditCardPaymentAmounts, syncCreditAccountCycle } from "@/hooks/use-data"
import { usePersistentState } from "@/hooks/use-persistent-state"
import { formatCurrency, formatDate, getAccountBrandingDefaults, getAvailableCredit, getCurrencySymbol, getLocalDateString, getReadableTextColor } from "@/lib/data"
import { BrandedAccountCard } from "@/components/accounts/branded-account-card"
import { isReportableExpense, isReportableIncome } from "@/lib/transactions/reporting"
import type { AccountType, Currency } from "@/lib/types/database"
import type { Transaction } from "@/lib/types/database"
import { MobilePageShell } from "@/components/ui/mobile-foundation"
import { BANK_LOGO_OPTIONS, getBankLogoByKey } from "@/lib/bank-branding"
import { HoldToConfirmButton } from "@/components/ui/hold-to-confirm-button"
import { EditTransactionSheet, TransactionRow, TransactionGroup } from "@/components/transactions"
import type { TransactionRowData } from "@/components/transactions"
import { useUndoDelete } from "@/hooks/use-undo-delete"


const accountIcons: Record<AccountType, typeof Banknote> = {
  cash: Banknote,
  debit: Building2,
  credit: CreditCard,
}

const DETAIL_ICON_PRESETS = [
  { value: "banknote", label: "Efectivo", icon: Banknote },
  { value: "building-2", label: "Banco", icon: Building2 },
  { value: "credit-card", label: "Tarjeta", icon: CreditCard },
  { value: "landmark", label: "Institución", icon: Building2 },
  { value: "piggy-bank", label: "Ahorro", icon: Banknote },
  { value: "wallet", label: "Billetera", icon: Banknote },
]

const DETAIL_COLOR_PRESETS = [
  { key: "banreservas", name: "Banreservas", primary: "#0b4a8a", secondary: "#38bdf8" },
  { key: "premium", name: "Premium", primary: "#07111f", secondary: "#1f2937" },
  { key: "emerald", name: "Emerald", primary: "#0f766e", secondary: "#14b8a6" },
  { key: "sky", name: "Sky", primary: "#0369a1", secondary: "#38bdf8" },
  { key: "purple", name: "Purple", primary: "#4338ca", secondary: "#8b5cf6" },
  { key: "orange", name: "Orange", primary: "#b45309", secondary: "#fb923c" },
  { key: "teal", name: "Teal", primary: "#0f766e", secondary: "#2dd4bf" },
  { key: "neutral", name: "Neutral", primary: "#334155", secondary: "#64748b" },
]

type DateRange = "week" | "month" | "all"

interface AccountDetailProps {
  accountId: string
}

export function AccountDetail({ accountId }: AccountDetailProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [dateFilter, setDateFilter] = usePersistentState<DateRange>(`account:${accountId}:dateFilter`, "all")
  const [txQuery, setTxQuery] = useState("")
  const [showPayment, setShowPayment] = useState(false)
  const [paymentCurrency, setPaymentCurrency] = useState<"DOP" | "USD">("DOP")
  const [paymentSource, setPaymentSource] = useState<string>("")
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentRate, setPaymentRate] = useState("")
  const [paymentComment, setPaymentComment] = useState("")
  const [paymentKind, setPaymentKind] = useState<"balance_to_date" | "statement_balance" | "minimum_payment" | "custom">("custom")
  const [isPaying, setIsPaying] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [deletingTxId, setDeletingTxId] = useState<string | null>(null)
  const [undoLoading, setUndoLoading] = useState(false)

  const { pending: undoPending, deleteWithUndo, undo } = useUndoDelete()
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null)
  const [swipeOffset, setSwipeOffset] = useState<{ id: string; offset: number } | null>(null)
  const pointerRef = useRef<{ id: string; startX: number; startY: number; swiping: boolean } | null>(null)

  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteImpact, setDeleteImpact] = useState<{ count: number; hasMovements: boolean } | null>(null)
  const [showSummaryPeriodMenu, setShowSummaryPeriodMenu] = useState(false)
  const [editForm, setEditForm] = useState<{ 
    name: string
    type: AccountType
    currency: Currency
    balance: string
    credit_limit: string
    credit_limit_dop: string
    credit_limit_usd: string
    closing_date: string
    due_date: string
    icon_url: string
    icon_type: "icon" | "image"
    icon_value: string
    account_number: string
    bank_name: string
    bank_logo_key: string
    bank_logo_url: string
    primary_color: string
    secondary_color: string
    background_style: string
  }>({ 
    name: "", 
    type: "debit", 
    currency: "DOP",
    balance: "",
    credit_limit: "",
    credit_limit_dop: "",
    credit_limit_usd: "",
    closing_date: "",
    due_date: "",
    icon_url: "",
    icon_type: "icon",
    icon_value: "building-2",
    account_number: "",
    bank_name: "",
    bank_logo_key: "none",
    bank_logo_url: "",
    primary_color: "#0b4a8a",
    secondary_color: "#38bdf8",
    background_style: "gradient",
  })
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState("")

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
      creditLimitDop: acc.credit_limit_dop,
      creditLimitUsd: acc.credit_limit_usd,
      currentDebt: acc.current_debt,
      currentDebtDop: acc.current_debt_dop,
      currentDebtUsd: acc.current_debt_usd,
      statementDop: acc.statement_balance_dop,
      statementUsd: acc.statement_balance_usd,
      paidStatementDop: acc.paid_statement_amount_dop,
      paidStatementUsd: acc.paid_statement_amount_usd,
      pendingTransitDop: acc.pending_transit_dop,
      pendingTransitUsd: acc.pending_transit_usd,
      available_credit_dop: acc.available_credit_dop,
      available_credit_usd: acc.available_credit_usd,
      financed_balance_dop: acc.financed_balance_dop,
      financed_balance_usd: acc.financed_balance_usd,
      statementDueDate: acc.statement_due_date,
      minimumPaymentPercentage: acc.minimum_payment_percentage,
      cutoffDate: acc.closing_date,
      dueDate: acc.due_date,
      cycleEndDate: acc.cycle_end_date,
    }))
  }, [rawAccounts])

  const account = accounts.find((a) => a.id === accountId)
  const hasUsdOnCard = Boolean(account && (Number(account.creditLimitUsd || 0) > 0 || Number(account.currentDebtUsd || 0) > 0 || Number(account.statementUsd || 0) > 0))

  const transactions = useMemo(() => {
    return rawTransactions.map(tx => ({
      id: tx.id,
      accountId: tx.account_id,
      categoryId: tx.category_id,
      title: tx.description || "Sin descripción",
      category: tx.category?.icon || "other",
      amount: tx.amount,
      currency: tx.currency,
      type: tx.type,
      rawDate: tx.date,
      date: formatDate(tx.date),
      createdAt: tx.created_at,
      metadata: tx.metadata as any,
    }))
  }, [rawTransactions])


  const accountTransactions = useMemo(() => {
    const now = new Date()
    return transactions.filter((tx) => {
      if (tx.accountId !== accountId) return false
      if (dateFilter === "all") return true
      const txDate = new Date(tx.rawDate)
      if (dateFilter === "week") {
        return now.getTime() - txDate.getTime() <= 7 * 24 * 60 * 60 * 1000
      }
      return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear()
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [accountId, dateFilter, transactions])

  const visibleTransactions = useMemo(() => {
    const query = txQuery.trim().toLowerCase()
    if (!query) return accountTransactions
    return accountTransactions.filter((tx) => {
      const amountText = String(tx.amount)
      return tx.title.toLowerCase().includes(query) || tx.category.toLowerCase().includes(query) || amountText.includes(query)
    })
  }, [accountTransactions, txQuery])

  useEffect(() => {
    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest("[data-account-tx-row='true']")) return
      setOpenSwipeId(null)
      setSwipeOffset(null)
    }

    document.addEventListener("pointerdown", closeOnOutside)
    return () => document.removeEventListener("pointerdown", closeOnOutside)
  }, [])

  const parseTxDate = (value: string) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T12:00:00`)
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? new Date(`${getLocalDateString()}T12:00:00`) : parsed
  }

  const groupedTransactions = useMemo(() => {
    const groups: Record<string, { label: string; date: Date; items: typeof visibleTransactions }> = {}
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    for (const tx of visibleTransactions) {
      const d = parseTxDate(tx.rawDate ?? tx.createdAt)
      const key = d.toDateString()
      if (!groups[key]) {
        let label
        if (key === today.toDateString()) label = "Hoy"
        else if (key === yesterday.toDateString()) label = "Ayer"
        else label = d.toLocaleDateString("es-DO", { day: "numeric", month: "long", year: "numeric" })
        groups[key] = { label, date: d, items: [] }
      }
      groups[key].items.push(tx)
    }

    const sorted = Object.values(groups).sort((a, b) => b.date.getTime() - a.date.getTime())
    for (const group of sorted) {
      group.items.sort((a, b) => {
        const da = new Date(a.rawDate ?? a.createdAt).getTime()
        const db = new Date(b.rawDate ?? b.createdAt).getTime()
        return db - da
      })
    }
    return sorted
  }, [visibleTransactions])

  const openEditTx = (txId: string) => {
    const rawTx = rawTransactions.find((item) => item.id === txId)
    if (!rawTx) return
    setEditingTx(rawTx)
    setOpenSwipeId(null)
    setSwipeOffset(null)
  }

  const confirmDeleteTx = async () => {
    if (!deletingTxId) return
    try {
      await deleteWithUndo(deletingTxId, async () => {
        await deleteTransaction(deletingTxId)
        setDeletingTxId(null)
        setOpenSwipeId(null)
        setSwipeOffset(null)
      })
    } catch (err) {
      console.error("Delete error:", err)
      notify({ title: "Error", message: "No se pudo eliminar la transacción." })
    }
  }

  const handleUndo = async () => {
    setUndoLoading(true)
    await undo()
    setUndoLoading(false)
    mutate("accounts")
    mutate((key: any) => Array.isArray(key) && key[0] === "transactions")
  }

  const monthlyIncome = accountTransactions
    .filter((tx) => tx.type === "income" && isReportableIncome(tx.metadata))
    .reduce((sum, tx) => sum + tx.amount, 0)

  const monthlyExpenses = accountTransactions
    .filter((tx) => tx.type === "expense" && isReportableExpense(tx.metadata))
    .reduce((sum, tx) => sum + tx.amount, 0)



  const handlePayment = async () => {
    if (!paymentSource || !paymentAmount || isPaying) return
    setIsPaying(true)
    try {
      await payCreditCard({
        credit_account_id: accountId,
        source_account_id: paymentSource,
        amount: parsedAmount,
        currency: paymentCurrency,
        exchange_rate: conversionAppliesPay ? parsedRate : undefined,
        payment_kind: paymentKind,
        notes: paymentComment.trim() || undefined,
        apply_commission: true,
      })
      notify({ title: "Pago completado", message: "El pago de tarjeta fue registrado." })
      EventBus.emit({ type: "card_payment_completed" })
      setShowPayment(false)
      setPaymentSource("")
      setPaymentAmount("")
      setPaymentRate("")
      setPaymentComment("")
      setPaymentKind("custom")
    } catch {
      notify({
        title: "No se pudo completar el pago",
        message: "Verifica deuda de la tarjeta y disponible en la cuenta origen.",
      })
    } finally {
      setIsPaying(false)
    }
  }

  const handleEditSubmit = async () => {
    setIsEditing(true)
    try {
      const parsedBalance = Number(editForm.balance || 0)
      const parsedCreditLimit = Number(editForm.credit_limit || 0)
      const parsedCreditLimitDop = Number(editForm.credit_limit_dop || 0)
      const parsedCreditLimitUsd = Number(editForm.credit_limit_usd || 0)
      const parsedClosingDate = editForm.type === "credit" && editForm.closing_date ? Number(editForm.closing_date) : null
      const parsedDueDate = editForm.type === "credit" && editForm.due_date ? Number(editForm.due_date) : null
      const computedDueDays = parsedClosingDate && parsedDueDate
        ? (parsedDueDate - parsedClosingDate + 30) % 30
        : null

      await updateAccount(accountId, {
        name: editForm.name,
        type: editForm.type,
        currency: editForm.currency,
        balance: parsedBalance,
        credit_limit: editForm.type === "credit" ? parsedCreditLimit : null,
        credit_limit_dop: editForm.type === "credit" ? parsedCreditLimitDop : null,
        credit_limit_usd: editForm.type === "credit" ? parsedCreditLimitUsd : null,
        closing_date: parsedClosingDate,
        closing_day: parsedClosingDate,
        due_date: parsedDueDate,
        due_days_after_cutoff: computedDueDays,
        icon_url: editForm.icon_url || null,
        icon_type: editForm.icon_type,
        icon_value: editForm.icon_value,
        account_number: editForm.account_number || null,
        bank_name: editForm.bank_logo_key !== "none" ? editForm.bank_name || null : null,
        bank_logo_key: editForm.bank_logo_key !== "none" ? editForm.bank_logo_key : null,
        bank_logo_url: editForm.bank_logo_key !== "none" ? editForm.bank_logo_url || null : null,
        primary_color: editForm.primary_color,
        secondary_color: editForm.secondary_color,
        background_style: editForm.background_style,
      })
      mutate("accounts")
      if (editForm.type === "credit") {
        syncCreditAccountCycle(accountId)
      }
      notify({ title: "Cuenta actualizada", message: "Los cambios fueron guardados exitosamente." })
      EventBus.emit({ type: "account_updated", payload: { name: editForm.name } })
      setShowEditModal(false)
      if (searchParams.get("edit") === "1") {
        router.replace(pathname)
      }
    } catch (error) {
      console.error(error)
      const rawMessage = error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message?: unknown }).message || "")
          : ""
      const message = rawMessage.includes("background_style")
        ? "Faltan columnas de personalización en la base de datos. Ejecuta scripts/008_account_branding.sql."
        : rawMessage || "No se pudo actualizar la cuenta"
      notify({ title: "Error al guardar", message })
    } finally {
      setIsEditing(false)
    }
  }

  const handleDeleteAccount = async () => {
    setIsDeleting(true)
    setDeleteError("")
    try {
      await deleteAccount(accountId)
      mutate("accounts")
      notify({ title: "Cuenta eliminada", message: "La cuenta fue eliminada." })
      EventBus.emit({ type: "account_deleted" })
      router.push("/accounts")
    } catch (error) {
      setDeleteError("No se pudo eliminar la cuenta. Intenta de nuevo.")
    } finally {
      setIsDeleting(false)
    }
  }

  useEffect(() => {
    if (!showDeleteModal) return
    getAccountDeletionImpact(accountId)
      .then(setDeleteImpact)
      .catch(() => setDeleteImpact({ count: 1, hasMovements: true }))
  }, [accountId, showDeleteModal])

  const closeEditModal = () => {
    setShowEditModal(false)
    if (searchParams.get("edit") === "1") {
      router.replace(pathname)
    }
  }

  useEffect(() => {
    if (searchParams.get("edit") !== "1" || !account) return

    setEditForm({
      name: account.name,
      type: account.type,
      currency: account.currency || "DOP",
      balance: String(account.balance || 0),
      credit_limit: String(account.creditLimit || 0),
      credit_limit_dop: String(account.creditLimitDop || 0),
      credit_limit_usd: String(account.creditLimitUsd || 0),
      closing_date: String(account.cutoffDate || ""),
      due_date: String(account.dueDate || ""),
      icon_url: String(rawAccounts.find((a) => a.id === accountId)?.icon_url || ""),
      icon_type: ((rawAccounts.find((a) => a.id === accountId)?.icon_type === "image" ? "image" : "icon") as "icon" | "image"),
      icon_value: String(rawAccounts.find((a) => a.id === accountId)?.icon_value || "building-2"),
      account_number: String((rawAccounts.find((a) => a.id === accountId) as any)?.account_number || ""),
      bank_name: String((rawAccounts.find((a) => a.id === accountId) as any)?.bank_name || ""),
      bank_logo_key: String((rawAccounts.find((a) => a.id === accountId) as any)?.bank_logo_key || "none"),
      bank_logo_url: String((rawAccounts.find((a) => a.id === accountId) as any)?.bank_logo_url || ""),
      primary_color: String(rawAccounts.find((a) => a.id === accountId)?.primary_color || "#0b4a8a"),
      secondary_color: String(rawAccounts.find((a) => a.id === accountId)?.secondary_color || "#38bdf8"),
      background_style: String(rawAccounts.find((a) => a.id === accountId)?.background_style || "gradient"),
    })
  }, [account, accountId, rawAccounts, searchParams])

  // React 19: Use useEffect for prev/current comparison instead of render-phase setState
  useEffect(() => {
    const currentEditDeps = `${account?.id}-${accountId}-${searchParams}`
    if (currentEditDeps !== prevEditDeps.current && searchParams.get("edit") === "1") {
      prevEditDeps.current = currentEditDeps
      setShowEditModal(true)
    }
  }, [searchParams, accountId, account?.id])

  const prevEditDeps = useRef("")
  const parsedAmount = parseFloat(paymentAmount.replace(/[^0-9.]/g, "")) || 0
  const sourceAccount = accounts.find((a) => a.id === paymentSource)
  const currentDebtByCurrency = paymentCurrency === "DOP" ? Number(account?.currentDebtDop || 0) : Number(account?.currentDebtUsd || 0)
  const statementByCurrency = paymentCurrency === "DOP" ? Number(account?.statementDop || 0) : Number(account?.statementUsd || 0)
  const paidStatementByCurrency = paymentCurrency === "DOP" ? Number(account?.paidStatementDop || 0) : Number(account?.paidStatementUsd || 0)
  const pendingStatementByCurrency = Math.max(0, statementByCurrency - paidStatementByCurrency)
  const minPaymentByCurrency = pendingStatementByCurrency * Number(account?.minimumPaymentPercentage || 0.0278)

  const sourceCurrency = sourceAccount?.currency as Currency | undefined
  const conversionAppliesPay = Boolean(sourceCurrency && sourceCurrency !== paymentCurrency)
  const parsedRate = Number(paymentRate)

  const paymentCalcs = parsedAmount > 0 && sourceCurrency
    ? (() => {
        try {
          return calculateCreditCardPaymentAmounts({
            paymentAmount: parsedAmount,
            sourceCurrency: sourceCurrency as "DOP" | "USD",
            targetCurrency: paymentCurrency,
            exchangeRate: conversionAppliesPay ? parsedRate : undefined,
            applyDgiiTax: true,
          })
        } catch {
          return null
        }
      })()
    : null

  const sourceDebitAmount = paymentCalcs?.sourceAmount || parsedAmount
  const dgiiAmountPay = paymentCalcs?.dgiiTaxAmount || 0
  const totalDebitPay = paymentCalcs?.totalDebit || sourceDebitAmount
  const validRatePay = !conversionAppliesPay || (Number.isFinite(parsedRate) && parsedRate > 0)

  // React 19: Use useEffect for prev/current comparison instead of render-phase setState
  useEffect(() => {
    if (prevHasUsdOnCard.current !== hasUsdOnCard) {
      prevHasUsdOnCard.current = hasUsdOnCard
      if (!hasUsdOnCard && paymentCurrency === "USD") {
        setPaymentCurrency("DOP")
        setPaymentSource("")
        setPaymentAmount("")
      }
    }
  }, [hasUsdOnCard, paymentCurrency])

  const prevHasUsdOnCard = useRef(hasUsdOnCard)

  if (!account) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Cuenta no encontrada</p>
      </div>
    )
  }

  const isCredit = account.type === "credit"
  const cardHasBalance = isCredit && (Number(account.currentDebt) > 0 || Number(account.currentDebtDop) > 0 || Number(account.currentDebtUsd) > 0)
  const rawAccount = rawAccounts.find((a) => a.id === accountId)
  const brandingDefaults = getAccountBrandingDefaults(account.type)
  const headerPrimary = rawAccount?.primary_color || brandingDefaults.primaryColor
  const headerSecondary = rawAccount?.secondary_color || brandingDefaults.secondaryColor
  const headerStyle = rawAccount?.background_style || "gradient"
  const headerTextColor = getReadableTextColor(headerPrimary)
  const headerBackground = headerStyle === "solid"
    ? `linear-gradient(145deg, color-mix(in oklab, ${headerPrimary} 88%, white), color-mix(in oklab, ${headerPrimary} 72%, white))`
    : headerStyle === "glass"
    ? `linear-gradient(145deg, color-mix(in oklab, ${headerPrimary} 70%, white), color-mix(in oklab, ${headerSecondary} 65%, white))`
    : `linear-gradient(145deg, color-mix(in oklab, ${headerPrimary} 82%, white), color-mix(in oklab, ${headerSecondary} 72%, white))`

  return (
    <MobilePageShell fullBleed className="pb-nav-safe">
      {showEditModal ? (
        <div className="flex min-h-full flex-col">
          <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background px-5 py-4 pt-[calc(1rem+env(safe-area-inset-top))]">
            <button type="button" onClick={closeEditModal} aria-label="Volver" className="tap-lift flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-bold text-foreground">Editar cuenta</h1>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-6 pb-8">
            <div className="space-y-4">
              <div>
                <label htmlFor="account-name" className="text-xs font-medium text-muted-foreground">Nombre</label>
                <input
                  id="account-name"
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="mt-1 w-full rounded-xl bg-muted p-3 text-sm text-foreground outline-none"
                  placeholder="Ej. Cuenta de Ahorros"
                />
              </div>
              <div>
                <label htmlFor="account-type" className="text-xs font-medium text-muted-foreground">Tipo</label>
                <div className="mt-1 grid grid-cols-3 gap-2">
                  {[
                    { id: "cash", label: "Efectivo", icon: Banknote },
                    { id: "debit", label: "Débito", icon: Building2 },
                    { id: "credit", label: "Crédito", icon: CreditCard },
                  ].map((type) => {
                    const TypeIcon = type.icon
                    const isSelected = editForm.type === type.id
                    return (
                      <button type="button"
                        key={type.id}
                        id={type.id === "cash" ? "account-type" : undefined}
                        onClick={() => setEditForm({ ...editForm, type: type.id as AccountType })}
                        className={cn(
                          "flex flex-col items-center gap-2 rounded-xl p-3 transition-all",
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground"
                        )}
                      >
                        <TypeIcon className="h-5 w-5" />
                        <span className="text-xs font-medium">{type.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <label htmlFor="account-currency" className="text-xs font-medium text-muted-foreground">Moneda</label>
                <div className="mt-1 flex gap-2">
                  {(["DOP", "USD"] as Currency[]).map((currency) => (
                    <button type="button"
                      key={currency}
                      id={currency === "DOP" ? "account-currency" : undefined}
                      onClick={() => setEditForm({ ...editForm, currency })}
                      className={cn(
                        "flex-1 rounded-xl p-3 text-sm font-medium transition-all",
                        editForm.currency === currency
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      )}
                    >
                      {currency}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="account-balance" className="text-xs font-medium text-muted-foreground">Balance inicial</label>
                <MoneyInput
                  id="account-balance"
                  value={editForm.balance}
                  onValueChange={(value) => setEditForm({ ...editForm, balance: value })}
                  className="mt-1 w-full rounded-xl bg-muted p-3 text-sm text-foreground outline-none tabular-nums"
                />
              </div>
              {editForm.type === "credit" && (
                <>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {editForm.currency !== "USD" && <div>
                      <label htmlFor="account-credit-limit" className="text-xs font-medium text-muted-foreground">Límite de crédito</label>
                      <MoneyInput
                        id="account-credit-limit"
                        value={editForm.credit_limit}
                        onValueChange={(value) => setEditForm({ ...editForm, credit_limit: value, credit_limit_dop: value })}
                        className="mt-1 w-full rounded-xl bg-muted p-3 text-sm text-foreground outline-none tabular-nums"
                      />
                    </div>}
                    {editForm.currency !== "DOP" && <div>
                      <label htmlFor="account-credit-limit-usd" className="text-xs font-medium text-muted-foreground">Límite de crédito USD</label>
                      <MoneyInput
                        id="account-credit-limit-usd"
                        value={editForm.credit_limit_usd}
                        onValueChange={(value) => setEditForm({ ...editForm, credit_limit_usd: value })}
                        className="mt-1 w-full rounded-xl bg-muted p-3 text-sm text-foreground outline-none tabular-nums"
                      />
                    </div>}
                  </div>
                  <div>
                    <label htmlFor="account-closing-date" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      Día de corte
                      {cardHasBalance && <Lock className="h-3 w-3" />}
                    </label>
                    <input
                      id="account-closing-date"
                      type="text"
                      inputMode="numeric"
                      value={editForm.closing_date}
                      onChange={(e) => setEditForm({ ...editForm, closing_date: e.target.value.replace(/[^0-9]/g, "").slice(0, 2) })}
                      disabled={cardHasBalance}
                      className="mt-1 w-full rounded-xl bg-muted p-3 text-sm text-foreground outline-none disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label htmlFor="account-due-date" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      Día de pago
                      {cardHasBalance && <Lock className="h-3 w-3" />}
                    </label>
                    <input
                      id="account-due-date"
                      type="text"
                      inputMode="numeric"
                      value={editForm.due_date}
                      onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value.replace(/[^0-9]/g, "").slice(0, 2) })}
                      disabled={cardHasBalance}
                      className="mt-1 w-full rounded-xl bg-muted p-3 text-sm text-foreground outline-none disabled:opacity-50"
                    />
                  </div>
                  {cardHasBalance && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Info className="h-3 w-3 shrink-0" />
                      El corte y pago no se pueden cambiar mientras la tarjeta tenga balance pendiente.
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">Fecha de pago automática: corte + 20 días.</p>
                </>
              )}

              <div className="space-y-3 rounded-2xl border border-border/70 bg-card/70 p-4">
                <p className="text-sm font-semibold text-foreground">Personalización visual</p>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Tipo visual</p>
                  <select value={editForm.icon_type} onChange={(e) => setEditForm({ ...editForm, icon_type: e.target.value as "icon" | "image" })} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm">
                    <option value="icon">Ícono</option>
                    <option value="image">Logo/Banco</option>
                  </select>
                </div>

                {editForm.icon_type === "image" ? (
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Banco / Logo</p>
                    <select
                      value={editForm.bank_logo_key || "none"}
                      onChange={(e) => {
                        const selected = getBankLogoByKey(e.target.value)
                        if (!selected || selected.key === "none") {
                          setEditForm({ ...editForm, bank_logo_key: "none", bank_name: "", bank_logo_url: "", icon_type: "icon", icon_value: "building-2", icon_url: "" })
                          return
                        }
                        setEditForm({ ...editForm, bank_logo_key: selected.key, bank_name: selected.name, bank_logo_url: selected.logoUrl, icon_type: "image", icon_value: selected.key, icon_url: selected.logoUrl })
                      }}
                      className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
                    >
                      {BANK_LOGO_OPTIONS.map((option) => (
                        <option key={option.key} value={option.key}>{option.name}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Ícono</p>
                    <select value={editForm.icon_value} onChange={(e) => setEditForm({ ...editForm, icon_value: e.target.value })} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm">
                      {DETAIL_ICON_PRESETS.map((preset) => <option key={preset.value} value={preset.value}>{preset.label}</option>)}
                    </select>
                  </div>
                )}

                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Número de tarjeta/cuenta (opcional)</p>
                  <input
                    value={editForm.account_number}
                    onChange={(e) => setEditForm({ ...editForm, account_number: e.target.value.replace(/[^0-9]/g, "").slice(0, 24) })}
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                    placeholder="1234567890123456"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {DETAIL_COLOR_PRESETS.map((preset) => (
                    <button type="button"
                      key={preset.key}
                      onClick={() => setEditForm({ ...editForm, primary_color: preset.primary, secondary_color: preset.secondary })}
                      className={cn("h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-background", editForm.primary_color === preset.primary && editForm.secondary_color === preset.secondary ? "ring-primary" : "ring-transparent")}
                      title={preset.name}
                    >
                      <span className="block h-full w-full rounded-full" style={{ background: `linear-gradient(135deg, ${preset.primary}, ${preset.secondary})` }} />
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {(["gradient", "solid", "glass"] as const).map((style) => (
                    <button type="button"
                      key={style}
                      onClick={() => setEditForm({ ...editForm, background_style: style })}
                      className={cn("rounded-lg px-2 py-1 text-xs", editForm.background_style === style ? "bg-primary text-primary-foreground" : "bg-muted")}
                    >
                      {style === "gradient" ? "Degradado" : style === "solid" ? "Sólido" : "Suave"}
                    </button>
                  ))}
                </div>

                <BrandedAccountCard
                  compact
                  account={{
                    ...(rawAccounts.find((a) => a.id === accountId) || rawAccounts[0]),
                    name: editForm.name,
                    type: editForm.type,
                    currency: editForm.currency,
                    balance: Number(editForm.balance || 0),
                    credit_limit: editForm.type === "credit" ? Number(editForm.credit_limit || 0) : null,
                    closing_date: editForm.type === "credit" ? Number(editForm.closing_date || 0) : null,
                    due_date: editForm.type === "credit" ? Number(editForm.due_date || 0) : null,
                    icon_url: editForm.icon_url || null,
                    icon_type: editForm.icon_type,
                    icon_value: editForm.icon_value,
                    account_number: editForm.account_number || null,
                    primary_color: editForm.primary_color,
                    secondary_color: editForm.secondary_color,
                    background_style: editForm.background_style,
                  }}
                />
              </div>
            </div>
          </div>
          <div className="sticky bottom-0 z-10 border-t border-border/55 bg-card/92 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4 shadow-[0_-18px_45px_-34px_rgba(0,0,0,0.38)] backdrop-blur-xl">
            <Button onClick={handleEditSubmit} disabled={!editForm.name || isEditing} className="h-12 w-full rounded-2xl text-base font-semibold">
              {isEditing ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="relative overflow-hidden px-6 pb-8 pt-8" style={{ background: headerBackground, color: headerTextColor }}>
        <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-white/14 blur-sm" />
        <div className="pointer-events-none absolute -bottom-24 left-8 h-56 w-56 rounded-full border border-white/18" />
        <div className="pointer-events-none absolute bottom-14 right-4 h-24 w-36 rounded-full bg-black/15 blur-3xl" />
        {/* Header Actions */}
        <div className="relative z-10 mb-6 flex items-center justify-between">
          <Link
            href="/accounts"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur transition active:scale-95"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="flex gap-2">
            <button type="button"
              onClick={() => {
                setEditForm({
                  name: account.name,
                  type: account.type,
                  currency: account.currency || "DOP",
                  balance: String(account.balance || 0),
                  credit_limit: String(account.creditLimit || 0),
                  credit_limit_dop: String(account.creditLimitDop || 0),
                  credit_limit_usd: String(account.creditLimitUsd || 0),
                  closing_date: String(account.cutoffDate || ""),
                  due_date: String(account.dueDate || ""),
                  icon_url: String(rawAccounts.find((a) => a.id === accountId)?.icon_url || ""),
                  icon_type: ((rawAccounts.find((a) => a.id === accountId)?.icon_type === "image" ? "image" : "icon") as "icon" | "image"),
                  icon_value: String(rawAccounts.find((a) => a.id === accountId)?.icon_value || "building-2"),
                  account_number: String((rawAccounts.find((a) => a.id === accountId) as any)?.account_number || ""),
                  bank_name: String((rawAccounts.find((a) => a.id === accountId) as any)?.bank_name || ""),
                  bank_logo_key: String((rawAccounts.find((a) => a.id === accountId) as any)?.bank_logo_key || "none"),
                  bank_logo_url: String((rawAccounts.find((a) => a.id === accountId) as any)?.bank_logo_url || ""),
                  primary_color: String(rawAccounts.find((a) => a.id === accountId)?.primary_color || "#0b4a8a"),
                  secondary_color: String(rawAccounts.find((a) => a.id === accountId)?.secondary_color || "#38bdf8"),
                  background_style: String(rawAccounts.find((a) => a.id === accountId)?.background_style || "gradient"),
                })
                setShowEditModal(true)
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur transition hover:bg-white/20 active:scale-95"
            >
              <Settings className="h-5 w-5" />
            </button>
            <button type="button"
                onClick={() => {
                  const active = document.activeElement as HTMLElement | null
                  if (active && typeof active.blur === "function") active.blur()
                  setShowDeleteModal(true)
                }}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur transition hover:bg-white/20 active:scale-95"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="relative z-10">
          <BrandedAccountCard account={rawAccount || rawAccounts[0]} />
        </div>

        {isCredit && account.creditLimit && (
          <div className="relative z-10 mt-6 space-y-4">
            <div className="rounded-[1.45rem] border border-white/15 bg-slate-950/60 p-4 text-sm text-white shadow-[0_22px_60px_-32px_rgba(0,0,0,0.85)] backdrop-blur-md">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold tracking-tight text-white">Resumen de tarjeta</p>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white/70">
                  Ciclo
                </span>
              </div>

              {/* DOP */}
              <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.07] p-3">
                <p className="mb-2 text-[0.6875rem] text-white/70">Pesos (DOP)</p>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div>
                    <p className="text-white/60">Pendiente</p>
                    <p className="mt-0.5 font-semibold text-white">{formatCurrency(Math.max(0, Number(account.statementDop || 0) - Number(account.paidStatementDop || 0)), "DOP")}</p>
                  </div>
                  <div>
                    <p className="text-white/60">Compras</p>
                    <p className="mt-0.5 font-semibold text-white">{formatCurrency(Number(account.statementDop || 0), "DOP")}</p>
                  </div>
                  <div>
                    <p className="text-white/60">Mínimo</p>
                    <p className="mt-0.5 font-semibold text-amber-300">{formatCurrency(Math.max(0, Number(account.statementDop || 0) - Number(account.paidStatementDop || 0)) * Number(account.minimumPaymentPercentage || 0.0278), "DOP")}</p>
                  </div>
                  <div>
                    <p className="text-white/60">Financiado</p>
                    <p className="mt-0.5 font-semibold text-white">{formatCurrency(Number(account.financed_balance_dop || 0), "DOP")}</p>
                  </div>
                </div>
              </div>

              {/* USD */}
              {hasUsdOnCard && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-3">
                  <p className="mb-2 text-[0.6875rem] text-white/70">Dólares (USD)</p>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div>
                      <p className="text-white/60">Pendiente</p>
                      <p className="mt-0.5 font-semibold text-white">{formatCurrency(Math.max(0, Number(account.statementUsd || 0) - Number(account.paidStatementUsd || 0)), "USD")}</p>
                    </div>
                    <div>
                      <p className="text-white/60">Compras</p>
                      <p className="mt-0.5 font-semibold text-white">{formatCurrency(Number(account.statementUsd || 0), "USD")}</p>
                    </div>
                    <div>
                      <p className="text-white/60">Mínimo</p>
                      <p className="mt-0.5 font-semibold text-amber-300">{formatCurrency(Math.max(0, Number(account.statementUsd || 0) - Number(account.paidStatementUsd || 0)) * Number(account.minimumPaymentPercentage || 0.0278), "USD")}</p>
                    </div>
                    <div>
                      <p className="text-white/60">Financiado</p>
                      <p className="mt-0.5 font-semibold text-white">{formatCurrency(Number(account.financed_balance_usd || 0), "USD")}</p>
                    </div>
                  </div>
                </div>
              )}

              <p className="mt-1.5 text-center text-[0.625rem] text-white/45">Próximo corte: {account.cycleEndDate ? formatDate(account.cycleEndDate) : "-"}</p>
            </div>

            <Button
              onClick={() => setShowPayment(true)}
              className="h-12 w-full rounded-2xl border border-white/15 bg-slate-900/90 text-white shadow-[0_12px_30px_-18px_rgba(0,0,0,0.7)] transition active:scale-[0.99] disabled:bg-slate-900/45 disabled:text-white/65"
            >
              Pagar tarjeta
            </Button>
          </div>
        )}
      </div>

      {/* Summary Section */}
      <div className="px-6 pt-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">Resumen del mes</h2>
          <button
            type="button"
            onClick={() => setShowSummaryPeriodMenu((prev) => !prev)}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-[0.6875rem] font-medium text-muted-foreground"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            <span>{dateFilter === "week" ? "7 días" : dateFilter === "month" ? "Este mes" : "Todo"}</span>
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>

        {showSummaryPeriodMenu && (
          <div className="mt-2 flex justify-end">
            <div className="w-36 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
              {[
                { value: "week", label: "7 días" },
                { value: "month", label: "Este mes" },
                { value: "all", label: "Todo" },
              ].map((option) => (
                <button type="button"
                  key={option.value}
                  onClick={() => {
                    setDateFilter(option.value as DateRange)
                    setShowSummaryPeriodMenu(false)
                  }}
                  className={cn(
                    "w-full px-3 py-2 text-left text-xs",
                    dateFilter === option.value ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 rounded-[1.45rem] border border-border/60 bg-card/82 shadow-sm backdrop-blur">
          <div className="min-w-0 border-r border-border/60 px-3 py-3.5">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-reflow-1 text-[0.6875rem] text-muted-foreground">Ingresos</p>
            </div>
            <p className="mt-2 amount-secondary font-bold text-income overflow-wrap-anywhere">
              {formatCurrency(monthlyIncome)}
            </p>
          </div>

          <div className="min-w-0 px-3 py-3.5">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <TrendingDown className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
              </div>
              <p className="text-reflow-1 text-[0.6875rem] text-muted-foreground">Gastos</p>
            </div>
            <p className="mt-2 amount-secondary font-bold text-expense overflow-wrap-anywhere">
              -{formatCurrency(monthlyExpenses)}
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
              <button type="button"
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
        <div className="mt-2 rounded-2xl border border-border/60 bg-muted/45 px-3 py-2 text-[0.6875rem] font-semibold text-muted-foreground">
          Desliza a la izquierda para editar o eliminar movimientos.
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-border/60 bg-card/82 px-3 py-2.5 shadow-sm backdrop-blur">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={txQuery}
            onChange={(e) => setTxQuery(e.target.value)}
            placeholder="Buscar por nombre, categoría o monto"
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>

        {/* Transaction List */}
        <div className="mt-4 flex flex-col gap-4">
          {groupedTransactions.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">
                {txQuery.trim() ? "No hay resultados para tu búsqueda" : "No hay movimientos en esta cuenta"}
              </p>
            </div>
          ) : (
            groupedTransactions.map((group) => (
              <TransactionGroup key={group.date.toISOString()} label={group.label}>
                {group.items.map((tx) => {
                  const row: TransactionRowData = {
                    id: tx.id,
                    title: tx.title,
                    category: tx.category,
                    amount: tx.amount,
                    type: tx.type,
                    currency: tx.currency,
                    time: tx.date,
                    metadata: tx.metadata as Record<string, any>,
                  }

                  return (
                    <TransactionRow
                      key={tx.id}
                      tx={row}
                      showAccount={false}
                      showTime={false}
                      showDate
                      actions={{ onEdit: () => openEditTx(tx.id), onDelete: () => setDeletingTxId(tx.id) }}
                      swipe={{
                        isOpen: openSwipeId === tx.id,
                        offset: swipeOffset?.id === tx.id ? swipeOffset.offset : openSwipeId === tx.id ? -108 : 0,
                        onPointerDown: (event: React.PointerEvent) => {
                          const target = event.target as HTMLElement
                          if (target.closest("button") || target.closest("a")) return
                          pointerRef.current = { id: tx.id, startX: event.clientX, startY: event.clientY, swiping: false }
                        },
                        onPointerMove: (event: React.PointerEvent) => {
                          const pointer = pointerRef.current
                          if (!pointer || pointer.id !== tx.id) return
                          const dx = event.clientX - pointer.startX
                          const dy = event.clientY - pointer.startY
                          if (Math.abs(dx) <= Math.abs(dy) || (dx >= 0 && openSwipeId !== tx.id)) return
                          pointer.swiping = true
                          setOpenSwipeId(tx.id)
                          const base = openSwipeId === tx.id ? -108 : 0
                          setSwipeOffset({ id: tx.id, offset: Math.min(0, Math.max(-108, base + dx)) })
                        },
                        onPointerUp: () => {
                          const pointer = pointerRef.current
                          if (!pointer || pointer.id !== tx.id) return
                          if (pointer.swiping) {
                            const finalOffset = swipeOffset?.id === tx.id ? swipeOffset.offset : 0
                            if (finalOffset < -54) { setOpenSwipeId(tx.id); setSwipeOffset({ id: tx.id, offset: -108 }) }
                            else { setOpenSwipeId(null); setSwipeOffset(null) }
                          }
                          pointerRef.current = null
                        },
                        onPointerCancel: () => { pointerRef.current = null },
                      }}
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

      {deletingTxId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl">
            <h3 className="text-lg font-bold text-foreground">Eliminar transacción</h3>
            <p className="mt-2 text-sm text-muted-foreground">Esta acción revertirá el impacto en el balance de la cuenta asociada. Puedes deshacerla dentro de los próximos 10 segundos.</p>
            <div className="mt-6 space-y-2">
              <Button variant="destructive" onClick={confirmDeleteTx} className="h-12 w-full">Confirmar eliminación</Button>
              <Button variant="outline" onClick={() => setDeletingTxId(null)} className="h-12 w-full">Cancelar</Button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPayment && (
        <BaseModalForm
          title="Pagar tarjeta"
          onClose={() => setShowPayment(false)}
          contentClassName="space-y-4"
          footer={
            <Button
              onClick={handlePayment}
              disabled={
                !paymentSource ||
                parsedAmount <= 0 ||
                parsedAmount > currentDebtByCurrency ||
                (sourceAccount && totalDebitPay > Number(sourceAccount.balance || 0)) ||
                isPaying ||
                !validRatePay
              }
              className="h-12 w-full rounded-2xl text-base font-semibold"
            >
              {isPaying ? "Procesando..." : `Pagar ${formatCurrency(parsedAmount, paymentCurrency)}`}
            </Button>
          }
        >
            <div className="rounded-2xl bg-muted p-4">
              <p className="text-xs text-muted-foreground">Balance actual ({paymentCurrency})</p>
              <p className="mt-1 amount-secondary font-bold text-foreground">
                {formatCurrency(currentDebtByCurrency, paymentCurrency)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Balance al corte: {formatCurrency(pendingStatementByCurrency, paymentCurrency)} · Pago mínimo: {formatCurrency(minPaymentByCurrency, paymentCurrency)}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
              {(["DOP", "USD"] as const).filter((curr) => curr === "DOP" || hasUsdOnCard).map((curr) => (
                <button type="button" key={curr} onClick={() => { setPaymentCurrency(curr); setPaymentSource(""); setPaymentAmount(""); setPaymentRate(""); setPaymentComment(""); setPaymentKind("custom") }} className={cn("rounded-lg py-2 text-xs font-medium", paymentCurrency === curr ? "bg-card" : "text-muted-foreground")}>{curr}</button>
              ))}
            </div>

            <div className="space-y-4 pb-2">
              {/* Source Account */}
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Pagar desde
                </p>
                <AccountCarouselSelector
                  compact
                  items={accounts
                    .filter((a) => a.type !== "credit")
                    .map((acc) => ({ id: acc.id, title: acc.name, subtitle: formatCurrency(Number(acc.balance || 0), acc.currency), detail: acc.currency }))}
                  selectedId={paymentSource}
                  onSelect={(id) => { setPaymentSource(id); setPaymentRate("") }}
                  emptyMessage="No hay cuentas disponibles"
                />
              </div>

              {/* Exchange Rate (cross-currency) */}
              {conversionAppliesPay && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Tasa de cambio ({sourceCurrency} a {paymentCurrency})</p>
                  <input value={paymentRate} onChange={(e) => setPaymentRate(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="59.50" className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none" />
                </div>
              )}

              {/* Amount */}
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Monto a pagar
                </p>
                <div className="flex items-center gap-2 rounded-xl bg-muted p-4 overflow-x-auto scrollbar-none">
                    <span className="shrink-0 amount-inline font-medium text-muted-foreground">{getCurrencySymbol(paymentCurrency)}</span>
                  <MoneyInput
                    value={paymentAmount}
                    onValueChange={(value) => {
                      setPaymentAmount(value)
                      setPaymentKind("custom")
                    }}
                    placeholder="0"
                    className="bg-transparent amount-hero font-bold text-foreground outline-none placeholder:text-muted-foreground/30 min-w-[80px] tabular-nums"
                    wrapperClassName="flex-1"
                  />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button type="button"
                    onClick={() => { setPaymentAmount(String(currentDebtByCurrency)); setPaymentKind("balance_to_date") }}
                    className="rounded-xl bg-muted px-3 py-2 text-xs font-medium text-foreground"
                  >
                    Deuda actual
                  </button>
                  <button type="button"
                    onClick={() => { setPaymentAmount(String(pendingStatementByCurrency)); setPaymentKind("statement_balance") }}
                    className="rounded-xl bg-muted px-3 py-2 text-xs font-medium text-foreground"
                  >
                    Balance al corte
                  </button>
                  <button type="button"
                    onClick={() => { setPaymentAmount(String(Math.round(minPaymentByCurrency))); setPaymentKind("minimum_payment") }}
                    className="rounded-xl bg-muted px-3 py-2 text-xs font-medium text-foreground"
                  >
                    Mínimo
                  </button>
                  <button type="button"
                    onClick={() => setPaymentKind("custom")}
                    className={cn("rounded-xl px-3 py-2 text-xs font-medium", paymentKind === "custom" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground")}
                  >
                    Personalizado
                  </button>
                </div>
                <div className="mt-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Comentario (opcional)</p>
                  <input
                    value={paymentComment}
                    onChange={(e) => setPaymentComment(e.target.value)}
                    placeholder="Ej. pago quincenal"
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  />
                </div>
              </div>

              {/* Summary with DGII */}
              {parsedAmount > 0 && sourceAccount && (
                <div className="rounded-xl border border-border bg-card p-3 text-sm">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Resumen del pago</p>
                  <div className="space-y-1">
                    <p className="flex justify-between"><span>Monto a acreditar</span><span className="font-semibold">{formatCurrency(parsedAmount, paymentCurrency)}</span></p>
                    {conversionAppliesPay && sourceCurrency ? (
                      <p className="flex justify-between text-xs text-muted-foreground"><span>Total a descontar (sin DGII)</span><span>{formatCurrency(sourceDebitAmount, sourceCurrency)}</span></p>
                    ) : null}
                    <p className="flex justify-between text-xs"><span className="text-muted-foreground">Impuesto DGII 0.20%</span><span className="text-amber-500">{formatCurrency(dgiiAmountPay, sourceCurrency || paymentCurrency)}</span></p>
                    <p className="flex justify-between border-t border-border pt-1 font-semibold"><span>Total a debitar</span><span>{formatCurrency(totalDebitPay, sourceCurrency || paymentCurrency)}</span></p>
                  </div>
                </div>
              )}

              {/* Warning if insufficient funds */}
              {sourceAccount && totalDebitPay > Number(sourceAccount.balance || 0) && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-red-600 dark:bg-red-950/30 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-xs">Ese monto supera tu balance disponible.</span>
                </div>
              )}
              {sourceAccount && (
                <p className={cn(
                  "text-xs",
                  totalDebitPay > Number(sourceAccount.balance || 0)
                    ? "text-red-500"
                    : Number(sourceAccount.balance) <= 1000
                      ? "text-amber-600"
                      : "text-muted-foreground"
                )}>
                  Disponible: {formatCurrency(Number(sourceAccount.balance || 0), sourceAccount.currency)}
                </p>
              )}
            </div>
        </BaseModalForm>
      )}

        </>

      )}



        <AlertDialog open={showDeleteModal} onOpenChange={(open) => { if (!open) { setShowDeleteModal(false); setDeleteError(""); setDeleteImpact(null) } }}>
          <AlertDialogContent className="max-w-sm p-0 gap-0" onCloseAutoFocus={(e) => { e.preventDefault() }}>
            <div className="p-5">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/12 text-destructive">
                <AlertTriangle className="h-7 w-7" />
              </div>
              <div className="mt-4 text-center">
                <AlertDialogTitle className="text-lg font-black text-foreground">Eliminar {account.type === "credit" ? "tarjeta" : "cuenta"}</AlertDialogTitle>
                <AlertDialogDescription className="mt-2 text-sm font-semibold text-foreground">
                  {deleteImpact?.hasMovements
                    ? account.type === "credit" ? "Esta tarjeta tiene movimientos registrados." : "Esta cuenta tiene movimientos registrados."
                    : `¿Eliminar ${account.name}?`}
                </AlertDialogDescription>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {deleteImpact?.hasMovements
                    ? "Si la eliminas, también se perderán sus movimientos, historial e información asociada. Esta acción no se puede deshacer."
                    : "Esta acción no se puede deshacer."}
                </p>
                {deleteError && (
                  <div className="mt-4 flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-left text-destructive">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    <span className="text-xs">{deleteError}</span>
                  </div>
                )}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <Button variant="outline" className="h-12 rounded-2xl" onClick={() => { setShowDeleteModal(false); setDeleteError(""); setDeleteImpact(null) }}>
                  Cancelar
                </Button>
                <HoldToConfirmButton onConfirm={handleDeleteAccount} loading={isDeleting} className="w-full" label="Eliminar" />
              </div>
            </div>
          </AlertDialogContent>
        </AlertDialog>

      {/* Undo bar */}
      {undoPending && (
        <div className="fixed bottom-20 left-4 right-4 z-[110] animate-slide-up">
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 shadow-lg backdrop-blur-md">
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Transacción eliminada</p>
              <p className="text-xs text-muted-foreground">Deshacer en {undoPending.count}s</p>
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={handleUndo}
              disabled={undoLoading}
              className="shrink-0"
            >
              {undoLoading ? "..." : "Deshacer"}
            </Button>
          </div>
        </div>
      )}
      </MobilePageShell>
    )
  }
