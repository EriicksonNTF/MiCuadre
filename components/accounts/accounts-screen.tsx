"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import {
  Banknote,
  Building2,
  CreditCard,
  ArrowRightLeft,
  Plus,
  ChevronRight,
  X,
  ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { PaymentSlider } from "@/components/payment-slider"
import { BaseModalForm } from "@/components/ui/base-modal-form"
import { notify } from "@/lib/notifications"
import { EventBus } from "@/lib/event-bus"
import { useAccounts, createAccount, createTransfer } from "@/hooks/use-data"
import { formatCurrency, getAvailableCredit } from "@/lib/data"
import { createAccountSchema, transferSchema, parseAmount, getFieldError } from "@/lib/validation"
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

export function AccountsScreen() {
  const { data: rawAccounts = [] } = useAccounts()

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

  const [showTransfer, setShowTransfer] = useState(false)
  const [showCreateAccount, setShowCreateAccount] = useState(false)

  // Create account form state
  const [accountName, setAccountName] = useState("")
  const [accountType, setAccountType] = useState<"cash" | "debit" | "credit">("cash")
  const [accountCurrency, setAccountCurrency] = useState<"DOP" | "USD">("DOP")
  const [initialBalance, setInitialBalance] = useState("")
  const [creditLimit, setCreditLimit] = useState("")
  const [closingDate, setClosingDate] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  // Touched state for create account form
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({})

  const createAccountErrors = useMemo(() => ({
    name: getFieldError(createAccountSchema, "name", accountName),
    initialBalance: getFieldError(createAccountSchema, "initialBalance", initialBalance),
    creditLimit: accountType === "credit" ? getFieldError(createAccountSchema, "creditLimit", creditLimit) : undefined,
    closingDate: accountType === "credit" ? getFieldError(createAccountSchema, "closingDate", closingDate) : undefined,
    dueDate: accountType === "credit" ? getFieldError(createAccountSchema, "dueDate", dueDate) : undefined,
  }), [accountName, accountType, initialBalance, creditLimit, closingDate, dueDate])

  const handleBlur = (field: string) => {
    setTouchedFields(prev => ({ ...prev, [field]: true }))
  }

  const handleCreateAccount = async () => {
    setTouchedFields({ name: true, initialBalance: true })
    const result = createAccountSchema.safeParse({
      name: accountName,
      type: accountType,
      currency: accountCurrency,
      initialBalance,
      creditLimit: accountType === "credit" ? creditLimit : undefined,
      closingDate: accountType === "credit" ? closingDate : undefined,
      dueDate: accountType === "credit" ? dueDate : undefined,
    })
    if (!result.success) return
    setIsCreating(true)
    try {
      await createAccount({
        name: accountName,
        type: accountType,
        currency: accountCurrency,
        balance: parseAmount(initialBalance),
        credit_limit: accountType === "credit" ? parseAmount(creditLimit) : null,
        current_debt: 0,
        minimum_payment: null,
        color: "from-slate-500 to-gray-500",
        icon: "Wallet",
        is_active: true,
        closing_date: accountType === "credit" && closingDate ? parseInt(closingDate) : null,
        due_date: accountType === "credit" && dueDate ? parseInt(dueDate) : null,
      })
      notify({ title: "Cuenta creada", message: "Tu cuenta fue creada correctamente." })
      EventBus.emit({ type: "account_created", payload: { name: accountName } })
      setShowCreateAccount(false)
      setAccountName("")
      setAccountType("cash")
      setAccountCurrency("DOP")
      setInitialBalance("")
      setCreditLimit("")
      setClosingDate("")
      setDueDate("")
      setTouchedFields({})
    } finally {
      setIsCreating(false)
    }
  }

  // Transfer form state
  const [fromAccount, setFromAccount] = useState<string>("")
  const [toAccount, setToAccount] = useState<string>("")
  const [transferAmount, setTransferAmount] = useState("")
  const [isTransferring, setIsTransferring] = useState(false)

  const handleTransfer = async () => {
    const validation = transferSchema.safeParse({
      fromAccountId: fromAccount,
      toAccountId: toAccount,
      amount: transferAmount,
      description: undefined,
    })

    if (!validation.success) return

    const amount = parseAmount(transferAmount)
    const source = accounts.find((a) => a.id === fromAccount)
    if (!source) return
    if (amount > source.balance) {
      notify({ title: "Fondos insuficientes", message: "La cuenta de origen no tiene balance suficiente." })
      return
    }

    setIsTransferring(true)
    try {
      await createTransfer({
        from_account_id: fromAccount,
        to_account_id: toAccount,
        amount,
        currency: source.currency,
      })
      notify({ title: "Transferencia exitosa", message: "Se han transferido los fondos." })
      EventBus.emit({ type: "transfer_completed" })
      setShowTransfer(false)
      setFromAccount("")
      setToAccount("")
      setTransferAmount("")
    } catch (error) {
      console.error("Transfer error:", error)
      notify({ title: "Error", message: "No se pudo completar la transferencia." })
    } finally {
      setIsTransferring(false)
    }
  }

  const parsedTransferAmount = parseFloat(transferAmount.replace(/[^0-9.]/g, "")) || 0

  return (
    <div className="min-h-screen bg-background pb-nav-safe">
      {/* Header */}
      <header className="px-6 pb-4 pt-8">
        <h1 className="text-2xl font-bold text-foreground">Cuentas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Administra tu dinero
        </p>
      </header>

      {/* Account Cards */}
      <div className="space-y-4 px-6 pt-4">
        {accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed p-8 text-center bg-card/50">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
              <Banknote className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">No tienes cuentas</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Crea tu primera cuenta para empezar a administrar tu dinero.
            </p>
          </div>
        ) : (
          accounts.map((account) => {
          const Icon = accountIcons[account.type]
          const isCredit = account.type === "credit"

          return (
            <Link
              key={account.id}
              href={`/accounts/${account.id}`}
              className={cn(
                "relative block overflow-hidden rounded-3xl bg-gradient-to-br p-6 text-white transition-transform active:scale-[0.98]",
                accountGradients[account.type]
              )}
            >
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
              <div className="absolute -bottom-4 -right-4 h-20 w-20 rounded-full bg-white/5" />

              <div className="relative">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                    <Icon className="h-5 w-5" />
                  </div>
                  <ChevronRight className="h-5 w-5 opacity-50" />
                </div>

                <p className="mt-6 text-sm font-medium opacity-80">
                  {account.name}
                </p>

                <p className="mt-1 text-2xl font-bold">
                  {isCredit
                    ? formatCurrency(account.currentDebt || 0)
                    : formatCurrency(account.balance)
                  }
                </p>

                {isCredit && account.creditLimit && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-sm opacity-80">
                      <span>Disponible</span>
                      <span className="font-semibold">
                        {formatCurrency(getAvailableCredit(account))}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                      <div
                        className="h-full rounded-full bg-white transition-all"
                        style={{
                          width: `${((account.currentDebt || 0) / account.creditLimit) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs opacity-60">
                      <span>Límite: {formatCurrency(account.creditLimit)}</span>
                      <span>
                        {Math.round(((account.currentDebt || 0) / account.creditLimit) * 100)}% usado
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </Link>
          )
        }))}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 px-6 pt-6">
        <Button
          variant="outline"
          onClick={() => setShowTransfer(true)}
          className="h-12 flex-1 gap-2 rounded-2xl"
        >
          <ArrowRightLeft className="h-4 w-4" />
          Transferir
        </Button>
        <Button
          variant="outline"
          onClick={() => setShowCreateAccount(true)}
          className="h-12 flex-1 gap-2 rounded-2xl"
        >
          <Plus className="h-4 w-4" />
          Nueva cuenta
        </Button>
      </div>

      {/* Transfer Modal */}
      {showTransfer && (
        <BaseModalForm
          title="Transferir dinero"
          onClose={() => setShowTransfer(false)}
          footer={
            <PaymentSlider
              amount={parsedTransferAmount}
              currency={accounts.find(a => a.id === fromAccount)?.currency || "DOP"}
              recipientName={accounts.find(a => a.id === toAccount)?.name || "la cuenta"}
              onConfirm={handleTransfer}
              disabled={!fromAccount || !toAccount || parsedTransferAmount <= 0 || isTransferring}
            />
          }
        >
          <div className="pb-safe-areas space-y-4">
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Desde</p>
                  <div className="grid grid-cols-3 gap-2">
                    {accounts.filter(a => a.type !== "credit").map((account) => {
                      const Icon = accountIcons[account.type]
                      const isSelected = fromAccount === account.id
                      return (
                        <button key={account.id} onClick={() => setFromAccount(account.id)}
                          className={cn("flex flex-col items-center gap-1 rounded-xl p-3 transition-all", isSelected ? "bg-primary text-primary-foreground" : "bg-muted")}>
                          <Icon className="h-4 w-4" />
                          <span className="text-xs font-medium">{account.name}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="flex justify-center">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Hacia</p>
                  <div className="grid grid-cols-3 gap-2">
                    {accounts.map((account) => {
                      const Icon = accountIcons[account.type]
                      const isSelected = toAccount === account.id
                      const isDisabled = fromAccount === account.id
                      return (
                        <button key={account.id} onClick={() => !isDisabled && setToAccount(account.id)} disabled={isDisabled}
                          className={cn("flex flex-col items-center gap-1 rounded-xl p-3 transition-all", isDisabled && "opacity-30 cursor-not-allowed", isSelected ? "bg-primary text-primary-foreground" : "bg-muted")}>
                          <Icon className="h-4 w-4" />
                          <span className="text-xs font-medium">{account.name}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Monto</p>
                  <div className="flex items-center gap-2 rounded-xl bg-muted p-4">
                    <span className="text-lg font-medium text-muted-foreground">RD$</span>
                    <input type="text" inputMode="decimal" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0"
                      className="flex-1 bg-transparent text-2xl font-bold outline-none" />
                  </div>
                </div>
              </div>
        </BaseModalForm>
      )}

      {/* Create Account Modal */}
      {showCreateAccount && (
        <BaseModalForm
          title="Nueva cuenta"
          onClose={() => setShowCreateAccount(false)}
          footer={
            <Button onClick={handleCreateAccount} disabled={!accountName || !initialBalance || isCreating}
              className="h-12 w-full rounded-xl text-base font-semibold">
              {isCreating ? "Creando cuenta..." : "Guardar cuenta"}
            </Button>
          }
        >
          <div className="pb-safe-areas space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium">Nombre de la cuenta</label>
                  <input type="text" value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Ej: Mi cuenta principal"
                    className="w-full rounded-2xl border border-border bg-background px-4 py-4" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">Tipo de cuenta</label>
                  <div className="flex gap-3">
                    {[{ value: "cash", label: "Efectivo", icon: Banknote }, { value: "debit", label: "Débito", icon: Building2 }, { value: "credit", label: "Crédito", icon: CreditCard }].map(({ value, label, icon: Icon }) => (
                      <button key={value} onClick={() => setAccountType(value as typeof accountType)}
                        className={cn("flex flex-1 flex-col items-center gap-2 rounded-2xl border border-border p-4", accountType === value ? "border-primary bg-primary/10" : "")}>
                        <Icon className={cn("h-6 w-6", accountType === value ? "text-primary" : "text-muted-foreground")} />
                        <span className={cn("text-sm font-medium", accountType === value ? "text-primary" : "text-muted-foreground")}>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">Moneda</label>
                  <div className="flex gap-3">
                    {(["DOP", "USD"] as const).map((curr) => (
                      <button key={curr} onClick={() => setAccountCurrency(curr)}
                        className={cn("flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border px-4 py-3 font-medium", accountCurrency === curr ? "border-primary bg-primary/10 text-primary" : "")}>
                        {curr === "DOP" ? "RD$" : "US$"} - {curr}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">Balance inicial</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">{accountCurrency === "DOP" ? "RD$" : "US$"}</span>
                    <input type="text" inputMode="decimal" value={initialBalance} onChange={(e) => setInitialBalance(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0"
                      className="w-full rounded-2xl border border-border bg-background py-4 pl-14 pr-4 text-xl font-bold" />
                  </div>
                </div>
                {accountType === "credit" && (
                  <div className="space-y-4 rounded-2xl bg-muted/50 p-4">
                    <p className="text-sm font-medium">Detalles de tarjeta de crédito</p>
                    <div>
                      <label className="mb-2 block text-xs text-muted-foreground">Límite de crédito</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">{accountCurrency === "DOP" ? "RD$" : "US$"}</span>
                        <input type="text" inputMode="decimal" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0"
                          className="w-full rounded-xl border border-border bg-background py-3 pl-10 pr-4" />
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-xs text-muted-foreground">Día de cierre (1-31)</label>
                      <input type="text" inputMode="numeric" value={closingDate} onChange={(e) => setClosingDate(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))} placeholder="15"
                        className="w-full rounded-xl border border-border bg-background py-3 px-4" />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs text-muted-foreground">Fecha de pago (1-31)</label>
                      <input type="text" inputMode="numeric" value={dueDate} onChange={(e) => setDueDate(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))} placeholder="10"
                        className="w-full rounded-xl border border-border bg-background py-3 px-4" />
                    </div>
                  </div>
                )}
              </div>
        </BaseModalForm>
      )}
    </div>
  )
}
