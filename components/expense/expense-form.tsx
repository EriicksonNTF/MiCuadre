"use client"

import { useState, useMemo } from "react"
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
  CalendarIcon,
  Check,
  ChevronLeft,
  Banknote,
  Building2,
  CreditCard,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Briefcase,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { useAccounts, useCategories, createTransaction } from "@/hooks/use-data"

import { formatCurrency, getAvailableCredit } from "@/lib/data"
import { notify } from "@/lib/notifications"
import { EventBus } from "@/lib/event-bus"
import type { AccountType } from "@/lib/types/database"


const expenseCategories = [
  { id: "food", label: "Comida", icon: Utensils, color: "bg-orange-50 text-orange-500" },
  { id: "transport", label: "Transporte", icon: Car, color: "bg-blue-50 text-blue-500" },
  { id: "shopping", label: "Compras", icon: ShoppingBag, color: "bg-pink-50 text-pink-500" },
  { id: "utilities", label: "Servicios", icon: Zap, color: "bg-amber-50 text-amber-500" },
  { id: "phone", label: "Celular", icon: Smartphone, color: "bg-violet-50 text-violet-500" },
  { id: "rent", label: "Vivienda", icon: Home, color: "bg-emerald-50 text-emerald-500" },
  { id: "entertainment", label: "Entretenimiento", icon: Film, color: "bg-red-50 text-red-500" },
  { id: "health", label: "Salud", icon: Heart, color: "bg-rose-50 text-rose-500" },
  { id: "education", label: "Educación", icon: GraduationCap, color: "bg-indigo-50 text-indigo-500" },
  { id: "fitness", label: "Ejercicio", icon: Dumbbell, color: "bg-teal-50 text-teal-500" },
  { id: "gifts", label: "Regalos", icon: Gift, color: "bg-amber-50 text-amber-600" },
  { id: "other", label: "Otro", icon: MoreHorizontal, color: "bg-gray-50 text-gray-500" },
]

const incomeCategories = [
  { id: "salary", label: "Salario", icon: Briefcase, color: "bg-emerald-50 text-emerald-600" },
  { id: "freelance", label: "Freelance", icon: TrendingUp, color: "bg-blue-50 text-blue-600" },
  { id: "gift", label: "Regalo", icon: Gift, color: "bg-pink-50 text-pink-500" },
  { id: "other", label: "Otro", icon: MoreHorizontal, color: "bg-gray-50 text-gray-500" },
]

const accountIcons: Record<AccountType, typeof Banknote> = {
  cash: Banknote,
  debit: Building2,
  credit: CreditCard,
}

type Currency = "DOP" | "USD"
type TransactionType = "expense" | "income"

