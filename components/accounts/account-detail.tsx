"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
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
  Calendar,
  AlertTriangle,
  Settings,
  Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { BaseModalForm } from "@/components/ui/base-modal-form"
import { MoneyInput } from "@/components/ui/money-input"
import { notify } from "@/lib/notifications"
import { EventBus } from "@/lib/event-bus"
import { useAccounts, useTransactions, updateAccount, deleteAccount, payCreditCard } from "@/hooks/use-data"
import { usePersistentState } from "@/hooks/use-persistent-state"
import { formatCurrency, formatDate, getAccountBrandingDefaults, getAvailableCredit, getReadableTextColor } from "@/lib/data"
import { createClient } from "@/lib/supabase/client"
import { BrandedAccountCard } from "@/components/accounts/branded-account-card"
import type { AccountType, Currency } from "@/lib/types/database"


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

const DETAIL_EMOJI_PRESETS = ["💳", "🏦", "💵", "🪙", "🧾", "💼", "🛟", "📈"]

const DETAIL_COLOR_PRESETS = [
  { name: "Azul Banreservas", primary: "#0b4a8a", secondary: "#38bdf8" },
  { name: "Premium oscuro", primary: "#07111f", secondary: "#0ea5e9" },
  { name: "Efectivo esmeralda", primary: "#0f766e", secondary: "#14b8a6" },
  { name: "Ahorro violeta", primary: "#4338ca", secondary: "#8b5cf6" },
  { name: "Acento naranja", primary: "#b45309", secondary: "#fb923c" },
  { name: "Cielo claro", primary: "#0369a1", secondary: "#38bdf8" },
]

type DateRange = "week" | "month" | "all"

interface AccountDetailProps {
  accountId: string
}

