"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MoneyInput } from "@/components/ui/money-input"
import { AccountCarouselSelector } from "@/components/ui/account-carousel-selector"
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
  const [paymentComment, setPaymentComment] = useState("")
  const [isPaying, setIsPaying] = useState(false)
  const [applyCommission, setApplyCommission] = useState(true)

  const creditCards = useMemo(() => accounts.filter((a) => a.type === "credit"), [accounts])
  const card = creditCards.find((a) => a.id === selectedCard)
  const hasUsdOnCard = Boolean(
    card && (
      Number(card.credit_limit_usd || 0) > 0 ||
      Number(card.current_debt_usd || 0) > 0 ||
      Number(card.statement_balance_usd || 0) > 0
    )
  )
  const sources = useMemo(() => accounts.filter((a) => a.type !== "credit" && a.currency === currencyTab), [accounts, currencyTab])
  const source = sources.find((a) => a.id === sourceAccount)

  const balanceToDate = currencyTab === "DOP" ? Number(card?.current_debt_dop || 0) : Number(card?.current_debt_usd || 0)
  const statementBalance = currencyTab === "DOP" ? Number(card?.statement_balance_dop || 0) : Number(card?.statement_balance_usd || 0)
  const paidStatement = currencyTab === "DOP" ? Number(card?.paid_statement_amount_dop || 0) : Number(card?.paid_statement_amount_usd || 0)
  const pendingStatement = Math.max(0, statementBalance - paidStatement)
  const minimumPayment = Math.round(pendingStatement * Number(card?.minimum_payment_percentage || 0.0278) * 100) / 100
  const availableCreditStored = currencyTab === "DOP" ? Number(card?.available_credit_dop || 0) : Number(card?.available_credit_usd || 0)
  const creditLimit = currencyTab === "DOP" ? Number(card?.credit_limit_dop || 0) : Number(card?.credit_limit_usd || 0)
  const availableCreditComputed = Math.max(0, creditLimit - balanceToDate)
  const availableCredit = Number.isFinite(availableCreditStored) && availableCreditStored > 0
    ? availableCreditStored
    : availableCreditComputed
  const selectedAmount = parseFloat(customAmount || "0")

  const COMMISSION_RATE = 0.0015
  const commissionAmount = applyCommission ? Math.round(selectedAmount * COMMISSION_RATE * 100) / 100 : 0
  const totalWithCommission = selectedAmount + commissionAmount

  const valid = applyCommission
    ? Boolean(card && source && selectedAmount > 0 && selectedAmount <= balanceToDate && totalWithCommission <= Number(source?.balance || 0))
    : Boolean(card && source && selectedAmount > 0 && selectedAmount <= balanceToDate && selectedAmount <= Number(source?.balance || 0))

  useEffect(() => {
    if (!hasUsdOnCard && currencyTab === "USD") {
      setCurrencyTab("DOP")
      setSourceAccount("")
    }
  }, [currencyTab, hasUsdOnCard])

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
        notes: paymentComment.trim() || undefined,
        apply_commission: applyCommission,
      })
      setCustomAmount("")
      setPaymentComment("")
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
        <AccountCarouselSelector
          items={creditCards.map((c) => ({
            id: c.id,
            title: c.name,
            subtitle:
              Number(c.credit_limit_usd || 0) > 0 || Number(c.current_debt_usd || 0) > 0 || Number(c.statement_balance_usd || 0) > 0
                ? `${formatCurrency(Number(c.current_debt_dop || 0), "DOP")} · ${formatCurrency(Number(c.current_debt_usd || 0), "USD")}`
                : formatCurrency(Number(c.current_debt_dop || 0), "DOP"),
            detail: "Tarjeta",
          }))}
          selectedId={selectedCard}
          onSelect={setSelectedCard}
          emptyMessage="Crea tu primera tarjeta"
        />
      </div>

      {card && (
        <>
          <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-muted p-1">
            {(["DOP", "USD"] as const).filter((tab) => tab === "DOP" || hasUsdOnCard).map((tab) => (
              <button key={tab} onClick={() => { setCurrencyTab(tab); setSourceAccount(""); setCustomAmount(""); setPaymentMode("custom") }} className={`rounded-xl py-2 text-sm font-medium ${currencyTab === tab ? "bg-card shadow-sm" : "text-muted-foreground"}`}>{tab}</button>
            ))}
          </div>

          <div className="mt-4 rounded-2xl bg-card p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resumen de pago</p>
            <div className="mt-3 space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Balance actual</span><span className="text-right text-base font-semibold text-foreground">{formatCurrency(balanceToDate, currencyTab)}</span></div>
              <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Balance al corte</span><span className="text-right text-base font-semibold text-foreground">{formatCurrency(pendingStatement, currencyTab)}</span></div>
              <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Pago mínimo</span><span className="text-right text-base font-semibold text-foreground">{formatCurrency(minimumPayment, currencyTab)}</span></div>
              <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Balance disponible</span><span className="text-right text-base font-semibold text-foreground">{formatCurrency(availableCredit, currencyTab)}</span></div>
              <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Pagar antes del</span><span className="text-right font-medium text-foreground">{card.statement_due_date ? formatDate(card.statement_due_date) : "-"}</span></div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button onClick={() => { setPaymentMode("balance_to_date"); setCustomAmount(String(balanceToDate)) }} className={`rounded-xl border p-2 text-xs font-medium ${paymentMode === "balance_to_date" ? "border-primary bg-primary/10" : "border-border bg-card"}`}>Pagar balance actual</button>
            <button onClick={() => { setPaymentMode("statement_balance"); setCustomAmount(String(pendingStatement)) }} className={`rounded-xl border p-2 text-xs font-medium ${paymentMode === "statement_balance" ? "border-primary bg-primary/10" : "border-border bg-card"}`}>Pagar corte</button>
            <button onClick={() => { setPaymentMode("minimum_payment"); setCustomAmount(String(minimumPayment)) }} className={`rounded-xl border p-2 text-xs font-medium ${paymentMode === "minimum_payment" ? "border-primary bg-primary/10" : "border-border bg-card"}`}>Pago mínimo</button>
            <button onClick={() => { setPaymentMode("custom"); setCustomAmount("") }} className={`rounded-xl border p-2 text-xs font-medium ${paymentMode === "custom" ? "border-primary bg-primary/10" : "border-border bg-card"}`}>Otro monto</button>
          </div>

          <div className="mt-3 rounded-xl bg-card p-3">
            <MoneyInput value={customAmount} onValueChange={(value) => { setCustomAmount(value); if (paymentMode !== "custom") setPaymentMode("custom") }} placeholder="0" className="w-full bg-transparent text-2xl font-bold outline-none" />
          </div>

          <div className="mt-3 rounded-xl bg-card p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Comentario (opcional)</p>
            <input value={paymentComment} onChange={(e) => setPaymentComment(e.target.value)} placeholder="Pago de mayo" className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none" />
          </div>

          <p className="mt-4 text-sm font-medium text-muted-foreground">Cuenta origen ({currencyTab})</p>
          <div className="mt-2">
            <AccountCarouselSelector
              compact
              items={sources.map((acc) => ({ id: acc.id, title: acc.name, subtitle: formatCurrency(Number(acc.balance || 0), currencyTab), detail: acc.type }))}
              selectedId={sourceAccount}
              onSelect={setSourceAccount}
              emptyMessage={`No hay cuentas ${currencyTab}`}
            />
          </div>

          {source && (
            <div className="mt-4 rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Aplicar comisión 0.15%</span>
                  <span className="text-xs text-muted-foreground">
                    {applyCommission
                      ? `Se cobrará ${formatCurrency(commissionAmount, currencyTab)} extra`
                      : "Sin comisión"}
                  </span>
                </div>
                <button
                  onClick={() => setApplyCommission(!applyCommission)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${applyCommission ? "bg-primary" : "bg-muted"}`}
                >
                  <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${applyCommission ? "left-6" : "left-1"}`} />
                </button>
              </div>
              {applyCommission && (
                <div className="mt-2 flex justify-between border-t pt-2 text-sm">
                  <span className="text-muted-foreground">Total a debitar</span>
                  <span className="font-medium">{formatCurrency(totalWithCommission, currencyTab)}</span>
                </div>
              )}
            </div>
          )}

          <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+12px)] mt-5 bg-background/90 pb-1 pt-2 backdrop-blur supports-[backdrop-filter]:bg-background/70">
          <Button className="h-12 w-full" onClick={handlePay} disabled={!valid || isPaying}>
            {isPaying ? "Procesando..." : `Pagar ${formatCurrency(selectedAmount, currencyTab)}`}
          </Button>
          </div>
        </>
      )}
    </div>
  )
}
