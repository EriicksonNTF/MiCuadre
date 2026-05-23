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
  Utensils,
  Car,
  Zap,
  Film,
  ShoppingBag,
  Heart,
  GraduationCap,
  Plane,
  MoreHorizontal,
  CalendarDays,
  AlertTriangle,
  Settings,
  Trash2,
  Pencil,
  Search,
  ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { BaseModalForm } from "@/components/ui/base-modal-form"
import { MoneyInput } from "@/components/ui/money-input"
import { AccountCarouselSelector } from "@/components/ui/account-carousel-selector"
import { notify } from "@/lib/notifications"
import { EventBus } from "@/lib/event-bus"
import { useAccounts, useTransactions, updateAccount, deleteAccount, payCreditCard, updateTransaction, deleteTransaction } from "@/hooks/use-data"
import { usePersistentState } from "@/hooks/use-persistent-state"
import { formatCurrency, formatDate, getAccountBrandingDefaults, getAvailableCredit, getLocalDateString, getReadableTextColor } from "@/lib/data"
import { BrandedAccountCard } from "@/components/accounts/branded-account-card"
import type { AccountType, Currency } from "@/lib/types/database"
import { BANK_LOGO_OPTIONS, getBankLogoByKey } from "@/lib/bank-branding"


const accountIcons: Record<AccountType, typeof Banknote> = {
  cash: Banknote,
  debit: Building2,
  credit: CreditCard,
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
  const [paymentComment, setPaymentComment] = useState("")
  const [paymentKind, setPaymentKind] = useState<"balance_to_date" | "statement_balance" | "minimum_payment" | "custom">("custom")
  const [isPaying, setIsPaying] = useState(false)
  const [editingTxId, setEditingTxId] = useState<string | null>(null)
  const [deletingTxId, setDeletingTxId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editType, setEditType] = useState<"income" | "expense">("expense")
  const [editDate, setEditDate] = useState("")
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null)
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null)
  const [swipeOffset, setSwipeOffset] = useState<{ id: string; offset: number } | null>(null)
  const pointerRef = useRef<{ id: string; startX: number; startY: number; swiping: boolean } | null>(null)

  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
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
    }))
  }, [rawAccounts])

  const account = accounts.find((a) => a.id === accountId)
  const hasUsdOnCard = Boolean(account && (Number(account.creditLimitUsd || 0) > 0 || Number(account.currentDebtUsd || 0) > 0 || Number(account.statementUsd || 0) > 0))

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
      categoryId: tx.category_id,
      title: tx.description || "Sin descripción",
      category: nameToSlug[tx.category?.name || ""] || "other",
      amount: tx.amount,
      currency: tx.currency,
      type: tx.type,
      rawDate: tx.date,
      date: formatDate(tx.date),
      createdAt: tx.created_at,
      metadata: tx.metadata,
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

  const openEditTx = (txId: string) => {
    const tx = accountTransactions.find((item) => item.id === txId)
    if (!tx) return
    setEditingTxId(txId)
    setEditAmount(String(tx.amount))
    setEditDescription(tx.title === "Sin descripción" ? "" : tx.title)
    setEditType(tx.type)
    setEditDate(getLocalDateString(parseTxDate(tx.rawDate)))
    setEditCategoryId(tx.categoryId)
    setOpenSwipeId(null)
    setSwipeOffset(null)
  }

  const saveEditTx = async () => {
    if (!editingTxId || !editAmount || !editDate) return
    const amount = parseFloat(editAmount)
    if (!amount || amount <= 0) return

    try {
      const current = accountTransactions.find((item) => item.id === editingTxId)
      if (!current) return
      await updateTransaction(editingTxId, {
        account_id: current.accountId,
        type: editType,
        amount,
        description: editDescription || null,
        date: editDate,
        category_id: editCategoryId,
        notes: null,
        currency: current.currency,
        amount_base: amount,
        exchange_rate: 1,
        is_recurring: false,
      })
      notify({ title: "Transacción actualizada", message: "La transacción fue editada correctamente." })
      EventBus.emit({ type: "transaction_updated" })
      setEditingTxId(null)
      mutate("accounts")
      mutate((key: any) => Array.isArray(key) && key[0] === "transactions")
    } catch {
      notify({ title: "Error", message: "No se pudo editar la transacción." })
    }
  }

  const confirmDeleteTx = async () => {
    if (!deletingTxId) return
    try {
      await deleteTransaction(deletingTxId)
      notify({ title: "Transacción eliminada", message: "La transacción fue eliminada correctamente." })
      EventBus.emit({ type: "transaction_deleted" })
      setDeletingTxId(null)
      setOpenSwipeId(null)
      setSwipeOffset(null)
      mutate("accounts")
      mutate((key: any) => Array.isArray(key) && key[0] === "transactions")
    } catch {
      notify({ title: "Error", message: "No se pudo eliminar la transacción." })
    }
  }

  const monthlyIncome = accountTransactions
    .filter((tx) => tx.type === "income" && !(tx.metadata?.kind === "transfer" && tx.metadata?.transfer_type === "internal"))
    .reduce((sum, tx) => sum + tx.amount, 0)

  const monthlyExpenses = accountTransactions
    .filter((tx) => tx.type === "expense" && !(tx.metadata?.kind === "transfer" && tx.metadata?.transfer_type === "internal"))
    .reduce((sum, tx) => sum + tx.amount, 0)

  const netFlow = monthlyIncome - monthlyExpenses

  const handlePayment = async () => {
    if (!paymentSource || !paymentAmount) return
    setIsPaying(true)
    try {
      await payCreditCard({
        credit_account_id: accountId,
        source_account_id: paymentSource,
        amount: parsedAmount,
        currency: paymentCurrency,
        payment_kind: paymentKind,
        notes: paymentComment.trim() || undefined,
      })
      notify({ title: "Pago completado", message: "El pago de tarjeta fue registrado." })
      EventBus.emit({ type: "card_payment_completed" })
      setShowPayment(false)
      setPaymentSource("")
      setPaymentAmount("")
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
    if (!editForm.name) return
    setIsEditing(true)
    try {
      const parsedBalance = Number(editForm.balance || 0)
      const parsedCreditLimit = Number(editForm.credit_limit || 0)
      const parsedCreditLimitDop = Number(editForm.credit_limit_dop || 0)
      const parsedCreditLimitUsd = Number(editForm.credit_limit_usd || 0)
      const parsedClosingDate = editForm.type === "credit" && editForm.closing_date ? Number(editForm.closing_date) : null

      await updateAccount(accountId, {
        name: editForm.name,
        type: editForm.type,
        currency: editForm.currency,
        balance: parsedBalance,
        credit_limit: editForm.type === "credit" ? parsedCreditLimit : null,
        credit_limit_dop: editForm.type === "credit" ? parsedCreditLimitDop : null,
        credit_limit_usd: editForm.type === "credit" ? parsedCreditLimitUsd : null,
        closing_date: parsedClosingDate,
        due_date: null,
        due_days_after_cutoff: editForm.type === "credit" ? 20 : null,
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
      setDeleteError("No se pudo eliminar la cuenta. Verifica que no tenga transacciones.")
    } finally {
      setIsDeleting(false)
    }
  }

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
    setShowEditModal(true)
  }, [account, accountId, rawAccounts, searchParams])

  const parsedAmount = parseFloat(paymentAmount.replace(/[^0-9.]/g, "")) || 0
  const sourceAccount = accounts.find((a) => a.id === paymentSource)
  const currentDebtByCurrency = paymentCurrency === "DOP" ? Number(account?.currentDebtDop || 0) : Number(account?.currentDebtUsd || 0)
  const statementByCurrency = paymentCurrency === "DOP" ? Number(account?.statementDop || 0) : Number(account?.statementUsd || 0)
  const paidStatementByCurrency = paymentCurrency === "DOP" ? Number(account?.paidStatementDop || 0) : Number(account?.paidStatementUsd || 0)
  const pendingStatementByCurrency = Math.max(0, statementByCurrency - paidStatementByCurrency)
  const minPaymentByCurrency = pendingStatementByCurrency * Number(account?.minimumPaymentPercentage || 0.0278)

  useEffect(() => {
    if (!hasUsdOnCard && paymentCurrency === "USD") {
      setPaymentCurrency("DOP")
      setPaymentSource("")
      setPaymentAmount("")
    }
  }, [hasUsdOnCard, paymentCurrency])

  if (!account) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Cuenta no encontrada</p>
      </div>
    )
  }

  const isCredit = account.type === "credit"
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
    <div className="app-scroll min-h-[100dvh] overflow-y-auto bg-background pb-nav-safe">
      <div className="px-6 pb-8 pt-8" style={{ background: headerBackground, color: headerTextColor }}>
        {/* Header Actions */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/accounts"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/10"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="flex gap-2">
            <button
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
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/10 transition-colors hover:bg-black/20"
            >
              <Settings className="h-5 w-5" />
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/10 transition-colors hover:bg-black/20"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        </div>

        <BrandedAccountCard account={rawAccount || rawAccounts[0]} />

        {isCredit && account.creditLimit && (
          <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-white/15 bg-slate-950/55 p-4 text-sm text-white backdrop-blur-md">
                <p className="font-semibold tracking-tight text-white">Resumen de tarjeta</p>
                <div className="mt-3 space-y-3">
                  <div className="rounded-xl border border-white/10 bg-white/[0.06] p-3">
                    <p className="text-[11px] text-white/70">Límite DOP</p>
                    <p className="mt-1 text-lg font-bold text-white">{formatCurrency(Number(account.creditLimitDop || 0), "DOP")}</p>
                    <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                      <div>
                        <p className="text-white/60">Disponible</p>
                        <p className="mt-0.5 font-semibold text-emerald-300">{formatCurrency(Number(account.available_credit_dop || Number(account.creditLimitDop || 0) - Number(account.currentDebtDop || 0)), "DOP")}</p>
                      </div>
                      <div>
                        <p className="text-white/60">Balance actual</p>
                        <p className="mt-0.5 font-semibold text-white">{formatCurrency(Number(account.currentDebtDop || 0), "DOP")}</p>
                      </div>
                      <div>
                        <p className="text-white/60">Balance al corte</p>
                        <p className="mt-0.5 font-semibold text-white">{formatCurrency(Math.max(0, Number(account.statementDop || 0) - Number(account.paidStatementDop || 0)), "DOP")}</p>
                      </div>
                      <div>
                        <p className="text-white/60">Pago mínimo</p>
                        <p className="mt-0.5 font-semibold text-amber-300">{formatCurrency(Math.max(0, Number(account.statementDop || 0) - Number(account.paidStatementDop || 0)) * Number(account.minimumPaymentPercentage || 0.0278), "DOP")}</p>
                      </div>
                    </div>
                  </div>

                  {hasUsdOnCard && <div className="rounded-xl border border-white/10 bg-white/[0.06] p-3">
                    <p className="text-[11px] text-white/70">Límite USD</p>
                    <p className="mt-1 text-lg font-bold text-white">{formatCurrency(Number(account.creditLimitUsd || 0), "USD")}</p>
                    <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                      <div>
                        <p className="text-white/60">Disponible</p>
                        <p className="mt-0.5 font-semibold text-emerald-300">{formatCurrency(Number(account.available_credit_usd || Number(account.creditLimitUsd || 0) - Number(account.currentDebtUsd || 0)), "USD")}</p>
                      </div>
                      <div>
                        <p className="text-white/60">Balance actual</p>
                        <p className="mt-0.5 font-semibold text-white">{formatCurrency(Number(account.currentDebtUsd || 0), "USD")}</p>
                      </div>
                      <div>
                        <p className="text-white/60">Balance al corte</p>
                        <p className="mt-0.5 font-semibold text-white">{formatCurrency(Math.max(0, Number(account.statementUsd || 0) - Number(account.paidStatementUsd || 0)), "USD")}</p>
                      </div>
                      <div>
                        <p className="text-white/60">Pago mínimo</p>
                        <p className="mt-0.5 font-semibold text-amber-300">{formatCurrency(Math.max(0, Number(account.statementUsd || 0) - Number(account.paidStatementUsd || 0)) * Number(account.minimumPaymentPercentage || 0.0278), "USD")}</p>
                      </div>
                    </div>
                  </div>}
                </div>
                <p className="mt-3 text-xs text-white/65">Pagar antes de: {account.statementDueDate ? formatDate(account.statementDueDate) : "-"}</p>
            </div>
            
            {/* Pay button */}
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
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-[11px] font-medium text-muted-foreground"
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
                <button
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

        <div className="mt-3 grid max-h-[116px] grid-cols-3 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="min-w-0 border-r border-border px-3 py-3.5">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="truncate text-[11px] text-muted-foreground">Ingresos</p>
            </div>
            <p className="mt-2 truncate text-sm font-bold text-emerald-600 dark:text-emerald-400">
              +{formatCurrency(monthlyIncome)}
            </p>
          </div>

          <div className="min-w-0 border-r border-border px-3 py-3.5">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <TrendingDown className="h-3.5 w-3.5 text-red-600" />
              </div>
              <p className="truncate text-[11px] text-muted-foreground">Gastos</p>
            </div>
            <p className="mt-2 truncate text-sm font-bold text-red-600">
              -{formatCurrency(monthlyExpenses)}
            </p>
          </div>

          <div className="min-w-0 px-3 py-3.5">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full",
                  netFlow > 0
                    ? "bg-emerald-100 dark:bg-emerald-900/30"
                    : netFlow < 0
                    ? "bg-red-100 dark:bg-red-900/30"
                    : "bg-muted"
                )}
              >
                <Minus
                  className={cn(
                    "h-3.5 w-3.5",
                    netFlow > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : netFlow < 0
                      ? "text-red-600"
                      : "text-muted-foreground"
                  )}
                />
              </div>
              <p className="truncate text-[11px] text-muted-foreground">Neto</p>
            </div>
            <p
              className={cn(
                "mt-2 truncate text-sm font-bold",
                netFlow > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : netFlow < 0
                  ? "text-red-600"
                  : "text-foreground"
              )}
            >
              {netFlow > 0 ? "+" : ""}
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
        <p className="mt-2 text-xs text-muted-foreground">Desliza a la izquierda para editar o eliminar.</p>
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={txQuery}
            onChange={(e) => setTxQuery(e.target.value)}
            placeholder="Buscar por nombre, categoría o monto"
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>

        {/* Transaction List */}
        <div className="mt-4 space-y-2">
          {visibleTransactions.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">
                {txQuery.trim() ? "No hay resultados para tu búsqueda" : "No hay movimientos en esta cuenta"}
              </p>
            </div>
          ) : (
            visibleTransactions.map((tx) => {
              const CategoryIcon = categoryIcons[tx.category] || categoryIcons.other
              const isOpen = openSwipeId === tx.id
              const currentOffset = swipeOffset?.id === tx.id ? swipeOffset.offset : isOpen ? -108 : 0

              return (
                <div key={tx.id} data-account-tx-row="true" className="relative overflow-hidden rounded-2xl">
                  <div className="absolute inset-y-0 right-0 flex w-28 items-center justify-end gap-1 pr-2">
                    <button
                      aria-label="Editar transacción"
                      onClick={() => openEditTx(tx.id)}
                      className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      aria-label="Eliminar transacción"
                      onClick={() => setDeletingTxId(tx.id)}
                      className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500 text-white"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div
                    className="relative z-10 flex items-center gap-4 rounded-2xl bg-card p-4 transition-transform duration-200"
                    style={{ transform: `translateX(${currentOffset}px)` }}
                    onPointerDown={(event) => {
                      const target = event.target as HTMLElement
                      if (target.closest("button") || target.closest("a")) return
                      pointerRef.current = { id: tx.id, startX: event.clientX, startY: event.clientY, swiping: false }
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
                    <div className={cn("flex h-11 w-11 items-center justify-center rounded-full", categoryColors[tx.category] || categoryColors.other)}>
                      <CategoryIcon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium text-foreground">{tx.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{tx.date}</p>
                    </div>
                    <p
                      className={cn(
                        "font-semibold tabular-nums",
                        tx.type === "income"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-foreground"
                      )}
                    >
                      {tx.type === "income" ? "+" : "-"}
                      {formatCurrency(tx.amount, tx.currency)}
                    </p>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {editingTxId && (
        <BaseModalForm
          title="Editar transacción"
          onClose={() => setEditingTxId(null)}
          footer={<Button onClick={saveEditTx} className="h-12 w-full">Guardar cambios</Button>}
        >
          <div className="space-y-3 pt-2">
            <input className="w-full rounded-xl border bg-background px-3 py-3" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Descripción" />
            <MoneyInput className="w-full rounded-xl border bg-background px-3 py-3" value={editAmount} onValueChange={setEditAmount} placeholder="Monto" />
            <input className="w-full rounded-xl border bg-background px-3 py-3" type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
            <select className="w-full rounded-xl border bg-background px-3 py-3" value={editType} onChange={(e) => setEditType(e.target.value as "income" | "expense")}> 
              <option value="income">Ingreso</option>
              <option value="expense">Gasto</option>
            </select>
            <select className="w-full rounded-xl border bg-background px-3 py-3" value={editCategoryId || ""} onChange={(e) => setEditCategoryId(e.target.value || null)}>
              <option value="">Sin categoría</option>
            </select>
          </div>
        </BaseModalForm>
      )}

      {deletingTxId && (
        <BaseModalForm
          title="Eliminar transacción"
          onClose={() => setDeletingTxId(null)}
          footer={
            <div className="space-y-2">
              <Button variant="destructive" onClick={confirmDeleteTx} className="h-12 w-full">Confirmar eliminación</Button>
              <Button variant="outline" onClick={() => setDeletingTxId(null)} className="h-12 w-full">Cancelar</Button>
            </div>
          }
        >
          <p className="pt-2 text-sm text-muted-foreground">Esta acción revertirá el impacto en el balance de la cuenta asociada.</p>
        </BaseModalForm>
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
                (sourceAccount && parsedAmount > sourceAccount.balance) ||
                (sourceAccount && sourceAccount.currency !== paymentCurrency) ||
                isPaying
              }
              className="h-12 w-full rounded-2xl text-base font-semibold"
            >
              {isPaying ? "Procesando..." : `Pagar ${formatCurrency(parsedAmount, paymentCurrency)}`}
            </Button>
          }
        >
            <div className="rounded-2xl bg-muted p-4">
              <p className="text-xs text-muted-foreground">Balance actual ({paymentCurrency})</p>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {formatCurrency(currentDebtByCurrency, paymentCurrency)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Balance al corte: {formatCurrency(pendingStatementByCurrency, paymentCurrency)} · Pago mínimo: {formatCurrency(minPaymentByCurrency, paymentCurrency)}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
              {(["DOP", "USD"] as const).filter((curr) => curr === "DOP" || hasUsdOnCard).map((curr) => (
                <button key={curr} onClick={() => { setPaymentCurrency(curr); setPaymentSource(""); setPaymentAmount(""); setPaymentComment(""); setPaymentKind("custom") }} className={cn("rounded-lg py-2 text-xs font-medium", paymentCurrency === curr ? "bg-card" : "text-muted-foreground")}>{curr}</button>
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
                    .filter((a) => a.type !== "credit" && a.currency === paymentCurrency)
                    .map((acc) => ({ id: acc.id, title: acc.name, subtitle: formatCurrency(Number(acc.balance || 0), acc.currency), detail: acc.type }))}
                  selectedId={paymentSource}
                  onSelect={setPaymentSource}
                  emptyMessage={`No hay cuentas ${paymentCurrency}`}
                />
              </div>

              {/* Amount */}
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Monto a pagar
                </p>
                <div className="flex items-center gap-2 rounded-xl bg-muted p-4">
                    <span className="text-lg font-medium text-muted-foreground">{paymentCurrency === "DOP" ? "RD$" : "US$"}</span>
                  <MoneyInput
                    value={paymentAmount}
                    onValueChange={(value) => {
                      setPaymentAmount(value)
                      setPaymentKind("custom")
                    }}
                    placeholder="0"
                    className="flex-1 bg-transparent text-2xl font-bold text-foreground outline-none placeholder:text-muted-foreground/30"
                  />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => { setPaymentAmount(String(currentDebtByCurrency)); setPaymentKind("balance_to_date") }}
                    className="rounded-xl bg-muted px-3 py-2 text-xs font-medium text-foreground"
                  >
                    Deuda actual
                  </button>
                  <button
                    onClick={() => { setPaymentAmount(String(pendingStatementByCurrency)); setPaymentKind("statement_balance") }}
                    className="rounded-xl bg-muted px-3 py-2 text-xs font-medium text-foreground"
                  >
                    Balance al corte
                  </button>
                  <button
                    onClick={() => { setPaymentAmount(String(Math.round(minPaymentByCurrency))); setPaymentKind("minimum_payment") }}
                    className="rounded-xl bg-muted px-3 py-2 text-xs font-medium text-foreground"
                  >
                    Mínimo
                  </button>
                  <button
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

              {/* Warning if insufficient funds */}
              {sourceAccount && parsedAmount > sourceAccount.balance && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-red-600">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-xs">Ese monto supera tu balance disponible.</span>
                </div>
              )}
              {sourceAccount && (
                <p className={cn(
                  "text-xs",
                  parsedAmount > sourceAccount.balance
                    ? "text-red-500"
                    : Number(sourceAccount.balance) <= 1000
                      ? "text-amber-600"
                      : "text-muted-foreground"
                )}>
                  Disponible: {formatCurrency(Number(sourceAccount.balance || 0), paymentCurrency)}
                </p>
              )}
            </div>
        </BaseModalForm>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <BaseModalForm
          title="Editar cuenta"
          onClose={closeEditModal}
          footer={
            <Button
              onClick={handleEditSubmit}
              disabled={!editForm.name || isEditing}
              className="h-12 w-full rounded-2xl text-base font-semibold"
            >
              {isEditing ? "Guardando..." : "Guardar cambios"}
            </Button>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nombre</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="mt-1 w-full rounded-xl bg-muted p-3 text-sm text-foreground outline-none"
                  placeholder="Ej. Cuenta de Ahorros"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Tipo</label>
                <div className="mt-1 grid grid-cols-3 gap-2">
                  {[
                    { id: "cash", label: "Efectivo", icon: Banknote },
                    { id: "debit", label: "Débito", icon: Building2 },
                    { id: "credit", label: "Crédito", icon: CreditCard },
                  ].map((type) => {
                    const TypeIcon = type.icon
                    const isSelected = editForm.type === type.id
                    return (
                      <button
                        key={type.id}
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
                <label className="text-xs font-medium text-muted-foreground">Moneda</label>
                <div className="mt-1 flex gap-2">
                  {(["DOP", "USD"] as Currency[]).map((currency) => (
                    <button
                      key={currency}
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
                <label className="text-xs font-medium text-muted-foreground">Balance inicial</label>
                <MoneyInput
                  value={editForm.balance}
                  onValueChange={(value) => setEditForm({ ...editForm, balance: value })}
                  className="mt-1 w-full rounded-xl bg-muted p-3 text-sm text-foreground outline-none"
                />
              </div>
              {editForm.type === "credit" && (
                <>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {editForm.currency !== "USD" && <div>
                      <label className="text-xs font-medium text-muted-foreground">Límite de crédito</label>
                      <MoneyInput
                        value={editForm.credit_limit}
                        onValueChange={(value) => setEditForm({ ...editForm, credit_limit: value, credit_limit_dop: value })}
                        className="mt-1 w-full rounded-xl bg-muted p-3 text-sm text-foreground outline-none"
                      />
                    </div>}
                    {editForm.currency !== "DOP" && <div>
                      <label className="text-xs font-medium text-muted-foreground">Límite de crédito USD</label>
                      <MoneyInput
                        value={editForm.credit_limit_usd}
                        onValueChange={(value) => setEditForm({ ...editForm, credit_limit_usd: value })}
                        className="mt-1 w-full rounded-xl bg-muted p-3 text-sm text-foreground outline-none"
                      />
                    </div>}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Día de corte</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={editForm.closing_date}
                      onChange={(e) => setEditForm({ ...editForm, closing_date: e.target.value.replace(/[^0-9]/g, "").slice(0, 2) })}
                      className="mt-1 w-full rounded-xl bg-muted p-3 text-sm text-foreground outline-none"
                    />
                  </div>
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
                    <button
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
                    <button
                      key={style}
                      onClick={() => setEditForm({ ...editForm, background_style: style })}
                      className={cn("rounded-lg px-2 py-1 text-xs", editForm.background_style === style ? "bg-primary text-primary-foreground" : "bg-muted")}
                    >
                      {style === "gradient" ? "Degradado" : style === "solid" ? "Sólido" : "Soft"}
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
          </BaseModalForm>
        )}

        {/* Delete Modal */}
        {showDeleteModal && (
          <BaseModalForm
            title="Eliminar cuenta"
            onClose={() => {
              setShowDeleteModal(false)
              setDeleteError("")
            }}
            footer={
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeleteModal(false)
                    setDeleteError("")
                  }}
                  className="flex-1 h-12 rounded-2xl"
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteAccount}
                  disabled={isDeleting}
                  className="flex-1 h-12 rounded-2xl bg-red-600 text-white hover:bg-red-700"
                >
                  {isDeleting ? "Eliminando..." : "Eliminar"}
                </Button>
              </div>
            }
          >
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <Trash2 className="h-8 w-8 text-red-600" />
              </div>
              <p className="text-sm text-muted-foreground">
                ¿Estás seguro de que deseas eliminar la cuenta <span className="font-semibold text-foreground">{account.name}</span>? 
                Esta acción no se puede deshacer.
              </p>
              {deleteError && (
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-red-600">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span className="text-xs text-left">{deleteError}</span>
                </div>
              )}
            </div>
          </BaseModalForm>
        )}
      </div>
    )
  }
