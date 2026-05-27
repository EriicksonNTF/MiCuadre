"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { AccountCarouselSelector } from "@/components/ui/account-carousel-selector"
import { MoneyInput } from "@/components/ui/money-input"
import { PaymentSlider } from "@/components/payment-slider"
import { payCreditCard, useAccounts } from "@/hooks/use-data"
import { formatCurrency, formatDate } from "@/lib/data"
import { notify } from "@/lib/notifications"
import { cn } from "@/lib/utils"
import type { Currency } from "@/lib/types/database"
import { MovementReceipt } from "@/components/receipts/movement-receipt"

type PaymentMode = "balance_to_date" | "statement_balance" | "minimum_payment" | "custom"

const LAST_RATE_KEY = "micuadre:last-card-payment-rate"

function parseNumericAmount(value: string) {
  return Number(value.replace(/[^0-9.]/g, "")) || 0
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

export default function PayPage() {
  const router = useRouter()
  const { data: accounts = [] } = useAccounts()
  const [selectedCard, setSelectedCard] = useState("")
  const [currencyTab, setCurrencyTab] = useState<Currency>("DOP")
  const [sourceAccount, setSourceAccount] = useState("")
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("statement_balance")
  const [customAmount, setCustomAmount] = useState("")
  const [paymentComment, setPaymentComment] = useState("")
  const [exchangeRate, setExchangeRate] = useState("")
  const [isPaying, setIsPaying] = useState(false)
  const [receipt, setReceipt] = useState<{
    id?: string
    sourceTxId?: string
    cardTxId?: string
    amount: number
    currency: Currency
    cardId: string
    cardName: string
    previousCardBalance: number
    newCardBalance: number
    sourceName: string
    sourceCurrency: Currency
    previousSourceBalance: number
    newSourceBalance: number
    summary: {
      balanceToDate: number
      pendingStatement: number
      minimumPayment: number
      availableCredit: number
      dueDate?: string | null
    }
    conversion?: {
      sourceAmount: number
      sourceCurrency: Currency
      targetAmount: number
      targetCurrency: Currency
      exchangeRate: number
    }
    note?: string
    date: Date
  } | null>(null)

  const creditCards = useMemo(() => accounts.filter((a) => a.type === "credit"), [accounts])
  const card = creditCards.find((a) => a.id === selectedCard)
  const sources = useMemo(() => accounts.filter((a) => a.type !== "credit"), [accounts])
  const source = sources.find((a) => a.id === sourceAccount)

  const activeCurrencies = useMemo<Currency[]>(() => {
    if (!card) return ["DOP"]
    const dopHasBalance = Number(card.current_debt_dop || card.current_debt || 0) > 0 || Number(card.statement_balance_dop || 0) > 0
    const usdHasBalance = Number(card.current_debt_usd || 0) > 0 || Number(card.statement_balance_usd || 0) > 0
    const currencies: Currency[] = []
    if (dopHasBalance) currencies.push("DOP")
    if (usdHasBalance) currencies.push("USD")
    return currencies.length ? Array.from(new Set(currencies)) : [card.currency || "DOP"]
  }, [card])

  useEffect(() => {
    if (!card) return
    const nextCurrency = activeCurrencies.includes(currencyTab) ? currencyTab : activeCurrencies[0]
    if (nextCurrency !== currencyTab) {
      setCurrencyTab(nextCurrency)
      setSourceAccount("")
      setCustomAmount("")
      setPaymentMode("statement_balance")
    }
  }, [activeCurrencies, card, currencyTab])

  useEffect(() => {
    if (typeof window === "undefined") return
    const preselectedCardId = new URLSearchParams(window.location.search).get("card")
    if (!preselectedCardId) return
    if (creditCards.some((cardItem) => cardItem.id === preselectedCardId)) {
      setSelectedCard(preselectedCardId)
    }
  }, [creditCards])

  const balanceToDate = currencyTab === "DOP" ? Number(card?.current_debt_dop || card?.current_debt || 0) : Number(card?.current_debt_usd || 0)
  const statementBalance = currencyTab === "DOP" ? Number(card?.statement_balance_dop || 0) : Number(card?.statement_balance_usd || 0)
  const paidStatement = currencyTab === "DOP" ? Number(card?.paid_statement_amount_dop || 0) : Number(card?.paid_statement_amount_usd || 0)
  const pendingStatement = Math.max(0, statementBalance - paidStatement)
  const minimumPayment = roundMoney(pendingStatement * Number(card?.minimum_payment_percentage || 0.0278))
  const creditLimit = currencyTab === "DOP" ? Number(card?.credit_limit_dop || card?.credit_limit || 0) : Number(card?.credit_limit_usd || 0)
  const availableCreditStored = currencyTab === "DOP" ? Number(card?.available_credit_dop || 0) : Number(card?.available_credit_usd || 0)
  const availableCredit = availableCreditStored > 0 ? availableCreditStored : Math.max(0, creditLimit - balanceToDate)
  const selectedAmount = parseNumericAmount(customAmount)
  const sourceCurrency = source?.currency as Currency | undefined
  const conversionApplies = Boolean(sourceCurrency && sourceCurrency !== currencyTab)
  const parsedRate = Number(exchangeRate)
  const sourceDebitAmount = conversionApplies
    ? currencyTab === "USD" && sourceCurrency === "DOP"
      ? roundMoney(selectedAmount * parsedRate)
      : roundMoney(selectedAmount / parsedRate)
    : selectedAmount
  const validRate = !conversionApplies || (Number.isFinite(parsedRate) && parsedRate > 0)
  const valid = Boolean(card && source && selectedAmount > 0 && selectedAmount <= balanceToDate && validRate && sourceDebitAmount <= Number(source.balance || 0))

  useEffect(() => {
    if (!conversionApplies) return
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(LAST_RATE_KEY) : null
    if (stored && !exchangeRate) setExchangeRate(stored)
  }, [conversionApplies, exchangeRate])

  const selectAmount = (mode: PaymentMode, amount: number) => {
    setPaymentMode(mode)
    setCustomAmount(amount > 0 ? String(amount) : "")
  }

  const handlePay = async () => {
    if (!card || !source || !valid || isPaying) return
    setIsPaying(true)
    try {
      const previousCardBalance = balanceToDate
      const previousSourceBalance = Number(source.balance || 0)
      const result = await payCreditCard({
        credit_account_id: card.id,
        source_account_id: source.id,
        amount: selectedAmount,
        currency: currencyTab,
        exchange_rate: conversionApplies ? parsedRate : undefined,
        payment_kind: paymentMode,
        notes: paymentComment.trim() || undefined,
        apply_commission: false,
      })
      if (conversionApplies && typeof window !== "undefined") {
        window.localStorage.setItem(LAST_RATE_KEY, String(parsedRate))
      }
      notify({ title: "Pago registrado", message: "Tu tarjeta y cuenta origen fueron actualizadas." })
      setReceipt({
        id: result?.payment?.id,
        sourceTxId: result?.sourceTransaction?.id,
        cardTxId: result?.cardTransaction?.id,
        amount: selectedAmount,
        currency: currencyTab,
        cardId: card.id,
        cardName: card.name,
        previousCardBalance,
        newCardBalance: Math.max(0, previousCardBalance - selectedAmount),
        sourceName: source.name,
        sourceCurrency: source.currency,
        previousSourceBalance,
        newSourceBalance: previousSourceBalance - sourceDebitAmount,
        summary: {
          balanceToDate,
          pendingStatement,
          minimumPayment,
          availableCredit,
          dueDate: card.statement_due_date,
        },
        conversion: conversionApplies
          ? {
              sourceAmount: sourceDebitAmount,
              sourceCurrency: source.currency,
              targetAmount: selectedAmount,
              targetCurrency: currencyTab,
              exchangeRate: parsedRate,
            }
          : undefined,
        note: paymentComment.trim() || undefined,
        date: new Date(),
      })
      setCustomAmount("")
      setPaymentComment("")
    } catch (error) {
      notify({ title: "No se pudo pagar", message: error instanceof Error ? error.message : "Revisa el monto e intenta de nuevo." })
      throw error
    } finally {
      setIsPaying(false)
    }
  }

  const closeReceiptToDashboard = () => {
    setReceipt(null)
    router.push("/dashboard")
  }

  return (
    <div className="app-scroll min-h-[100dvh] overflow-y-auto bg-background px-6 pb-nav-safe pt-8">
      <div className="mb-5 flex items-center gap-3">
        <Link href="/" className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-semibold">Pagar tarjeta</h1>
      </div>

      <div className="space-y-5">
        <section>
          <p className="mb-2 text-sm font-semibold text-foreground">Tarjeta que se va a pagar</p>
          <AccountCarouselSelector
            items={creditCards.map((c) => ({
              id: c.id,
              title: c.name,
              subtitle: [
                Number(c.current_debt_dop || 0) > 0 ? formatCurrency(Number(c.current_debt_dop || 0), "DOP") : null,
                Number(c.current_debt_usd || 0) > 0 ? formatCurrency(Number(c.current_debt_usd || 0), "USD") : null,
              ].filter(Boolean).join(" · ") || formatCurrency(Number(c.current_debt || 0), c.currency),
              detail: "Tarjeta",
            }))}
            selectedId={selectedCard}
            onSelect={(id) => {
              setSelectedCard(id)
              setSourceAccount("")
              setCustomAmount("")
            }}
            emptyMessage="Crea tu primera tarjeta"
          />
        </section>

        {card && (
          <>
            {activeCurrencies.length > 1 && (
              <section className="rounded-2xl border border-border bg-card p-4">
                <p className="mb-3 text-sm font-semibold">¿Qué balance quieres pagar?</p>
                <div className="grid grid-cols-2 gap-2">
                  {activeCurrencies.map((currency) => (
                    <button key={currency} onClick={() => { setCurrencyTab(currency); setSourceAccount(""); setCustomAmount("") }} className={cn("h-10 rounded-xl text-sm font-bold transition", currencyTab === currency ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                      {currency === "DOP" ? "RD$" : "US$"}
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section>
              <p className="mb-2 text-sm font-semibold text-foreground">Cuenta de origen</p>
              <AccountCarouselSelector
                compact
                items={sources.map((acc) => ({ id: acc.id, title: acc.name, subtitle: formatCurrency(Number(acc.balance || 0), acc.currency), detail: acc.currency }))}
                selectedId={sourceAccount}
                onSelect={setSourceAccount}
                emptyMessage="No hay cuentas disponibles"
              />
            </section>

            <section className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Resumen del pago</p>
              <div className="mt-3 space-y-2.5 text-sm">
                <div className="flex justify-between gap-4"><span className="text-muted-foreground">Balance actual</span><span className="font-semibold">{formatCurrency(balanceToDate, currencyTab)}</span></div>
                <div className="flex justify-between gap-4"><span className="text-muted-foreground">Balance al corte</span><span className="font-semibold">{formatCurrency(pendingStatement, currencyTab)}</span></div>
                <div className="flex justify-between gap-4"><span className="text-muted-foreground">Pago mínimo</span><span className="font-semibold">{formatCurrency(minimumPayment, currencyTab)}</span></div>
                <div className="flex justify-between gap-4"><span className="text-muted-foreground">Balance disponible</span><span className="font-semibold">{formatCurrency(availableCredit, currencyTab)}</span></div>
                <div className="flex justify-between gap-4"><span className="text-muted-foreground">Pagar antes del</span><span className="font-medium">{card.statement_due_date ? formatDate(card.statement_due_date) : "-"}</span></div>
              </div>
            </section>

            <section>
              <p className="mb-2 text-sm font-semibold text-foreground">Monto a pagar</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => selectAmount("balance_to_date", balanceToDate)} className={cn("rounded-xl border p-3 text-xs font-bold", paymentMode === "balance_to_date" ? "border-primary bg-primary/10" : "border-border bg-card")}>Balance actual</button>
                <button onClick={() => selectAmount("statement_balance", pendingStatement)} className={cn("rounded-xl border p-3 text-xs font-bold", paymentMode === "statement_balance" ? "border-primary bg-primary/10" : "border-border bg-card")}>Pagar corte</button>
                <button onClick={() => selectAmount("minimum_payment", minimumPayment)} className={cn("rounded-xl border p-3 text-xs font-bold", paymentMode === "minimum_payment" ? "border-primary bg-primary/10" : "border-border bg-card")}>Pago mínimo</button>
                <button onClick={() => selectAmount("custom", 0)} className={cn("rounded-xl border p-3 text-xs font-bold", paymentMode === "custom" ? "border-primary bg-primary/10" : "border-border bg-card")}>Otro monto</button>
              </div>
            </section>

            {paymentMode === "custom" && (
              <section className="rounded-2xl bg-card p-3">
                <MoneyInput value={customAmount} onValueChange={setCustomAmount} placeholder="Otro monto" className="w-full bg-transparent text-2xl font-bold outline-none" />
              </section>
            )}

            {conversionApplies && (
              <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                <p className="text-sm font-bold">Tasa de cambio</p>
                <p className="mt-1 text-xs text-muted-foreground">RD$ por US$1. Puedes ajustar esta tasa si tu banco usa otra.</p>
                <input value={exchangeRate} onChange={(e) => setExchangeRate(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="59.50" className="mt-3 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold outline-none" />
                <div className="mt-3 rounded-xl bg-background/70 p-3 text-sm">
                  <div className="flex justify-between gap-4"><span className="text-muted-foreground">Total estimado a descontar</span><span className="font-bold">{source ? formatCurrency(sourceDebitAmount, source.currency) : "-"}</span></div>
                  <p className="mt-1 text-xs text-muted-foreground">Tasa guardada para esta transacción.</p>
                </div>
              </section>
            )}

            <section className="rounded-2xl bg-card p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Comentario opcional</p>
              <input value={paymentComment} onChange={(e) => setPaymentComment(e.target.value)} placeholder="Pago de mayo" className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none" />
            </section>

            <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+12px)] bg-background/90 pb-1 pt-2 backdrop-blur supports-[backdrop-filter]:bg-background/70">
              <PaymentSlider
                amount={selectedAmount}
                currency={currencyTab}
                recipientName={card.name}
                onConfirm={handlePay}
                disabled={!valid || isPaying}
                loading={isPaying}
                label="Desliza para pagar"
              />
            </div>
          </>
        )}
      </div>
      <MovementReceipt
        open={Boolean(receipt)}
        title="Pago registrado"
        amount={receipt ? formatCurrency(receipt.amount, receipt.currency) : ""}
        onClose={closeReceiptToDashboard}
        primaryActionLabel="Ver tarjeta"
        secondaryActionLabel="Listo"
        onPrimaryAction={() => receipt && router.push(`/accounts/${receipt.cardId}`)}
        onSecondaryAction={closeReceiptToDashboard}
        sections={[
          {
            title: "Tarjeta pagada",
            lines: [
              { label: "Tarjeta", value: receipt?.cardName },
              { label: "Balance anterior", value: receipt ? formatCurrency(receipt.previousCardBalance, receipt.currency) : undefined },
              { label: "Nuevo balance", value: receipt ? formatCurrency(receipt.newCardBalance, receipt.currency) : undefined },
              { label: "Ref. movimiento", value: receipt?.cardTxId },
            ],
          },
          {
            title: "Cuenta de origen",
            lines: [
              { label: "Cuenta", value: receipt?.sourceName },
              { label: "Balance anterior", value: receipt ? formatCurrency(receipt.previousSourceBalance, receipt.sourceCurrency) : undefined },
              { label: "Nuevo balance", value: receipt ? formatCurrency(receipt.newSourceBalance, receipt.sourceCurrency) : undefined },
              { label: "Descontado", value: receipt ? formatCurrency(receipt.previousSourceBalance - receipt.newSourceBalance, receipt.sourceCurrency) : undefined },
              { label: "Ref. movimiento", value: receipt?.sourceTxId },
            ],
          },
          {
            title: "Resumen",
            lines: [
              { label: "Balance actual", value: receipt ? formatCurrency(receipt.summary.balanceToDate, receipt.currency) : undefined },
              { label: "Balance al corte", value: receipt ? formatCurrency(receipt.summary.pendingStatement, receipt.currency) : undefined },
              { label: "Pago mínimo", value: receipt ? formatCurrency(receipt.summary.minimumPayment, receipt.currency) : undefined },
              { label: "Balance disponible", value: receipt ? formatCurrency(receipt.summary.availableCredit, receipt.currency) : undefined },
              { label: "Pagar antes del", value: receipt?.summary.dueDate ? formatDate(receipt.summary.dueDate) : undefined },
            ],
          },
          {
            title: "Conversión",
            lines: [
              { label: "Pagado", value: receipt?.conversion ? formatCurrency(receipt.conversion.targetAmount, receipt.conversion.targetCurrency) : undefined },
              { label: "Descontado", value: receipt?.conversion ? formatCurrency(receipt.conversion.sourceAmount, receipt.conversion.sourceCurrency) : undefined },
              { label: "Tasa usada", value: receipt?.conversion ? `RD$${receipt.conversion.exchangeRate.toFixed(2)} x US$1` : undefined },
              { label: "Fuente", value: receipt?.conversion ? "Manual" : undefined },
            ],
          },
          {
            title: "Detalle",
            lines: [
              { label: "Fecha", value: receipt?.date.toLocaleString("es-DO", { day: "2-digit", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" }) },
              { label: "Nota", value: receipt?.note },
              { label: "Referencia", value: receipt?.id },
            ],
          },
        ]}
      />
    </div>
  )
}