export function ExpenseForm({ onBack }: { onBack?: () => void }) {
  const { data: rawAccounts = [] } = useAccounts()
  const { data: dbCategories = [] } = useCategories()

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
  const [isSaving, setIsSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  const categories = transactionType === "expense" ? expenseCategories : incomeCategories
  const selectedCategory = categories.find(c => c.id === category) || categories[0]
  const CategoryIcon = selectedCategory?.icon || MoreHorizontal
  const selectedAccount = accounts.find(a => a.id === accountId)
  const isCredit = selectedAccount?.type === "credit"

  const parsedAmount = useMemo(() => {
    const cleaned = amount.replace(/[^0-9.]/g, "")
    const num = parseFloat(cleaned)
    return isNaN(num) ? null : num
  }, [amount])

  const handleAmountChange = (value: string) => {
    // Only allow numbers and one decimal point
    const cleaned = value.replace(/[^0-9.]/g, "")
    const parts = cleaned.split(".")
    if (parts.length > 2) return
    setAmount(cleaned)
  }

  const handleSave = async () => {
    if (!parsedAmount || !description) return
    
    setIsSaving(true)
    try {
      const categoryUuid = dbCategories.find(
        c => c.name.toLowerCase() === selectedCategory.label.toLowerCase()
      )?.id || null

      const targetAccountId = accountId === "cash" 
        ? rawAccounts.find(a => a.type === "cash")?.id || accountId 
        : accountId

      await createTransaction({
        account_id: targetAccountId,
        category_id: categoryUuid,
        type: transactionType,
        amount: parsedAmount,
        currency: currency,
        description: description,
        date: date.toISOString(),
        notes: null,
        is_recurring: false,
        amount_base: parsedAmount,
        exchange_rate: 1,
      })

      notify({ 
        title: transactionType === "income" ? "Ingreso registrado" : "Gasto registrado", 
        message: transactionType === "income" 
          ? `Se agregó un ingreso de ${formatCurrency(parsedAmount)}` 
          : `Se registró un gasto de ${formatCurrency(parsedAmount)}`
      })
      EventBus.emit({ type: "transaction_created", payload: { type: transactionType, amount: parsedAmount } })
      
      setIsSaving(false)
      setShowSuccess(true)
      
      setTimeout(() => {
        setShowSuccess(false)
        setAmount("")
        setDescription("")
        setCategory("")
        setDate(new Date())
      }, 1500)
    } catch (error) {
      console.error(error)
      setIsSaving(false)
    }
  }


  const isValid = parsedAmount !== null && parsedAmount > 0 && description.length > 0

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 pb-2 pt-8">
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

      <div className="flex-1 px-6 pt-6">
        {/* Transaction Type Toggle - VERY VISIBLE */}
        <div className="flex h-14 overflow-hidden rounded-2xl bg-card p-1">
          <button
            onClick={() => {
              setTransactionType("income")
              setCategory("")
            }}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all",
              transactionType === "income"
                ? "bg-emerald-500 text-white"
                : "text-muted-foreground"
            )}
          >
            <TrendingUp className="h-4 w-4" />
            Ingreso
          </button>
          <button
            onClick={() => {
              setTransactionType("expense")
              setCategory("")
            }}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all",
              transactionType === "expense"
                ? "bg-red-500 text-white"
                : "text-muted-foreground"
            )}
          >
            <TrendingDown className="h-4 w-4" />
            Gasto
          </button>
        </div>

        {/* Amount Input - BIG AND CENTERED */}
        <div className="mt-10 flex flex-col items-center">
          <p className="text-xs font-medium text-muted-foreground mb-4">
            {transactionType === "income" ? "Monto recibido" : "Monto gastado"}
          </p>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-medium text-muted-foreground">
              {currency === "DOP" ? "RD$" : "US$"}
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="0"
              className="w-full max-w-[200px] bg-transparent text-center text-5xl font-bold text-foreground outline-none placeholder:text-muted-foreground/30"
              autoFocus
            />
          </div>
          
          {/* Currency Toggle */}
          <div className="mt-4 flex h-9 overflow-hidden rounded-full bg-muted/50">
            <button
              onClick={() => setCurrency("DOP")}
              className={cn(
                "flex items-center justify-center px-4 text-xs font-medium transition-colors",
                currency === "DOP"
                  ? "bg-primary text-primary-foreground rounded-full"
                  : "text-muted-foreground"
              )}
            >
              DOP
            </button>
            <button
              onClick={() => setCurrency("USD")}
              className={cn(
                "flex items-center justify-center px-4 text-xs font-medium transition-colors",
                currency === "USD"
                  ? "bg-primary text-primary-foreground rounded-full"
                  : "text-muted-foreground"
              )}
            >
              USD
            </button>
          </div>
        </div>

        {/* Description - Small and discrete */}
        <div className="mt-8">
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="¿En qué fue?"
            className="h-14 w-full rounded-2xl border-0 bg-card px-5 text-center text-base font-medium text-foreground outline-none ring-1 ring-transparent transition-all placeholder:text-muted-foreground/50 focus:ring-accent"
          />
        </div>

        {/* Account Selector */}
        <div className="mt-6">
          <p className="mb-3 px-1 text-xs font-medium text-muted-foreground">
            Cuenta
          </p>
          <div className="grid grid-cols-3 gap-2">
            {accounts.map((account) => {
              const Icon = accountIcons[account.type]
              const isSelected = accountId === account.id
              // Don't allow credit for income
              const isDisabled = transactionType === "income" && account.type === "credit"
              return (
                <button
                  key={account.id}
                  onClick={() => !isDisabled && setAccountId(account.id)}
                  disabled={isDisabled}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-2xl p-4 transition-all",
                    isDisabled && "opacity-40 cursor-not-allowed",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs font-medium">{account.name}</span>
                </button>
              )
            })}
          </div>
          
          {/* Credit Card Warning */}
          {isCredit && transactionType === "expense" && (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-orange-50 px-4 py-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
              <p className="text-xs text-orange-700">
                Este gasto aumentará tu deuda de tarjeta
              </p>
            </div>
          )}
          
          {/* Show available balance/credit */}
          {selectedAccount && (
            <p className="mt-2 px-1 text-xs text-muted-foreground">
              {isCredit ? (
                <>Disponible: {formatCurrency(getAvailableCredit(selectedAccount))}</>
              ) : (
                <>Balance: {formatCurrency(selectedAccount.balance)}</>
              )}
            </p>
          )}
        </div>

        {/* Category Selector */}
        <div className="mt-6">
          <p className="mb-3 px-1 text-xs font-medium text-muted-foreground">
            Categoría
          </p>
          <Select value={category || categories[0].id} onValueChange={setCategory}>
            <SelectTrigger className="h-14 w-full rounded-2xl border-0 bg-card px-5 text-sm font-medium ring-1 ring-transparent focus:ring-accent">
              <SelectValue placeholder="Seleccionar categoría">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full",
                      selectedCategory?.color
                    )}
                  >
                    <CategoryIcon className="h-4 w-4" />
                  </div>
                  <span>{selectedCategory?.label}</span>
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {categories.map((cat) => {
                const Icon = cat.icon
                return (
                  <SelectItem key={cat.id} value={cat.id} className="py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full",
                          cat.color
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <span>{cat.label}</span>
                    </div>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Date Picker */}
        <div className="mt-6">
          <p className="mb-3 px-1 text-xs font-medium text-muted-foreground">
            Fecha
          </p>
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex h-14 w-full items-center justify-between rounded-2xl bg-card px-5 text-sm font-medium transition-colors">
                <span className="text-foreground">
                  {format(date, "EEEE, d 'de' MMMM", { locale: es })}
                </span>
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => d && setDate(d)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Fixed Save Button */}
      <div className="px-6 pb-nav-safe pt-6">
        <Button
          onClick={handleSave}
          disabled={!isValid || isSaving}
          className={cn(
            "h-14 w-full rounded-2xl text-base font-semibold transition-all",
            showSuccess
              ? "bg-accent text-accent-foreground"
              : transactionType === "income"
              ? "bg-emerald-500 hover:bg-emerald-600 text-white"
              : "bg-primary text-primary-foreground"
          )}
        >
          {showSuccess ? (
            <span className="flex items-center gap-2">
              <Check className="h-5 w-5" />
              Guardado
            </span>
          ) : isSaving ? (
            "Guardando..."
          ) : transactionType === "income" ? (
            "Guardar ingreso"
          ) : (
            "Guardar gasto"
          )}
        </Button>
      </div>
    </div>
  )
}
