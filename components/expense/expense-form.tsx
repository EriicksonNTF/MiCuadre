"use client"

import { useEffect, useMemo, useRef, useState } from "react"
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
import { useAccounts, useCategories, createFinancialSubscription, createTransaction, createCategory, useTransactions } from "@/hooks/use-data"

import { formatCurrency, getAvailableCredit, getAvailableCreditByCurrency, getCurrencySymbol } from "@/lib/data"
import { getLocalDateString } from "@/lib/data"
import { EventBus } from "@/lib/event-bus"
import { FINANCIAL_SUBSCRIPTION_PROVIDERS, getNextFinancialBillingDateFrom } from "@/lib/financial-subscriptions"
import { showToast } from "@/components/toast/smart-toast"
import { useEntitlementBlocked } from "@/hooks/use-entitlement-blocked"
import { UpsellModal } from "@/components/entitlements/upsell-modal"
import { useEntitlements } from "@/hooks/use-entitlements"
import { createBlockedResponse } from "@/lib/entitlements/entitlement-copy"

const categoryUiByName: Record<string, { icon: typeof MoreHorizontal; color: string }> = {
  comida: { icon: Utensils, color: "bg-orange-100/30 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400" },
  transporte: { icon: Car, color: "bg-blue-100/30 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" },
  compras: { icon: ShoppingBag, color: "bg-pink-100/30 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400" },
  servicios: { icon: Zap, color: "bg-amber-100/30 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" },
  celular: { icon: Smartphone, color: "bg-violet-100/30 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400" },
  vivienda: { icon: Home, color: "bg-emerald-100/30 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" },
  entretenimiento: { icon: Film, color: "bg-red-100/30 dark:bg-red-900/30 text-red-600 dark:text-red-400" },
  salud: { icon: Heart, color: "bg-rose-100/30 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400" },
  educacion: { icon: GraduationCap, color: "bg-indigo-100/30 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400" },
  ejercicio: { icon: Dumbbell, color: "bg-teal-100/30 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400" },
  regalos: { icon: Gift, color: "bg-amber-100/30 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" },
  salario: { icon: Briefcase, color: "bg-emerald-100/30 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" },
  freelance: { icon: TrendingUp, color: "bg-blue-100/30 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" },
}

type Currency = "DOP" | "USD"
type TransactionType = "expense" | "income"
type CreditCardIncomeKind = "card_payment" | "card_refund" | "card_adjustment" | "card_cashback"

const creditCardIncomeOptions: Array<{ value: CreditCardIncomeKind; label: string; description: string; countAsIncome: boolean }> = [
  { value: "card_payment", label: "Abono a tarjeta", description: "Reduce la deuda y no cuenta como ingreso real.", countAsIncome: false },
  { value: "card_refund", label: "Reembolso", description: "Devolución o reverso aplicado a la tarjeta.", countAsIncome: true },
  { value: "card_adjustment", label: "Ajuste positivo", description: "Corrección manual del balance de tarjeta.", countAsIncome: false },
  { value: "card_cashback", label: "Cashback", description: "Beneficio o devolución de consumo.", countAsIncome: true },
]

type ExpensePrefill = {
  amount?: string
  description?: string
  currency?: Currency | null
  date?: string
  categoryName?: string
}

