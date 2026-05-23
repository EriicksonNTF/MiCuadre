"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  Utensils,
  Car,
  ShoppingBag,
  Zap,
  Smartphone,
  Home,
  Film,
  Heart,
  GraduationCap,
  Dumbbell,
  Gift,
  MoreHorizontal,
  ChevronLeft,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Briefcase,
  Repeat,
  Plus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { MoneyInput } from "@/components/ui/money-input"
import { AccountCarouselSelector } from "@/components/ui/account-carousel-selector"
import { useAccounts, useCategories, createFinancialSubscription, createTransaction } from "@/hooks/use-data"

import { formatCurrency, getAvailableCredit } from "@/lib/data"
import { getLocalDateString } from "@/lib/data"
import { EventBus } from "@/lib/event-bus"
import { FINANCIAL_SUBSCRIPTION_PROVIDERS, getNextFinancialBillingDateFrom } from "@/lib/financial-subscriptions"
import { showToast } from "@/components/toast/smart-toast"
import { useEntitlementBlocked } from "@/hooks/use-entitlement-blocked"
import { UpsellModal } from "@/components/entitlements/upsell-modal"
import { useEntitlements } from "@/hooks/use-entitlements"
import { createBlockedResponse } from "@/lib/entitlements/entitlement-copy"

const categoryUiByName: Record<string, { icon: typeof MoreHorizontal; color: string }> = {
  comida: { icon: Utensils, color: "bg-orange-50 text-orange-500" },
  transporte: { icon: Car, color: "bg-blue-50 text-blue-500" },
  compras: { icon: ShoppingBag, color: "bg-pink-50 text-pink-500" },
  servicios: { icon: Zap, color: "bg-amber-50 text-amber-500" },
  celular: { icon: Smartphone, color: "bg-violet-50 text-violet-500" },
  vivienda: { icon: Home, color: "bg-emerald-50 text-emerald-500" },
  entretenimiento: { icon: Film, color: "bg-red-50 text-red-500" },
  salud: { icon: Heart, color: "bg-rose-50 text-rose-500" },
  educacion: { icon: GraduationCap, color: "bg-indigo-50 text-indigo-500" },
  ejercicio: { icon: Dumbbell, color: "bg-teal-50 text-teal-500" },
  regalos: { icon: Gift, color: "bg-amber-50 text-amber-600" },
  salario: { icon: Briefcase, color: "bg-emerald-50 text-emerald-600" },
  freelance: { icon: TrendingUp, color: "bg-blue-50 text-blue-600" },
}

type Currency = "DOP" | "USD"
type TransactionType = "expense" | "income"

type ExpensePrefill = {
  amount?: string
  description?: string
  currency?: Currency | null
  date?: string
  categoryName?: string
}

