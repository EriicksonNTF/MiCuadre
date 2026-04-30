"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  CreditCard,
  Banknote,
  Building2,
  AlertCircle,
  Check,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useAccounts, payCreditCard } from "@/hooks/use-data"
import { formatCurrency, getPaymentUrgency, getDaysUntilDue } from "@/lib/data"
import { PaymentSlider } from "@/components/payment-slider"

export default function PayPage() {
  const router = useRouter()
  const { data: accounts = [] } = useAccounts()

  const [step, setStep] = useState<"select" | "amount" | "confirm">("select")
  const [selectedCard, setSelectedCard] = useState<string>("")
  const [sourceAccount, setSourceAccount] = useState<string>("")
  const [amount, setAmount] = useState("")
  const [isPaying, setIsPaying] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  const creditCards = useMemo(() => accounts.filter(a => a.type === "credit"), [accounts])
  const nonCreditAccounts = useMemo(() => accounts.filter(a => a.type !== "credit"), [accounts])

  const selectedCreditCard = creditCards.find(c => c.id === selectedCard)
  const selectedSource = nonCreditAccounts.find(a => a.id === sourceAccount)

  const currentDebt = selectedCreditCard?.current_debt ?? 0
  const dueDate = selectedCreditCard?.due_date || 15
  const daysUntilDue = getDaysUntilDue(dueDate)
  const urgency = getPaymentUrgency(daysUntilDue)

  const parsedAmount = parseFloat(amount.replace(/[^0-9.]/g, "")) || 0
  const availableSource = selectedSource?.balance || 0
  const minPayment = Math.min(Number(selectedCreditCard?.credit_limit || 0) * 0.05, currentDebt)

  const isValid = parsedAmount > 0 && parsedAmount <= currentDebt && parsedAmount <= availableSource && sourceAccount

  const handleAmountChange = (value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, "")
    const parts = cleaned.split(".")
    if (parts.length > 2) return
    setAmount(cleaned)
  }

  const handlePay = async () => {
    if (!isValid) return
    setIsPaying(true)
    try {
      await payCreditCard({
        credit_account_id: selectedCard,
        source_account_id: sourceAccount,
        amount: parsedAmount,
      })
      setIsPaying(false)
      setShowSuccess(true)
      setTimeout(() => router.push("/"), 1500)
    } catch (error) {
      console.error("Payment error:", error)
      setIsPaying(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 px-6 pb-4 pt-8">
        <Link href="/" className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-semibold">Pagar tarjeta</h1>
      </header>

      <div className="mx-6 flex gap-2">
        {["select", "amount", "confirm"].map((s, i) => (
          <div
            key={s}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              step === s || (["amount", "confirm"].indexOf(step) > i) ? "bg-primary" : "bg-muted"
            )}
          />
        ))}
      </div>

      <div className="px-6 pt-6 space-y-6">
        {step === "select" && (
          <>
            <p className="text-sm text-muted-foreground">Selecciona la tarjeta a pagar</p>
            <div className="space-y-3">
              {creditCards.map(card => (
                <button
                  key={card.id}
                  onClick={() => setSelectedCard(card.id)}
                  className={cn(
                    "w-full rounded-2xl border border-border bg-card p-4 transition-all",
                    selectedCard === card.id && "border-primary bg-primary/10"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500 text-white">
                        <CreditCard className="h-5 w-5" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium">{card.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Deuda: {formatCurrency(card.current_debt || 0)}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                  {selectedCard === card.id && card.due_date && (
                    <div className="mt-3 flex items-center gap-2 text-sm">
                      <AlertCircle className={cn(
                        "h-4 w-4",
                        urgency === "urgent" ? "text-red-500" : urgency === "warning" ? "text-amber-500" : "text-emerald-500"
                      )} />
                      <span className={urgency === "urgent" ? "text-red-600 font-medium" : urgency === "warning" ? "text-amber-600" : "text-emerald-600"}>
                        {daysUntilDue === 1 ? "Pago vence mañana" : daysUntilDue <= 7 ? `Faltan ${daysUntilDue} días` : "Pago al día"}
                      </span>
                    </div>
                  )}
                </button>
              ))}
            </div>
            <div className="pb-6 pt-4">
              <Button
                onClick={() => setStep("amount")}
                disabled={!selectedCard}
                className="h-14 w-full rounded-2xl text-base font-semibold"
              >
                Continuar
              </Button>
            </div>
          </>
        )}

        {step === "amount" && (
          <div className="space-y-6">
            <div className="rounded-2xl bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500 text-white">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">{selectedCreditCard?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Deuda: {formatCurrency(currentDebt)}
                  </p>
                </div>
              </div>
            </div>

            <p className="text-sm font-medium text-muted-foreground">Cuenta de origen</p>
            <div className="flex gap-2">
              {nonCreditAccounts.map(account => {
                const Icon = account.type === "cash" ? Banknote : Building2
                return (
                  <button
                    key={account.id}
                    onClick={() => setSourceAccount(account.id)}
                    className={cn(
                      "flex flex-1 flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 transition-all",
                      sourceAccount === account.id && "border-primary bg-primary/10"
                    )}
                  >
                    <Icon className="h-6 w-6" />
                    <span className="text-xs font-medium">{account.name}</span>
                    <span className="text-xs text-muted-foreground">{formatCurrency(account.balance)}</span>
                  </button>
                )
              })}
            </div>

            <div className="flex flex-col items-center pt-4">
              <p className="text-sm text-muted-foreground">Monto a pagar</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-medium text-muted-foreground">RD$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={e => handleAmountChange(e.target.value)}
                  placeholder="0"
                  className="w-full bg-transparent text-center text-5xl font-bold outline-none placeholder:text-muted-foreground/30"
                  autoFocus
                />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Disponible: {formatCurrency(availableSource)}
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              <button onClick={() => setAmount(minPayment.toFixed(0))} className="rounded-full bg-muted px-4 py-2 text-sm font-medium">
                Mínimo
              </button>
              <button onClick={() => setAmount(currentDebt.toFixed(0))} className="rounded-full bg-muted px-4 py-2 text-sm font-medium">
                Completo
              </button>
            </div>

            <div className="pb-6 pt-4">
              <Button
                onClick={() => setStep("confirm")}
                disabled={parsedAmount <= 0 || parsedAmount > currentDebt || parsedAmount > availableSource}
                className="h-14 w-full rounded-2xl text-base font-semibold"
              >
                Continuar
              </Button>
            </div>
          </div>
        )}

        {step === "confirm" && (
          <div className="space-y-6">
            <div className="rounded-3xl bg-card p-6">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Tarjeta</span>
                <span className="font-medium">{selectedCreditCard?.name}</span>
              </div>
              <div className="my-4 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Monto</span>
                <span className="text-3xl font-bold">{formatCurrency(parsedAmount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Desde</span>
                <span className="font-medium">{selectedSource?.name}</span>
              </div>
              <div className="my-4 h-px bg-border" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Nueva deuda</span>
                <span className="font-medium text-muted-foreground">
                  {formatCurrency(currentDebt - parsedAmount)}
                </span>
              </div>
            </div>

            <div className="pb-6 pt-4">
              <PaymentSlider
                amount={parsedAmount}
                currency={selectedSource?.currency || "DOP"}
                recipientName={selectedCreditCard?.name || ""}
                onConfirm={handlePay}
                disabled={!isValid || isPaying}
              />
              <button
                onClick={() => setStep("amount")}
                className="mt-3 h-12 w-full text-sm text-muted-foreground"
              >
                Volver atrás
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}