export function AccountDetail({ accountId }: AccountDetailProps) {
  const router = useRouter()
  const [dateFilter, setDateFilter] = usePersistentState<DateRange>(`account:${accountId}:dateFilter`, "all")
  const [showPayment, setShowPayment] = useState(false)
  const [paymentSource, setPaymentSource] = useState<string>("")
  const [paymentAmount, setPaymentAmount] = useState("")
  const [isPaying, setIsPaying] = useState(false)

  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [editForm, setEditForm] = useState<{ 
    name: string
    type: AccountType
    currency: Currency
    balance: string
    credit_limit: string
    closing_date: string
    due_date: string
    icon_url: string
    icon_type: "emoji" | "icon" | "image"
    icon_value: string
    primary_color: string
    secondary_color: string
    background_style: string
  }>({ 
    name: "", 
    type: "debit", 
    currency: "DOP",
    balance: "",
    credit_limit: "",
    closing_date: "",
    due_date: "",
    icon_url: "",
    icon_type: "icon",
    icon_value: "building-2",
    primary_color: "#0b4a8a",
    secondary_color: "#38bdf8",
    background_style: "gradient",
  })
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState("")
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)

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
      rawDate: tx.date,
      date: formatDate(tx.date),
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
    })
  }, [accountId, dateFilter, transactions])

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
    try {
      await payCreditCard({
        credit_account_id: accountId,
        source_account_id: paymentSource,
        amount: parsedAmount,
      })
      notify({ title: "Pago completado", message: "El pago de tarjeta fue registrado." })
      EventBus.emit({ type: "card_payment_completed" })
      setShowPayment(false)
      setPaymentSource("")
      setPaymentAmount("")
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
      const parsedClosingDate = editForm.type === "credit" && editForm.closing_date ? Number(editForm.closing_date) : null
      const parsedDueDate = editForm.type === "credit" && editForm.due_date ? Number(editForm.due_date) : null

      await updateAccount(accountId, {
        name: editForm.name,
        type: editForm.type,
        currency: editForm.currency,
        balance: parsedBalance,
        credit_limit: editForm.type === "credit" ? parsedCreditLimit : null,
        closing_date: parsedClosingDate,
        due_date: parsedDueDate,
        icon_url: editForm.icon_url || null,
        icon_type: editForm.icon_type,
        icon_value: editForm.icon_value,
        primary_color: editForm.primary_color,
        secondary_color: editForm.secondary_color,
        background_style: editForm.background_style,
      })
      mutate("accounts")
      notify({ title: "Cuenta actualizada", message: "Los cambios fueron guardados exitosamente." })
      EventBus.emit({ type: "account_updated", payload: { name: editForm.name } })
      setShowEditModal(false)
    } catch (error) {
      console.error(error)
      const message = error instanceof Error ? error.message : "No se pudo actualizar la cuenta"
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

  const parsedAmount = parseFloat(paymentAmount.replace(/[^0-9.]/g, "")) || 0
  const sourceAccount = accounts.find((a) => a.id === paymentSource)

  const uploadAccountLogo = async (file?: File) => {
    if (!file) return
    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"]
    if (!validTypes.includes(file.type) || file.size > 2 * 1024 * 1024) {
      notify({ title: "Archivo no válido", message: "Usa PNG/JPG/WEBP y máximo 2MB." })
      return
    }

    setIsUploadingLogo(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const ext = file.name.split(".").pop() || "png"
      const path = `${user.id}/accounts/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from("account-logos").upload(path, file, { upsert: true, contentType: file.type })
      if (error) throw error
      const { data } = supabase.storage.from("account-logos").getPublicUrl(path)
      setEditForm((prev) => ({ ...prev, icon_url: data.publicUrl, icon_type: "image" }))
    } catch {
      notify({ title: "Error", message: "No se pudo subir el logo." })
    } finally {
      setIsUploadingLogo(false)
    }
  }

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
                  closing_date: String(account.cutoffDate || ""),
                  due_date: String(account.dueDate || ""),
                  icon_url: String(rawAccounts.find((a) => a.id === accountId)?.icon_url || ""),
                  icon_type: (rawAccounts.find((a) => a.id === accountId)?.icon_type || "icon") as "emoji" | "icon" | "image",
                  icon_value: String(rawAccounts.find((a) => a.id === accountId)?.icon_value || "building-2"),
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
            
            {/* Pay button */}
            <Button
              onClick={() => setShowPayment(true)}
              className="h-12 w-full rounded-2xl bg-white/85 text-foreground hover:bg-white"
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
                (sourceAccount && parsedAmount > sourceAccount.balance) ||
                isPaying
              }
              className="h-12 w-full rounded-2xl text-base font-semibold"
            >
              {isPaying ? "Procesando..." : `Pagar ${formatCurrency(parsedAmount)}`}
            </Button>
          }
        >
            <div className="rounded-2xl bg-muted p-4">
              <p className="text-xs text-muted-foreground">Deuda actual</p>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {formatCurrency(account.currentDebt || 0)}
              </p>
            </div>

            <div className="space-y-4 pb-2">
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
                  <MoneyInput
                    value={paymentAmount}
                    onValueChange={setPaymentAmount}
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
                  Disponible: {formatCurrency(Number(sourceAccount.balance || 0))}
                </p>
              )}
            </div>
        </BaseModalForm>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <BaseModalForm
          title="Editar cuenta"
          onClose={() => setShowEditModal(false)}
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
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Límite de crédito</label>
                    <MoneyInput
                      value={editForm.credit_limit}
                      onValueChange={(value) => setEditForm({ ...editForm, credit_limit: value })}
                      className="mt-1 w-full rounded-xl bg-muted p-3 text-sm text-foreground outline-none"
                    />
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
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Día de pago</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={editForm.due_date}
                      onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value.replace(/[^0-9]/g, "").slice(0, 2) })}
                      className="mt-1 w-full rounded-xl bg-muted p-3 text-sm text-foreground outline-none"
                    />
                  </div>
                </>
              )}

              <div className="space-y-3 rounded-2xl border border-border/70 bg-card/70 p-4">
                <p className="text-sm font-semibold text-foreground">Personalización visual</p>
                <div className="grid grid-cols-3 gap-2">
                  {(["icon", "emoji", "image"] as const).map((value) => (
                    <button
                      key={value}
                      onClick={() => setEditForm({ ...editForm, icon_type: value })}
                      className={cn("rounded-xl px-3 py-2 text-xs font-medium transition-colors", editForm.icon_type === value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}
                    >
                      {value === "icon" ? "Ícono" : value === "emoji" ? "Emoji" : "Logo"}
                    </button>
                  ))}
                </div>

                {editForm.icon_type === "image" ? (
                  <div>
                    <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" onChange={(e) => void uploadAccountLogo(e.target.files?.[0])} className="text-xs" />
                    {isUploadingLogo && <p className="mt-1 text-xs text-muted-foreground">Subiendo logo...</p>}
                  </div>
                ) : editForm.icon_type === "emoji" ? (
                  <div className="grid grid-cols-8 gap-2">
                    {DETAIL_EMOJI_PRESETS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => setEditForm({ ...editForm, icon_value: emoji })}
                        className={cn("rounded-lg p-2 text-lg", editForm.icon_value === emoji ? "bg-primary/15 ring-1 ring-primary" : "bg-muted")}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {DETAIL_ICON_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        onClick={() => setEditForm({ ...editForm, icon_value: preset.value })}
                        className={cn("flex flex-col items-center gap-1 rounded-xl p-2 text-[10px]", editForm.icon_value === preset.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}
                      >
                        <preset.icon className="h-4 w-4" />
                        <span>{preset.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {editForm.icon_type !== "image" && (
                  <input
                    value={editForm.icon_value}
                    onChange={(e) => setEditForm({ ...editForm, icon_value: e.target.value })}
                    className="w-full rounded-xl bg-muted px-3 py-2 text-sm"
                    placeholder={editForm.icon_type === "emoji" ? "💳" : "credit-card"}
                  />
                )}

                <div className="grid grid-cols-2 gap-2">
                  {DETAIL_COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => setEditForm({ ...editForm, primary_color: preset.primary, secondary_color: preset.secondary })}
                      className="rounded-xl border border-border bg-background p-2 text-left"
                    >
                      <div className="h-5 rounded-md" style={{ background: `linear-gradient(135deg, ${preset.primary}, ${preset.secondary})` }} />
                      <p className="mt-1 text-[10px] text-muted-foreground">{preset.name}</p>
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input type="color" value={editForm.primary_color} onChange={(e) => setEditForm({ ...editForm, primary_color: e.target.value })} className="h-10 w-full rounded-lg" />
                  <input type="color" value={editForm.secondary_color} onChange={(e) => setEditForm({ ...editForm, secondary_color: e.target.value })} className="h-10 w-full rounded-lg" />
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