export function ExpenseForm({ onBack, prefill }: { onBack?: () => void; prefill?: ExpensePrefill }) {
  const router = useRouter()
  const { data: rawAccounts = [] } = useAccounts()
  const { data: dbCategories = [] } = useCategories()
  const { blocked, isUpsellOpen, handleEntitlementBlocked, closeUpsell } = useEntitlementBlocked()
  const { canUseFinancialSubscriptions } = useEntitlements()

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

  const [transactionType, setTransactionType] = useState<TransactionType>("expense")

  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("")
  const [accountId, setAccountId] = useState("cash")
  const [currency, setCurrency] = useState<Currency>("DOP")
  const [date, setDate] = useState<Date>(new Date())
  const [applyCommission, setApplyCommission] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [prefillApplied, setPrefillApplied] = useState(false)
  const [subscriptionProvider, setSubscriptionProvider] = useState("netflix")
  const [subscriptionMode, setSubscriptionMode] = useState<"once" | "recurring">("once")
  const [billingDay, setBillingDay] = useState(String(new Date().getDate()))

  const categories = useMemo(() => {
    const allowedTypes = transactionType === "expense" ? ["expense", "both"] : ["income", "both"]
    return dbCategories
      .filter((cat) => allowedTypes.includes(cat.type))
      .map((cat) => {
        const ui = categoryUiByName[cat.name.toLowerCase()] || { icon: MoreHorizontal, color: "bg-gray-50 text-gray-500" }
        return { id: cat.id, label: cat.name, icon: ui.icon, color: ui.color }
      })
  }, [dbCategories, transactionType])

  const selectedCategory = categories.find(c => c.id === category) || categories[0]
  const selectedDbCategory = dbCategories.find((item) => item.id === selectedCategory?.id)
  const isSubscriptionCategory = Boolean(selectedDbCategory?.is_subscription || selectedDbCategory?.name.toLowerCase().includes("suscrip"))
  const selectedAccount = accounts.find(a => a.id === accountId)
  const isCredit = selectedAccount?.type === "credit"
  const availableAmount = selectedAccount
    ? isCredit
      ? getAvailableCredit(selectedAccount)
      : Number(selectedAccount.balance)
    : 0

  const parsedAmount = useMemo(() => {
    const cleaned = amount.replace(/[^0-9.]/g, "")
    const num = parseFloat(cleaned)
    return isNaN(num) ? null : num
  }, [amount])

  const commissionAmount = parsedAmount ? Math.round(parsedAmount * 0.15) / 100 : 0
  const totalWithCommission = parsedAmount ? parsedAmount + (transactionType === "expense" && applyCommission ? commissionAmount : 0) : 0

  const handleAmountChange = (value: string) => {
    // Only allow numbers and one decimal point
    const cleaned = value.replace(/[^0-9.]/g, "")
    const parts = cleaned.split(".")
    if (parts.length > 2) return
    setAmount(cleaned)
  }

  const handleSave = async () => {
    if (!parsedAmount) return

    if (transactionType === "expense" && totalWithCommission > availableAmount) {
      showToast({
        title: isCredit ? "Credito insuficiente" : "Saldo insuficiente",
        body: isCredit
          ? `Disponible: ${formatCurrency(availableAmount)}`
          : `Disponible: ${formatCurrency(availableAmount)}`,
        type: "warning",
        duration: 3000,
      })
      return
    }
    
    setIsSaving(true)
    try {
      const categoryUuid = selectedCategory?.id || null

      const targetAccountId = accountId === "cash" 
        ? rawAccounts.find(a => a.type === "cash")?.id || accountId 
        : accountId

      const txDate = getLocalDateString(date)

      await createTransaction({
        account_id: targetAccountId,
        category_id: categoryUuid,
        type: transactionType,
        amount: parsedAmount,
        currency: currency,
        description: description,
        date: txDate,
        notes: null,
        is_recurring: false,
        amount_base: parsedAmount,
        exchange_rate: 1,
        parent_transaction_id: null,
        metadata: null,
      }, { applyCommission })

      if (transactionType === "expense" && subscriptionMode === "recurring") {
        const provider = FINANCIAL_SUBSCRIPTION_PROVIDERS.find((item) => item.key === subscriptionProvider)
        const nextDate = getNextFinancialBillingDateFrom(date, Number(billingDay || date.getDate()))
        await createFinancialSubscription({
          name: provider?.name || description,
          provider_key: provider?.key || "other",
          amount: parsedAmount,
          currency,
          account_id: targetAccountId,
          category_id: categoryUuid,
          billing_day: Number(billingDay || date.getDate()),
          next_payment_date: getLocalDateString(nextDate),
        })
      }

      showToast({
        title: transactionType === "income" ? "Ingreso registrado" : "Gasto guardado",
        body: `${formatCurrency(parsedAmount)} · ${description}`,
        type: "success",
        duration: 2500,
      })
      EventBus.emit({ type: "transaction_created", payload: { type: transactionType, amount: parsedAmount } })
      
      setIsSaving(false)
      setAmount("")
      setDescription("")
      setCategory("")
      setDate(new Date())
      setApplyCommission(false)
      setSubscriptionMode("once")
      onBack?.()
    } catch (error) {
      if (!handleEntitlementBlocked(error)) {
        showToast({
          title: "No se pudo guardar",
          body: "Intenta de nuevo en unos segundos.",
          type: "error",
          duration: 2500,
        })
      }
      setIsSaving(false)
    }
  }


  const exceedsAvailable = transactionType === "expense" && parsedAmount !== null && totalWithCommission > availableAmount
  const isValid = parsedAmount !== null && parsedAmount > 0 && !exceedsAvailable

  const isRecurringEnabled = transactionType === "expense"

  useEffect(() => {
    if (!prefill || prefillApplied) return

    if (prefill.amount) setAmount(prefill.amount)
    if (prefill.description) setDescription(prefill.description)
    if (prefill.currency === "DOP" || prefill.currency === "USD") setCurrency(prefill.currency)

    if (prefill.date) {
      const parsed = new Date(`${prefill.date}T12:00:00`)
      if (!Number.isNaN(parsed.getTime())) setDate(parsed)
    }

    if (prefill.categoryName && categories.length > 0) {
      const matched = categories.find((cat) => cat.label.toLowerCase() === prefill.categoryName?.toLowerCase())
      if (matched) setCategory(matched.id)
    }

    setPrefillApplied(true)
  }, [prefill, prefillApplied, categories])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 px-5 pb-2 pt-6 sm:px-6 sm:pt-8">
        {onBack && (
          <button
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-muted"
          >
            <ChevronLeft className="h-5 w-5 text-foreground" />
          </button>
        )}
        <h1 className="text-lg font-semibold text-foreground">Nueva transacción</h1>
      </header>

      <div className="flex-1 space-y-5 px-5 pb-28 pt-3 sm:space-y-6 sm:px-6 sm:pt-4">
        <div className="flex h-12 overflow-hidden rounded-2xl bg-card/80 p-1 ring-1 ring-border/70">
          <button
            onClick={() => {
              setTransactionType("expense")
              setCategory("")
            }}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-xl text-[13px] transition-all",
              transactionType === "expense"
                ? "bg-primary text-primary-foreground font-bold"
                : "text-muted-foreground"
            )}
          >
            <TrendingDown className="h-4 w-4" />
            Gasto
          </button>
          <button
            onClick={() => {
              setTransactionType("income")
              setCategory("")
            }}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-xl text-[13px] transition-all",
              transactionType === "income"
                 ? "bg-emerald-600 text-white font-bold"
                : "text-muted-foreground"
            )}
          >
            <TrendingUp className="h-4 w-4" />
            Ingreso
          </button>
        </div>

        <div className="rounded-3xl bg-card/70 px-4 py-7 text-center ring-1 ring-border/60 sm:py-8">
          <p className="mb-4 text-xs font-medium text-muted-foreground">
            {transactionType === "income" ? "Monto recibido" : "Monto gastado"}
          </p>
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-2xl font-medium text-muted-foreground">
              {currency === "DOP" ? "RD$" : "US$"}
            </span>
            <MoneyInput
              value={amount}
              onValueChange={handleAmountChange}
              placeholder="0"
              className="w-full max-w-[220px] bg-transparent text-center text-[42px] font-bold leading-none text-foreground outline-none placeholder:text-muted-foreground/30 sm:text-5xl"
              autoFocus
            />
          </div>

          <div className="mt-5 inline-flex h-10 overflow-hidden rounded-full bg-muted/70 p-1">
            <button
              onClick={() => setCurrency("DOP")}
              className={cn(
                "flex items-center justify-center rounded-full px-4 text-xs font-medium transition-colors",
                currency === "DOP"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground"
              )}
            >
              DOP
            </button>
            <button
              onClick={() => setCurrency("USD")}
              className={cn(
                "flex items-center justify-center rounded-full px-4 text-xs font-medium transition-colors",
                currency === "USD"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground"
              )}
            >
              USD
            </button>
          </div>

          {transactionType === "expense" && (
            <button
              onClick={() => setApplyCommission((prev) => !prev)}
              className={cn(
                "mt-3 rounded-full px-4 py-2 text-xs font-medium transition-colors",
                applyCommission ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground"
              )}
            >
              Comisión 0.15%
            </button>
          )}

          {transactionType === "expense" && applyCommission && parsedAmount !== null && (
            <p className="mt-2 text-xs text-muted-foreground">
              Comisión: {formatCurrency(commissionAmount)} · Total: {formatCurrency(totalWithCommission)}
            </p>
          )}
        </div>


        <div className="grid grid-cols-2 gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex h-16 w-full flex-col items-start justify-center rounded-2xl bg-card px-4 ring-1 ring-border/60">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Fecha</span>
                <span className="mt-1 text-sm font-semibold text-foreground">{format(date, "d MMM yyyy", { locale: es })}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus />
            </PopoverContent>
          </Popover>

          <button
            type="button"
            disabled={!isRecurringEnabled}
            onClick={() => {
              if (!isRecurringEnabled) return
              if (subscriptionMode === "once" && !canUseFinancialSubscriptions) {
                handleEntitlementBlocked(createBlockedResponse("financial_subscriptions", { requiredPlan: "pro" }))
                return
              }
              setSubscriptionMode((prev) => (prev === "recurring" ? "once" : "recurring"))
            }}
            className={cn(
              "flex h-16 w-full flex-col items-start justify-center rounded-2xl px-4 ring-1",
              isRecurringEnabled
                ? subscriptionMode === "recurring"
                  ? "bg-primary text-primary-foreground ring-primary/60"
                  : "bg-card text-foreground ring-border/60"
                : "bg-muted/50 text-muted-foreground ring-border/50"
            )}
          >
            <span className="flex items-center gap-1 text-[11px] uppercase tracking-wide">
              <Repeat className="h-3.5 w-3.5" /> Recurrente
            </span>
            <span className="mt-1 text-sm font-semibold">
              {!isRecurringEnabled ? "No disponible" : subscriptionMode === "recurring" ? "Activado" : "Desactivado"}
            </span>
          </button>
        </div>

        {isRecurringEnabled && subscriptionMode === "recurring" && (
          <div className="rounded-2xl bg-card p-4 ring-1 ring-border/60">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Suscripcion recurrente</p>
            <div className="grid grid-cols-2 gap-2">
              <select value={subscriptionProvider} onChange={(event) => setSubscriptionProvider(event.target.value)} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm">
                  {FINANCIAL_SUBSCRIPTION_PROVIDERS.map((provider) => (
                  <option key={provider.key} value={provider.key}>{provider.name}</option>
                ))}
              </select>
              <input value={billingDay} onChange={(event) => setBillingDay(event.target.value)} min={1} max={31} type="number" className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm" placeholder="Dia" />
            </div>
          </div>
        )}

        <div>
          <p className="mb-3 px-1 text-xs font-medium text-muted-foreground">Cuenta</p>
          <AccountCarouselSelector
            items={accounts
              .filter((account) => !(transactionType === "income" && account.type === "credit"))
              .map((account) => ({
                id: account.id,
                title: account.name,
                subtitle: account.type === "credit" ? `Disponible: ${formatCurrency(getAvailableCredit(account), account.currency)}` : `Balance: ${formatCurrency(Number(account.balance || 0), account.currency)}`,
                detail: account.type,
              }))}
            selectedId={accountId}
            onSelect={setAccountId}
          />
          
          {isCredit && transactionType === "expense" && (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-orange-50 px-4 py-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
              <p className="text-xs text-orange-700">
                Este gasto aumentará tu deuda de tarjeta
              </p>
            </div>
          )}
          
          {selectedAccount && (
            <p className={cn(
              "mt-2 px-1 text-xs",
              exceedsAvailable
                ? "text-red-500"
                : availableAmount <= 1000
                  ? "text-amber-600"
                  : "text-muted-foreground"
            )}>
              {isCredit ? (
                <>Disponible: {formatCurrency(getAvailableCredit(selectedAccount))}</>
              ) : (
                <>Balance: {formatCurrency(selectedAccount.balance)}</>
              )}
            </p>
          )}
          {exceedsAvailable && (
            <p className="mt-1 px-1 text-xs text-red-500">
              {isCredit
                ? "Este gasto excede tu crédito disponible."
                : "No puedes mover más dinero del que tienes en esta cuenta."}
            </p>
          )}
        </div>

        <div>
          <p className="mb-3 px-1 text-xs font-medium text-muted-foreground">Categoria</p>
          <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {categories.map((cat) => {
              const Icon = cat.icon
              const selected = (category || categories[0]?.id) === cat.id
              return (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className="w-[76px] shrink-0"
                >
                  <div className={cn("mx-auto flex h-14 w-14 items-center justify-center rounded-full ring-1 transition-all", cat.color, selected ? "ring-primary scale-[1.03]" : "ring-border") }>
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className={cn("mt-2 truncate text-xs", selected ? "font-semibold text-foreground" : "text-muted-foreground")}>{cat.label}</p>
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => router.push("/settings/categories")}
              className="w-[76px] shrink-0"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-border/60 bg-muted/30 transition-colors hover:bg-muted">
                <Plus className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="mt-2 truncate text-xs text-muted-foreground">Nueva</p>
            </button>
          </div>
        </div>

        <div>
          <label className="mb-2 block px-1 text-xs font-medium text-muted-foreground">Nota (opcional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Añade una descripción..."
            className="min-h-24 w-full rounded-2xl border-0 bg-card p-4 text-sm text-foreground outline-none ring-1 ring-border/60 placeholder:text-muted-foreground/50 focus:ring-accent"
          />
        </div>
      </div>

      <div className="sticky bottom-0 border-t border-border/60 bg-background/95 px-5 pb-nav-safe pt-3 backdrop-blur sm:px-6">
        <Button
          onClick={handleSave}
          disabled={!isValid || isSaving}
          className={cn(
            "h-14 w-full rounded-2xl text-base font-semibold transition-all",
            transactionType === "income"
              ? "bg-emerald-500 hover:bg-emerald-600 text-white"
              : "bg-primary text-primary-foreground"
          )}
        >
          {isSaving ? (
            "Guardando..."
          ) : transactionType === "income" ? (
            "Guardar ingreso"
          ) : (
            "Guardar gasto"
          )}
        </Button>
      </div>
      <UpsellModal open={isUpsellOpen} onClose={closeUpsell} blocked={blocked} />
    </div>
  )
}
