"use client"

import { useEffect, useMemo, useState, useRef, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, CalendarDays, CreditCard } from "lucide-react"
import { AccountCarouselSelector } from "@/components/ui/account-carousel-selector"
import { payCreditCard, useAccounts, calculateCreditCardPaymentAmounts } from "@/hooks/use-data"
import { formatCurrency, formatDate, getCurrencySymbol } from "@/lib/data"
import { notify } from "@/lib/notifications"
import { cn } from "@/lib/utils"
import type { Currency } from "@/lib/types/database"
import { MovementReceipt } from "@/components/receipts/movement-receipt"
import { PaymentOptionCard } from "@/components/credit-cards/pay-card/payment-option-card"
import { CustomAmountSheet } from "@/components/credit-cards/pay-card/custom-amount-sheet"
import { ConfirmPaymentSheet } from "@/components/credit-cards/pay-card/confirm-payment-sheet"
import { MobilePageShell, MobileSectionHeader, StickyFormFooter } from "@/components/ui/mobile-foundation"


type PaymentMode = "balance_to_date" | "statement_balance" | "minimum_payment" | "custom"

const LAST_RATE_KEY = "micuadre:last-card-payment-rate"

function parseNumericAmount(value: string) {
  return Number(value.replace(/[^0-9.]/g, "")) || 0
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

// Lazy initializer for exchangeRate - reads localStorage only once on mount
function getInitialExchangeRate(): string {
  if (typeof window === "undefined") return ""
  const stored = window.localStorage.getItem(LAST_RATE_KEY)
  return stored || ""
}

export default function PayPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-accent" /></div>}>
      <PayPageContent />
    </Suspense>
  )
}

function PayPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: accounts = [] } = useAccounts()
  const preselectedCardHandled = useRef(false)
  const [selectedCard, setSelectedCard] = useState("")
  const [currencyTab, setCurrencyTab] = useState<Currency>("DOP")
  const [sourceAccount, setSourceAccount] = useState("")
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("statement_balance")
  const [customAmount, setCustomAmount] = useState("")
  const [paymentComment, setPaymentComment] = useState("")
  const [exchangeRate, setExchangeRate] = useState(getInitialExchangeRate)
  const [isPaying, setIsPaying] = useState(false)
  const [showCustomSheet, setShowCustomSheet] = useState(false)
  const [showConfirmSheet, setShowConfirmSheet] = useState(false)
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
    dgiiAmount?: number
    note?: string
    date: Date
  } | null>(null)

  const creditCards = useMemo(() => accounts.filter((a) => a.type === "credit"), [accounts])
  const selectedCardId = selectedCard || creditCards[0]?.id || ""
  const card = creditCards.find((a) => a.id === selectedCardId)
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

  // React 19: Handle URL search params once on mount using useSearchParams
  // instead of useEffect with window.location.search
  useEffect(() => {
    if (preselectedCardHandled.current) return
    const preselectedCardId = searchParams?.get("card")
    if (!preselectedCardId) {
      preselectedCardHandled.current = true
      return
    }
    if (creditCards.some((cardItem) => cardItem.id === preselectedCardId)) {
      setSelectedCard(preselectedCardId)
    }
    preselectedCardHandled.current = true
  }, [creditCards])

  // React 19: Handle currency change by deriving state instead of useEffect+setState cascade
  // The resets are now handled in the currency button onClick (line ~276)
  // This effect only adjusts currencyTab if it becomes invalid
  useEffect(() => {
    if (!card) return
    const isValid = activeCurrencies.includes(currencyTab)
    if (!isValid && activeCurrencies.length > 0) {
      setCurrencyTab(activeCurrencies[0])
    }
  }, [activeCurrencies, card])

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

  const paymentCalculations = selectedAmount > 0 && sourceCurrency
    ? (() => {
        try {
          return calculateCreditCardPaymentAmounts({
            paymentAmount: selectedAmount,
            sourceCurrency: sourceCurrency,
            targetCurrency: currencyTab,
            exchangeRate: conversionApplies ? parsedRate : undefined,
            applyDgiiTax: true,
          })
        } catch {
          return null
        }
      })()
    : null

  const sourceDebitAmount = paymentCalculations?.sourceAmount || selectedAmount
  const dgiiAmount = paymentCalculations?.dgiiTaxAmount || 0
  const totalDebit = paymentCalculations?.totalDebit || sourceDebitAmount
  const validRate = !conversionApplies || (Number.isFinite(parsedRate) && parsedRate > 0)
  const valid = Boolean(card && source && selectedAmount > 0 && validRate && totalDebit <= Number(source.balance || 0))
  const currencySymbol = getCurrencySymbol(currencyTab)
  const warning = !selectedAmount
    ? "Selecciona un monto valido para continuar."
    : source && totalDebit > Number(source.balance || 0)
      ? "Tu balance disponible es insuficiente."
      : null

  // exchangeRate now uses lazy initializer (getInitialExchangeRate) - no effect needed

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
        apply_commission: true,
      })
      if (conversionApplies && typeof window !== "undefined") {
        window.localStorage.setItem(LAST_RATE_KEY, String(parsedRate))
      }
      notify({ title: "Pago registrado", message: "Tu tarjeta y cuenta origen fueron actualizadas." })
      // Generate transaction ID once per payment (not on every render)
      const transactionId = Math.random().toString(36).slice(2, 14).toUpperCase()
      setReceipt({
        id: result?.payment?.id || transactionId,
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
        newSourceBalance: previousSourceBalance - totalDebit,
        summary: {
          balanceToDate,
          pendingStatement,
          minimumPayment,
          availableCredit,
          dueDate: card.statement_due_date,
        },
        conversion: conversionApplies
          ? {
              sourceAmount: totalDebit,
              sourceCurrency: source.currency,
              targetAmount: selectedAmount,
              targetCurrency: currencyTab,
              exchangeRate: parsedRate,
            }
          : undefined,
        dgiiAmount,
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
    <MobilePageShell className="pb-nav-safe">
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
            selectedId={selectedCardId}
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
                    <button type="button" key={currency} onClick={() => { setCurrencyTab(currency); setSourceAccount(""); setCustomAmount("") }} className={cn("h-10 rounded-xl text-sm font-bold transition", currencyTab === currency ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                      {getCurrencySymbol(currency)}
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

            <section className="space-y-3">
              <MobileSectionHeader title="Elige el monto" description="Selecciona una opción segura antes de confirmar el pago." action={
                card.statement_due_date ? (
                  <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                    Pagar antes del {formatDate(card.statement_due_date)}
                  </span>
                ) : null
              } />
              <PaymentOptionCard title="Mínimo pendiente" description="Evita afectar tu historial crediticio" amount={formatCurrency(minimumPayment, currencyTab)} selected={paymentMode === "minimum_payment"} onClick={() => selectAmount("minimum_payment", minimumPayment)} />
              <PaymentOptionCard title="Pendiente al corte" description="Evita cargos por interés" amount={formatCurrency(pendingStatement, currencyTab)} selected={paymentMode === "statement_balance"} onClick={() => selectAmount("statement_balance", pendingStatement)} />
              <PaymentOptionCard title="Balance a la fecha" description="Pagarás todo lo consumido." amount={formatCurrency(balanceToDate, currencyTab)} selected={paymentMode === "balance_to_date"} onClick={() => selectAmount("balance_to_date", balanceToDate)} />
              <PaymentOptionCard title="Otro monto" amount={selectedAmount > 0 && paymentMode === "custom" ? formatCurrency(selectedAmount, currencyTab) : ""} selected={paymentMode === "custom"} onClick={() => { setPaymentMode("custom"); setCustomAmount(""); setShowCustomSheet(true) }} />
              <button type="button" className="text-sm font-semibold text-primary">¿Cómo pagar mi tarjeta?</button>
            </section>

            {conversionApplies && source && (
              <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                <p className="text-sm font-bold">Tasa de cambio</p>
                <p className="mt-1 text-xs text-muted-foreground">{getCurrencySymbol("DOP")} por {getCurrencySymbol("USD")}1. Puedes ajustar esta tasa si tu banco usa otra.</p>
                <input value={exchangeRate} onChange={(e) => setExchangeRate(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="59.50" className="mt-3 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold outline-none" />
                <div className="mt-3 rounded-xl bg-background/70 p-3 text-sm">
                  <div className="flex justify-between gap-4"><span className="text-muted-foreground">Total a descontar</span><span className="text-xl font-bold">{formatCurrency(sourceDebitAmount, source.currency)}</span></div>
                  {selectedAmount > 0 ? <div className="mt-2 flex justify-between gap-4 text-xs"><span className="text-muted-foreground">Impuesto DGII 0.15%</span><span className="text-amber-600 dark:text-amber-400">{formatCurrency(dgiiAmount, source.currency)}</span></div> : null}
                  {selectedAmount > 0 ? <div className="mt-1 flex justify-between gap-4 border-t border-amber-500/20 pt-2 text-xl font-bold"><span className="text-muted-foreground">Total a debitar</span><span>{formatCurrency(totalDebit, source.currency)}</span></div> : null}
                  <p className="mt-1 text-xs text-muted-foreground">Tasa guardada para esta transacción.</p>
                </div>
              </section>
            )}

            <section className="rounded-2xl bg-card p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Comentario opcional</p>
              <input value={paymentComment} onChange={(e) => setPaymentComment(e.target.value)} placeholder="Pago de mayo" className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none" />
            </section>

            <StickyFormFooter className="fixed left-0 right-0">
              <button type="button" disabled={!valid || isPaying} onClick={() => setShowConfirmSheet(true)} className="h-14 w-full rounded-full bg-primary text-base font-bold text-primary-foreground disabled:bg-muted disabled:text-muted-foreground">Continuar</button>
            </StickyFormFooter>
          </>
        )}
      </div>
      <CustomAmountSheet
        currencySymbol={currencySymbol}
        maxAmount={balanceToDate}
        open={showCustomSheet}
        onOpenChange={setShowCustomSheet}
        onConfirm={(amount) => {
          setCustomAmount(String(amount))
          setPaymentMode("custom")
          setShowCustomSheet(false)
        }}
      />
      {showConfirmSheet && card && source ? (
        <ConfirmPaymentSheet
          amount={selectedAmount}
          taxAmount={dgiiAmount}
          totalDebit={totalDebit}
          currencySymbol={currencySymbol}
          sourceCurrencySymbol={getCurrencySymbol(source.currency)}
          sourceAccountName={source.name}
          sourceAvailable={formatCurrency(Number(source.balance || 0), source.currency)}
          cardName={card.name}
          warning={warning}
          loading={isPaying}
          conversionSummary={conversionApplies ? `Al pagar ${currencySymbol}${selectedAmount.toFixed(2)} se debitaran ${getCurrencySymbol(source.currency)}${sourceDebitAmount.toFixed(2)}` : undefined}
          onClose={() => setShowConfirmSheet(false)}
          onConfirm={async () => {
            await handlePay()
            setShowConfirmSheet(false)
          }}
        />
      ) : null}
      <MovementReceipt
        open={Boolean(receipt)}
        title="Pago de tarjeta registrado"
        amount={receipt ? formatCurrency(receipt.amount, receipt.currency) : ""}
        onClose={closeReceiptToDashboard}
        primaryActionLabel="Ver tarjeta"
        secondaryActionLabel="Listo"
        onPrimaryAction={() => receipt && router.push(`/accounts/${receipt.cardId}`)}
        onSecondaryAction={closeReceiptToDashboard}
        sections={[
          {
            title: "Detalle del pago",
            lines: [
              { label: "Tipo", value: "Pago de tarjeta de crédito" },
              { label: "Origen", value: receipt ? `${receipt.sourceName} ·-${source?.account_number?.slice(-4) || ""}` : "" },
              { label: "Destino", value: receipt ? `${receipt.cardName} ·-${card?.account_number?.slice(-4) || selectedCardId.slice(-4)}` : "" },
              { label: "Fecha y hora", value: receipt?.date.toLocaleString("es-DO", { day: "2-digit", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" }) },
              ...(receipt?.dgiiAmount ? [{ label: "Impuesto DGII 0.15%", value: formatCurrency(receipt.dgiiAmount, receipt.sourceCurrency) }] : []),
              { label: "No. Transacción", value: receipt?.id || "—" },
            ],
          },
        ]}
      />
    </MobilePageShell>
  )
}