export function ExpenseForm({ onBack, prefill }: { onBack?: () => void; prefill?: ExpensePrefill }) {
  const { data: rawAccounts = [] } = useAccounts()
  const { data: dbCategories = [] } = useCategories()
  const { data: rawTransactions = [] } = useTransactions(150)
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
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [applyCommission, setApplyCommission] = useState(false)
  const [creditCardIncomeKind, setCreditCardIncomeKind] = useState<CreditCardIncomeKind>("card_payment")
  const [isSaving, setIsSaving] = useState(false)

  const [subscriptionProvider, setSubscriptionProvider] = useState("netflix")
  const [subscriptionMode, setSubscriptionMode] = useState<"once" | "recurring">("once")
  const [billingDay, setBillingDay] = useState(String(new Date().getDate()))
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [newCategoryType, setNewCategoryType] = useState<"expense" | "income" | "both">("expense")

  // Load last used account and currency for quick prefill next time
  useEffect(() => {
    if (typeof window === "undefined" || accounts.length === 0) return

    const lastAcc = localStorage.getItem("micuadre:last_account_id")
    const lastCur = localStorage.getItem("micuadre:last_currency")

    if (lastAcc && accounts.some((a) => a.id === lastAcc)) {
      setAccountId(lastAcc)
    } else {
      const cashAcc = accounts.find((a) => a.type === "cash")
      if (cashAcc) {
        setAccountId(cashAcc.id)
      } else if (accounts.length > 0) {
        setAccountId(accounts[0].id)
      }
    }

    if (lastCur === "DOP" || lastCur === "USD") {
      setCurrency(lastCur as Currency)
    }
  }, [accounts])

  // Heuristic: suggest category, account, and amount when user types a description
  const descriptionSuggestion = useMemo(() => {
    if (!description || transactionType !== "expense" || !rawTransactions || rawTransactions.length === 0) return null
    const normalizedDesc = description.trim().toLowerCase()
    if (normalizedDesc.length < 3) return null

    // Find the most recent matching transaction
    const match = rawTransactions.find(
      (tx) => tx.type === "expense" && tx.description && tx.description.toLowerCase().includes(normalizedDesc)
    )

    if (!match) return null

    // Don't suggest if it's the exact same as currently set
    if (match.category_id === category && match.account_id === accountId) return null

    return {
      description: match.description,
      amount: String(match.amount),
      currency: match.currency as Currency,
      accountId: match.account_id,
      categoryId: match.category_id,
      categoryName: match.category?.name || "Gastos",
    }
  }, [description, transactionType, category, accountId, rawTransactions])

  const categories = useMemo(() => {
    const allowedTypes = transactionType === "expense" ? ["expense", "both"] : ["income", "both"]
    return dbCategories
      .filter((cat) => allowedTypes.includes(cat.type))
      .map((cat) => {
        const ui = categoryUiByName[cat.name.toLowerCase()] || { icon: MoreHorizontal, color: "bg-muted/50 text-muted-foreground" }
        return { id: cat.id, label: cat.name, icon: ui.icon, color: ui.color }
      })
  }, [dbCategories, transactionType])

  const selectedCategory = categories.find(c => c.id === category) || categories[0]
  const selectedDbCategory = dbCategories.find((item) => item.id === selectedCategory?.id)
  const isSubscriptionCategory = Boolean(selectedDbCategory?.is_subscription || selectedDbCategory?.name.toLowerCase().includes("suscrip"))
  const selectedAccount = accounts.find(a => a.id === accountId)
  const selectedRawAccount = rawAccounts.find((account) => account.id === accountId)
  const isCredit = selectedAccount?.type === "credit"
  const supportedCurrencies = useMemo<Currency[]>(() => {
    if (!selectedRawAccount) return ["DOP", "USD"]
    if (selectedRawAccount.type !== "credit") return [selectedRawAccount.currency as Currency]
    const currencies: Currency[] = []
    if (Number(selectedRawAccount.credit_limit_dop || selectedRawAccount.current_debt_dop || 0) > 0 || selectedRawAccount.currency === "DOP") {
      currencies.push("DOP")
    }
    if (Number(selectedRawAccount.credit_limit_usd || selectedRawAccount.current_debt_usd || 0) > 0 || selectedRawAccount.currency === "USD") {
      currencies.push("USD")
    }
    return currencies.length > 0 ? currencies : [selectedRawAccount.currency as Currency]
  }, [selectedRawAccount])
  const isCreditCardIncome = transactionType === "income" && isCredit
  const selectedCreditCardIncomeOption = creditCardIncomeOptions.find((option) => option.value === creditCardIncomeKind) || creditCardIncomeOptions[0]
  const availableAmount = selectedRawAccount
    ? isCredit
      ? getAvailableCreditByCurrency(selectedRawAccount as any, currency)
      : Number(selectedRawAccount.balance)
    : 0

  const parsedAmount = useMemo(() => {
    const cleaned = amount.replace(/[^0-9.]/g, "")
    const num = parseFloat(cleaned)
    return isNaN(num) ? null : num
  }, [amount])

  const commissionAmount = parsedAmount ? Math.round(parsedAmount * 0.15) / 100 : 0
  const totalWithCommission = parsedAmount ? parsedAmount + (transactionType === "expense" && applyCommission ? commissionAmount : 0) : 0

  useEffect(() => {
    if (supportedCurrencies.length > 0 && !supportedCurrencies.includes(currency)) {
      setCurrency(supportedCurrencies[0])
    }
  }, [currency, supportedCurrencies])

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
        title: isCredit ? "Crédito insuficiente" : "Saldo insuficiente",
        body: `Disponible: ${formatCurrency(availableAmount, currency)}`,
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
      const metadata = isCreditCardIncome
        ? {
            kind: "credit_card_income",
            movement_kind: creditCardIncomeKind,
            reporting_treatment: selectedCreditCardIncomeOption.countAsIncome ? "income_adjustment" : "exclude_from_income",
            affects_credit_debt: true,
          }
        : null

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
        metadata,
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

      // Save last used account and currency for quick prefill next time
      if (typeof window !== "undefined") {
        localStorage.setItem("micuadre:last_account_id", targetAccountId)
        localStorage.setItem("micuadre:last_currency", currency)
      }

      const isDeviceOnline = typeof navigator !== "undefined" ? navigator.onLine : true
      showToast({
        title: isCreditCardIncome ? selectedCreditCardIncomeOption.label : transactionType === "income" ? "Ingreso registrado" : "Gasto guardado",
        body: isDeviceOnline
          ? `${formatCurrency(parsedAmount, currency)} · ${description}`
          : "Gasto guardado sin conexión. Se sincronizará cuando vuelva internet.",
        type: "success",
        duration: isDeviceOnline ? 2500 : 3500,
      })
      EventBus.emit({ type: "transaction_created", payload: { type: transactionType, amount: parsedAmount, currency } })
      
      setIsSaving(false)
      setAmount("")
      setDescription("")
      setCategory("")
      setDate(new Date())
      setApplyCommission(false)
      setCreditCardIncomeKind("card_payment")
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

  const appliedPrefillRef = useRef<string | null>(null)

  useEffect(() => {
    const prefillKey = prefill?.description ?? ""
    if (!prefill || appliedPrefillRef.current === prefillKey) return
    appliedPrefillRef.current = prefillKey

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
  }, [prefill, categories])

  return (
    <div className="app-scroll flex h-[100dvh] flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-3 px-5 pb-2 pt-[calc(1.5rem+env(safe-area-inset-top))] sm:px-6">
        {onBack && (
          <button type="button"
            onClick={onBack}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-card ring-1 ring-border transition-colors hover:bg-muted"
          >
            <ChevronLeft className="h-5 w-5 text-foreground" />
          </button>
        )}
        <h1 className="text-xl font-extrabold tracking-tight text-foreground">Nueva transacción</h1>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-6 pt-3 sm:space-y-6 sm:px-6 sm:pt-4">
        <div className="flex h-12 overflow-hidden rounded-2xl bg-card/80 p-1 ring-1 ring-border/70">
          <button type="button"
            onClick={() => {
              setTransactionType("expense")
              setCategory("")
            }}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-xl text-[0.8125rem] transition-all",
              transactionType === "expense"
                ? "bg-primary text-primary-foreground font-bold"
                : "text-muted-foreground"
            )}
          >
            <TrendingDown className="h-4 w-4" />
            Gasto
          </button>
          <button type="button"
            onClick={() => {
              setTransactionType("income")
              setCategory("")
            }}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-xl text-[0.8125rem] transition-all",
              transactionType === "income"
                 ? "bg-emerald-600 text-emerald-50 font-bold"
                : "text-muted-foreground"
            )}
          >
            <TrendingUp className="h-4 w-4" />
            Ingreso
          </button>
        </div>

        <div className="text-center">
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-2xl font-medium text-muted-foreground">
              {getCurrencySymbol(currency)}
            </span>
            <MoneyInput
              value={amount}
              onValueChange={handleAmountChange}
              placeholder="0"
              className="w-full max-w-[240px] bg-transparent text-center text-[clamp(2.75rem,15vw,4.5rem)] font-extrabold leading-none text-foreground outline-none placeholder:text-muted-foreground/30"
              autoFocus
            />
          </div>

          <div className="mt-3 flex items-center justify-center gap-2">
            {supportedCurrencies.length > 1 ? (
              <div className="inline-flex h-9 overflow-hidden rounded-full bg-muted/70 p-0.5">
                {(["DOP", "USD"] as Currency[]).filter((item) => supportedCurrencies.includes(item)).map((item) => (
                  <button type="button"
                    key={item}
                    onClick={() => setCurrency(item)}
                    className={cn(
                      "flex items-center justify-center rounded-full px-3.5 text-xs font-medium transition-colors",
                      currency === item
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {item}
                  </button>
                ))}
              </div>
            ) : (
              <span className="text-xs font-medium text-muted-foreground">{supportedCurrencies[0] === "USD" ? "Dólares" : "Pesos dominicanos"}</span>
            )}

            {transactionType === "expense" && (
              <button type="button"
                onClick={() => setApplyCommission((prev) => !prev)}
                className={cn(
                  "inline-flex h-9 items-center justify-center rounded-full px-3.5 text-xs font-medium transition-colors",
                  applyCommission ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground"
                )}
              >
                +0.15%
              </button>
            )}
          </div>

          {transactionType === "expense" && applyCommission && parsedAmount !== null && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Comisión: {formatCurrency(commissionAmount)} · Total: {formatCurrency(totalWithCommission)}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <button type="button" className="flex h-16 w-full flex-col items-start justify-center rounded-2xl bg-card px-4 ring-1 ring-border/60">
                <span className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">Fecha</span>
                <span className="mt-1 text-sm font-semibold text-foreground">{format(date, "d MMM yyyy", { locale: es })}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => {
                  if (!d) return
                  setDate(d)
                  setDatePickerOpen(false)
                }}
                initialFocus
              />
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
            <span className="flex items-center gap-1 text-[0.6875rem] uppercase tracking-wide">
              <Repeat className="h-3.5 w-3.5" /> Recurrente
            </span>
            <span className="mt-1 text-sm font-semibold">
              {!isRecurringEnabled ? "No disponible" : subscriptionMode === "recurring" ? "Activado" : "Desactivado"}
            </span>
          </button>
        </div>

        {isRecurringEnabled && subscriptionMode === "recurring" && (
          <div className="rounded-2xl bg-card p-4 ring-1 ring-border/60">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Suscripción recurrente</p>
            <div className="grid grid-cols-2 gap-2">
              <select value={subscriptionProvider} onChange={(event) => setSubscriptionProvider(event.target.value)} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm">
                  {FINANCIAL_SUBSCRIPTION_PROVIDERS.map((provider) => (
                  <option key={provider.key} value={provider.key}>{provider.name}</option>
                ))}
              </select>
              <input value={billingDay} onChange={(event) => setBillingDay(event.target.value)} min={1} max={31} type="number" className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm" placeholder="Día" />
            </div>
          </div>
        )}

        <div>
          <p className="mb-3 px-1 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Cuenta</p>
          <AccountCarouselSelector
            items={rawAccounts
              .map((account) => ({
                id: account.id,
                title: account.name,
                subtitle: account.type === "credit" ? `Disponible: ${formatCurrency(getAvailableCredit(account))}` : `Balance: ${formatCurrency(Number(account.balance || 0), account.currency as Currency)}`,
                detail: account.type,
              }))}
            selectedId={accountId}
            onSelect={setAccountId}
          />
          
          {isCredit && transactionType === "expense" && (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-orange-50 px-4 py-3 dark:bg-orange-950/30">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-orange-600 dark:text-orange-400" />
              <p className="text-xs text-orange-700 dark:text-orange-300">
                Este gasto aumentará tu deuda de tarjeta
              </p>
            </div>
          )}
          
          {selectedRawAccount && (
            <p className={cn(
              "mt-2 px-1 text-xs",
              exceedsAvailable
                ? "text-red-500"
                : availableAmount <= 1000
                  ? "text-amber-600"
                  : "text-muted-foreground"
            )}>
              {isCredit ? (
                <>Disponible: {formatCurrency(getAvailableCreditByCurrency(selectedRawAccount as any, currency), currency)}</>
              ) : (
                <>Balance: {formatCurrency(selectedRawAccount.balance, selectedRawAccount.currency as Currency)}</>
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
          <p className="mb-3 px-1 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Categoría</p>
          <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => setShowCategoryModal(true)}
              aria-label="Crear nueva categoría"
              className="w-20 shrink-0"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-border/60 bg-muted/30 transition-colors hover:bg-muted">
                <Plus className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="mt-2 truncate text-xs text-muted-foreground">Nueva</p>
            </button>
            {categories.map((cat) => {
              const Icon = cat.icon
              const selected = (category || categories[0]?.id) === cat.id
              return (
                <button type="button"
                  key={cat.id}
                  aria-label={cat.label}
                  aria-pressed={selected}
                  onClick={() => setCategory(cat.id)}
                  className="w-20 shrink-0"
                >
                  <div className={cn("mx-auto flex h-14 w-14 items-center justify-center rounded-full ring-1 transition-all", cat.color, selected ? "ring-primary scale-[1.03]" : "ring-border") }>
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className={cn("mt-2 line-clamp-2 min-h-8 text-xs leading-4", selected ? "font-semibold text-foreground" : "text-muted-foreground")}>{cat.label}</p>
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label htmlFor="expense-note" className="mb-2 block px-1 text-xs font-medium text-muted-foreground">Nota (opcional)</label>
          <textarea
            id="expense-note"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Añade una descripción..."
            className="min-h-24 w-full rounded-2xl border-0 bg-card p-4 text-sm text-foreground outline-none ring-1 ring-border/60 placeholder:text-muted-foreground/50 focus:ring-accent"
          />
          {descriptionSuggestion && (
            <button
              type="button"
              onClick={() => {
                setAmount(descriptionSuggestion.amount)
                setCurrency(descriptionSuggestion.currency)
                if (descriptionSuggestion.accountId) setAccountId(descriptionSuggestion.accountId)
                if (descriptionSuggestion.categoryId) setCategory(descriptionSuggestion.categoryId)
                showToast({
                  title: "Sugerencia aplicada",
                  body: `Autocompletado con tu último gasto en "${descriptionSuggestion.description}"`,
                  type: "success",
                  duration: 2000,
                })
              }}
              className="mt-2 flex w-full items-center justify-between rounded-xl bg-muted/65 px-4 py-2.5 text-xs text-muted-foreground transition hover:bg-muted active:scale-99 border border-dashed border-border animate-in fade-in slide-in-from-top-1"
            >
              <span>¿Autocompletar como el último?</span>
              <span className="font-semibold text-primary">
                {getCurrencySymbol(descriptionSuggestion.currency)}{parseFloat(descriptionSuggestion.amount).toLocaleString()} en {descriptionSuggestion.categoryName}
              </span>
            </button>
          )}

          {isCreditCardIncome && (
            <div className="mt-3 rounded-2xl border border-border bg-card p-3">
              <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">Tipo de ingreso en tarjeta</p>
              <div className="grid grid-cols-2 gap-2">
                {creditCardIncomeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setCreditCardIncomeKind(option.value)}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-left transition-colors",
                      creditCardIncomeKind === option.value
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-background text-muted-foreground"
                    )}
                  >
                    <span className="block text-xs font-semibold">{option.label}</span>
                    <span className="mt-1 block text-[0.6875rem] leading-snug">{option.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 z-20 border-t border-border/60 bg-card px-5 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:px-6">
        <Button
          onClick={handleSave}
          disabled={!isValid || isSaving}
          className={cn(
            "mobile-action-button w-full text-base transition-all",
            transactionType === "income"
              ? "bg-emerald-600 hover:bg-emerald-700 text-emerald-50"
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

      {showCategoryModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/20 backdrop-blur-sm px-6">
          <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-2xl ring-1 ring-border">
            <h2 className="mb-4 text-lg font-extrabold text-foreground">Nueva categoría</h2>
            <label htmlFor="new-category-name" className="mb-1 block text-xs font-medium text-muted-foreground">Nombre</label>
            <input
              id="new-category-name"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Ej: Supermercado"
              autoFocus
              className="mb-4 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="mb-1 flex items-center justify-between">
              <span className="block text-xs font-medium text-muted-foreground">Tipo</span>
              <span id="new-category-type-label" className="text-[0.6875rem] text-muted-foreground">
                {newCategoryType === "expense" ? "Gasto" : newCategoryType === "income" ? "Ingreso" : "Ambos"}
              </span>
            </div>
            <div role="radiogroup" aria-labelledby="new-category-type-label" className="mb-6 flex gap-2">
              {(["expense", "income", "both"] as const).map((t) => (
                <button type="button"
                  key={t}
                  role="radio"
                  aria-checked={newCategoryType === t}
                  onClick={() => setNewCategoryType(t)}
                  className={cn(
                    "flex-1 rounded-xl py-2.5 text-xs font-semibold transition-colors ring-1",
                    newCategoryType === t
                      ? "bg-primary text-primary-foreground ring-primary"
                      : "bg-background text-muted-foreground ring-border"
                  )}
                >
                  {t === "expense" ? "Gasto" : t === "income" ? "Ingreso" : "Ambos"}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button type="button"
                onClick={() => {
                  setShowCategoryModal(false)
                  setNewCategoryName("")
                }}
                className="flex-1 rounded-xl bg-muted py-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted/70"
              >
                Cancelar
              </button>
              <button type="button"
                onClick={async () => {
                  const trimmed = newCategoryName.trim()
                  if (!trimmed) return
                  try {
                    const created = await createCategory({
                      name: trimmed,
                      type: newCategoryType,
                      icon: "circle",
                      color: "#6366f1",
                      is_default: false,
                      is_subscription: false,
                    })
                    setCategory(created.id)
                    setNewCategoryName("")
                    setShowCategoryModal(false)
                  } catch {
                    showToast({ title: "Error", body: "No se pudo crear la categoría", type: "error", duration: 2500 })
                  }
                }}
                className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
