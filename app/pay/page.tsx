"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MoneyInput } from "@/components/ui/money-input"
import { useAccounts, payCreditCard } from "@/hooks/use-data"
import { formatCurrency, formatDate } from "@/lib/data"

type PaymentMode = "balance_to_date" | "statement_balance" | "minimum_payment" | "custom"

export default function PayPage() {
  const { data: accounts = [] } = useAccounts()
  const [selectedCard, setSelectedCard] = useState("")
  const [currencyTab, setCurrencyTab] = useState<"DOP" | "USD">("DOP")
  const [sourceAccount, setSourceAccount] = useState("")
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("statement_balance")
  const [customAmount, setCustomAmount] = useState("")
  const [isPaying, setIsPaying] = useState(false)

  const creditCards = useMemo(() => accounts.filter((a) => a.type === "credit"), [accounts])
  const card = creditCards.find((a) => a.id === selectedCard)
  const sources = useMemo(() => accounts.filter((a) => a.type !== "credit" && a.currency === currencyTab), [accounts, currencyTab])
  const source = sources.find((a) => a.id === sourceAccount)

  const balanceToDate = currencyTab === "DOP" ? Number(card?.current_debt_dop || 0) : Number(card?.current_debt_usd || 0)
  const statementBalance = currencyTab === "DOP" ? Number(card?.statement_balance_dop || 0) : Number(card?.statement_balance_usd || 0)
  const paidStatement = currencyTab === "DOP" ? Number(card?.paid_statement_amount_dop || 0) : Number(card?.paid_statement_amount_usd || 0)
  const pendingStatement = Math.max(0, statementBalance - paidStatement)
  const minimumPayment = Math.round(pendingStatement * Number(card?.minimum_payment_percentage || 0.0278) * 100) / 100
  const pendingTransit = currencyTab === "DOP" ? Number(card?.pending_transit_dop || 0) : Number(card?.pending_transit_usd || 0)

  const selectedAmount = paymentMode === "balance_to_date"
    ? balanceToDate
    : paymentMode === "statement_balance"
    ? pendingStatement
    : paymentMode === "minimum_payment"
    ? minimumPayment
    : parseFloat(customAmount || "0")

  const valid = Boolean(card && source && selectedAmount > 0 && selectedAmount <= balanceToDate && selectedAmount <= Number(source?.balance || 0))

  const handlePay = async () => {
    if (!card || !source || !valid) return
    setIsPaying(true)
    try {
      await payCreditCard({
        credit_account_id: card.id,
        source_account_id: source.id,
        amount: selectedAmount,
        currency: currencyTab,
        payment_kind: paymentMode,
      })
      setCustomAmount("")
    } finally {
      setIsPaying(false)
    }
  }

  return (
    <div className="app-scroll min-h-[100dvh] overflow-y-auto bg-background pb-nav-safe px-6 pt-8">
      <div className="mb-4 flex items-center gap-3">
        <Link href="/" className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="text-lg font-semibold">Pagar tarjeta</h1>
      </div>

      <div className="space-y-3">
        {creditCards.map((c) => (
          <button key={c.id} onClick={() => setSelectedCard(c.id)} className={`w-full rounded-2xl border p-4 text-left ${selectedCard === c.id ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
            <div className="flex items-center gap-3"><CreditCard className="h-5 w-5" /><p className="font-medium">{c.name}</p></div>
          </button>
        ))}
      </div>

      {card && (
        <>
          <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-muted p-1">
            {(["DOP", "USD"] as const).map((tab) => (
              <button key={tab} onClick={() => { setCurrencyTab(tab); setSourceAccount("") }} className={`rounded-xl py-2 text-sm font-medium ${currencyTab === tab ? "bg-card" : "text-muted-foreground"}`}>{tab}</button>
            ))}
          </div>

          <div className="mt-4 rounded-2xl bg-card p-4 text-sm space-y-2">
            <div className="flex justify-between"><span className="text-muted-foreground">Balance al dia</span><span>{formatCurrency(balanceToDate, currencyTab)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Balance al corte</span><span>{formatCurrency(pendingStatement, currencyTab)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Pago minimo</span><span>{formatCurrency(minimumPayment, currencyTab)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Pendiente/transito</span><span>{formatCurrency(pendingTransit, currencyTab)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Pagar antes de</span><span>{card.statement_due_date ? formatDate(card.statement_due_date) : "-"}</span></div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {["balance_to_date", "statement_balance", "minimum_payment", "custom"].map((mode) => (
              <button key={mode} onClick={() => setPaymentMode(mode as PaymentMode)} className={`rounded-xl border p-2 text-xs ${paymentMode === mode ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
                {mode === "balance_to_date" ? "Pagar balance" : mode === "statement_balance" ? "Pagar corte" : mode === "minimum_payment" ? "Pago minimo" : "Otro monto"}
              </button>
            ))}
          </div>

          {paymentMode === "custom" && (
            <div className="mt-3 rounded-xl bg-card p-3">
              <MoneyInput value={customAmount} onValueChange={setCustomAmount} placeholder="0" className="w-full bg-transparent text-2xl font-bold outline-none" />
            </div>
          )}

          <p className="mt-4 text-sm font-medium text-muted-foreground">Cuenta origen ({currencyTab})</p>
          <div className="mt-2 flex gap-2">
            {sources.map((acc) => (
              <button key={acc.id} onClick={() => setSourceAccount(acc.id)} className={`flex-1 rounded-xl border p-3 text-left ${sourceAccount === acc.id ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
                <p className="text-sm font-medium">{acc.name}</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(acc.balance, currencyTab)}</p>
              </button>
            ))}
          </div>

          <Button className="mt-5 h-12 w-full" onClick={handlePay} disabled={!valid || isPaying}>
            {isPaying ? "Procesando..." : `Pagar ${formatCurrency(selectedAmount, currencyTab)}`}
          </Button>
        </>
      )}
    </div>
  )
}
