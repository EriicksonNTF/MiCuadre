"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  X,
  Search,
  Building2,
  User,
  Plus,
  CalendarDays,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAccounts, useBeneficiaries, createTransfer, createBeneficiary } from "@/hooks/use-data"
import { formatCurrency, getCurrencySymbol } from "@/lib/data"
import { PaymentSlider } from "@/components/payment-slider"
import { MoneyInput } from "@/components/ui/money-input"
import { AccountCarouselSelector } from "@/components/ui/account-carousel-selector"
import { mutate } from "swr"
import { BaseModalForm } from "@/components/ui/base-modal-form"
import { notify } from "@/lib/notifications"
import { EventBus } from "@/lib/event-bus"
import { MovementReceipt } from "@/components/receipts/movement-receipt"
import { MobilePageShell } from "@/components/ui/mobile-foundation"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"

export default function SendPage() {
  const router = useRouter()
  const { data: accounts = [] } = useAccounts()
  const { data: beneficiaries = [] } = useBeneficiaries()

  const [step, setStep] = useState<"select" | "amount" | "confirm">("select")
  const [recipientType, setRecipientType] = useState<"account" | "beneficiary">("account")
  const [selectedAccount, setSelectedAccount] = useState<string>("")
  const [selectedRecipient, setSelectedRecipient] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState("")
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [applyCommission, setApplyCommission] = useState(false)
  const [date, setDate] = useState<Date>(new Date())
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [confirmSourceBalance, setConfirmSourceBalance] = useState<number | null>(null)
  const [receipt, setReceipt] = useState<{
    id?: string
    amount: number
    currency: "DOP" | "USD"
    sourceName: string
    destinationName: string
    previousSourceBalance: number
    newSourceBalance: number
    previousDestinationBalance?: number
    newDestinationBalance?: number
    note?: string
    date: Date
  } | null>(null)

  const [showAddBeneficiary, setShowAddBeneficiary] = useState(false)
  const [newBeneficiaryName, setNewBeneficiaryName] = useState("")
  const [newBeneficiaryAccount, setNewBeneficiaryAccount] = useState("")
  const [isAddingBeneficiary, setIsAddingBeneficiary] = useState(false)

  const handleAddBeneficiary = async () => {
    if (!newBeneficiaryName || !newBeneficiaryAccount) return
    setIsAddingBeneficiary(true)
    try {
      const newBen = await createBeneficiary({
        name: newBeneficiaryName,
        account_reference: newBeneficiaryAccount,
        bank_name: null,
        notes: null,
        is_favorite: false,
      })
      mutate("beneficiaries")
      setRecipientType("beneficiary")
      setSelectedRecipient(newBen.id)
      setShowAddBeneficiary(false)
      setNewBeneficiaryName("")
      setNewBeneficiaryAccount("")
      notify({ title: "Beneficiario agregado", message: `${newBeneficiaryName} fue agregado correctamente.` })
      EventBus.emit({ type: "beneficiary_created", payload: { name: newBeneficiaryName } })
    } catch (error) {
      console.error("Error creating beneficiary:", error)
    } finally {
      setIsAddingBeneficiary(false)
    }
  }

  const nonCreditAccounts = useMemo(() => 
    accounts.filter(a => a.type !== "credit"), 
  [accounts]
  )

  const filteredBeneficiaries = useMemo(() => {
    if (!searchQuery) return beneficiaries
    return beneficiaries.filter(b => 
      b.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [beneficiaries, searchQuery])

  const selectedSourceAccount = accounts.find(a => a.id === selectedAccount)
  const selectedDestinationAccount = accounts.find(a => a.id === selectedRecipient)
  const selectedBeneficiary = beneficiaries.find(b => b.id === selectedRecipient)
  const parsedAmount = parseFloat(amount.replace(/[^0-9.]/g, "")) || 0
  const availableBalance = selectedSourceAccount?.balance || 0
  const commissionAmount = applyCommission ? Math.round(parsedAmount * 0.15) / 100 : 0
  const totalAmount = parsedAmount + commissionAmount
  const exceedsBalance = totalAmount > availableBalance

  const isValid = parsedAmount > 0 && !exceedsBalance && selectedRecipient
  const previewOriginalBalance = confirmSourceBalance ?? availableBalance
  const newBalancePreview = previewOriginalBalance - totalAmount

  const handleSend = async () => {
    if (!isValid) return
    setIsSending(true)
    try {
      const previousSourceBalance = Number(selectedSourceAccount?.balance || 0)
      const previousDestinationBalance = recipientType === "account" ? Number(selectedDestinationAccount?.balance || 0) : undefined
      const localDate = format(date, "yyyy-MM-dd")
      const transfer = await createTransfer({
        from_account_id: selectedAccount,
        to_account_id: recipientType === "account" ? selectedRecipient : undefined,
        to_beneficiary_id: recipientType === "beneficiary" ? selectedRecipient : undefined,
        amount: parsedAmount,
        currency: selectedSourceAccount?.currency || "DOP",
        description: description || undefined,
        apply_commission: applyCommission,
        local_date: localDate !== format(new Date(), "yyyy-MM-dd") ? localDate : undefined,
      })
      setIsSending(false)
      notify({ title: "Transferencia realizada", message: "Movimiento creado con éxito y balance actualizado." })
      EventBus.emit({ type: "transfer_completed" })
      setReceipt({
        id: transfer?.id,
        amount: parsedAmount,
        currency: (selectedSourceAccount?.currency || "DOP") as "DOP" | "USD",
        sourceName: selectedSourceAccount?.name || "Cuenta origen",
        destinationName: recipientType === "beneficiary"
          ? selectedBeneficiary?.name || "Beneficiario"
          : selectedDestinationAccount?.name || "Cuenta destino",
        previousSourceBalance,
        newSourceBalance: previousSourceBalance - totalAmount,
        previousDestinationBalance,
        newDestinationBalance: typeof previousDestinationBalance === "number" ? previousDestinationBalance + parsedAmount : undefined,
        note: description || undefined,
        date: new Date(),
      })
      resetFlowAfterReceipt()
    } catch (error) {
      console.error("Transfer error:", error)
      notify({
        title: "No se pudo transferir",
        message: error instanceof Error ? error.message : "Error inesperado al procesar la transferencia.",
      })
      setIsSending(false)
    }
  }

  const resetFlowAfterReceipt = () => {
    setStep("select")
    setRecipientType("account")
    setSelectedAccount("")
    setSelectedRecipient("")
    setSearchQuery("")
    setAmount("")
    setDescription("")
    setApplyCommission(false)
    setConfirmSourceBalance(null)
  }

  const closeReceiptToDashboard = () => {
    setReceipt(null)
    router.push("/dashboard")
  }

  return (
    <MobilePageShell fullBleed className="pb-nav-safe">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 pb-4 pt-8">
        <Link
          href="/"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-semibold text-foreground">Transferir dinero</h1>
      </header>

      {/* Progress Steps */}
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

      <div className="px-6 pt-6">
        {/* Step 1: Select Recipient */}
        {step === "select" && (
          <div className="space-y-6">
            {/* Recipient Type Toggle */}
            <div className="flex h-12 overflow-hidden rounded-2xl bg-card p-1">
              <button type="button"
                onClick={() => { setRecipientType("account"); setSelectedRecipient("") }}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all",
                  recipientType === "account" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                )}
              >
                <Building2 className="h-4 w-4" />
                Cuenta
              </button>
              <button type="button"
                onClick={() => { setRecipientType("beneficiary"); setSelectedRecipient("") }}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all",
                  recipientType === "beneficiary" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                )}
              >
                <User className="h-4 w-4" />
                Beneficiario
              </button>
            </div>

            {/* Source Account */}
            <div>
              <p className="mb-3 text-sm font-medium text-muted-foreground">Desde cuenta</p>
              <AccountCarouselSelector
                items={nonCreditAccounts.map((account) => ({ id: account.id, title: account.name, subtitle: formatCurrency(Number(account.balance || 0), account.currency), detail: account.type }))}
                selectedId={selectedAccount}
                onSelect={setSelectedAccount}
              />
            </div>

            {/* Recipient Selection */}
            {recipientType === "beneficiary" && (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">Beneficiario</p>
                  <button type="button"
                    onClick={() => setShowAddBeneficiary(true)}
                    className="flex items-center gap-1 text-sm font-medium text-primary"
                  >
                    <Plus className="h-4 w-4" />
                    Nuevo
                  </button>
                </div>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Buscar beneficiario..."
                    className="h-12 pl-11"
                  />
                </div>
                <div className="mt-3">
                  <AccountCarouselSelector
                    compact
                    items={filteredBeneficiaries.map((b) => ({ id: b.id, title: b.name, subtitle: b.bank_name || "Beneficiario", detail: b.account_reference || "" }))}
                    selectedId={selectedRecipient}
                    onSelect={setSelectedRecipient}
                    emptyMessage="No hay beneficiarios. Agrega uno primero."
                  />
                  {filteredBeneficiaries.length === 0 && (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      No hay beneficiarios. Agrega uno primero.
                    </p>
                  )}
                </div>
              </div>
            )}

            {recipientType === "account" && (
              <div>
                <p className="mb-3 text-sm font-medium text-muted-foreground">Hacia cuenta</p>
                <AccountCarouselSelector
                  items={nonCreditAccounts.filter(a => a.id !== selectedAccount).map((account) => ({ id: account.id, title: account.name, subtitle: formatCurrency(Number(account.balance || 0), account.currency), detail: account.type }))}
                  selectedId={selectedRecipient}
                  onSelect={setSelectedRecipient}
                />
              </div>
            )}

            {/* Continue Button */}
            <div className="pb-6 pt-4">
              <Button
                onClick={() => setStep("amount")}
                disabled={!selectedAccount || !selectedRecipient}
                className="h-14 w-full rounded-2xl text-base font-semibold"
              >
                Continuar
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Enter Amount */}
        {step === "amount" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between rounded-2xl bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">
                    {recipientType === "beneficiary"
                      ? selectedBeneficiary?.name
                      : accounts.find(a => a.id === selectedRecipient)?.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {recipientType === "beneficiary"
                      ? selectedBeneficiary?.bank_name
                      : "Cuenta propia"}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setStep("select")} className="text-sm text-primary">
                Cambiar
              </button>
            </div>

            <div className="flex flex-col items-center pt-4">
              <p className="text-sm text-muted-foreground">Monto a transferir</p>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-medium text-muted-foreground">{getCurrencySymbol("DOP")}</span>
                <MoneyInput
                  value={amount}
                  onValueChange={(value) => {
                    setAmount(value)
                  }}
                  placeholder="0"
                  className="hero-amount w-full bg-transparent text-center text-input-hero font-extrabold leading-none text-foreground tabular-nums outline-none placeholder:text-muted-foreground/30 min-w-[120px]"
                  autoFocus
                />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Disponible: {formatCurrency(availableBalance)}
              </p>
              <button type="button"
                onClick={() => setApplyCommission((prev) => !prev)}
                className={cn(
                  "mt-2 rounded-full px-3 py-1 text-xs font-medium",
                  applyCommission ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                Comisión 0.15%
              </button>
              {applyCommission && parsedAmount > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Comisión: {formatCurrency(commissionAmount)} · Total: {formatCurrency(totalAmount)}
                </p>
              )}
              {exceedsBalance && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  El monto más comisión excede tu balance disponible.
                </p>
              )}
            </div>

            <div className="flex justify-center">
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <button type="button" className="flex h-12 items-center gap-2 rounded-full bg-card pl-4 pr-5 ring-1 ring-border/60">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold text-foreground">{format(date, "d MMM yyyy", { locale: es })}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="center">
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
            </div>

            {/* Quick amounts */}
            <div className="flex flex-wrap justify-center gap-2">
              {[500, 1000, 2000, 5000].map(val => (
                <button type="button"
                  key={val}
                  onClick={() => {
                    setAmount(val.toString())
                  }}
                  className="rounded-full bg-muted px-4 py-2 text-sm font-medium"
                >
                  {getCurrencySymbol("DOP")}{val.toLocaleString()}
                </button>
              ))}
            </div>

            {/* Description */}
            <div>
              <Input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Descripción (opcional)"
                className="h-12 text-center"
              />
            </div>

            {/* Continue Button */}
            <div className="pb-6 pt-4">
                <Button
                  onClick={() => {
                    setConfirmSourceBalance(availableBalance)
                    setStep("confirm")
                  }}
                  disabled={parsedAmount <= 0 || exceedsBalance}
                  className="h-14 w-full rounded-2xl text-base font-semibold"
                >
                Continuar
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === "confirm" && (
          <div className="space-y-6">
            <div className="rounded-3xl bg-card p-6">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Destino</span>
                <span className="font-medium">
                  {recipientType === "beneficiary"
                    ? selectedBeneficiary?.name
                    : accounts.find(a => a.id === selectedRecipient)?.name}
                </span>
              </div>
              <div className="my-4 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Monto</span>
                <span className="text-3xl font-bold text-foreground">
                  {getCurrencySymbol("DOP")}{totalAmount.toLocaleString()}
                </span>
              </div>
              {applyCommission && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Comisión</span>
                  <span className="font-medium">{getCurrencySymbol("DOP")}{commissionAmount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Desde</span>
                <span className="font-medium">{selectedSourceAccount?.name}</span>
              </div>
              <div className="my-4 h-px bg-border" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Nuevo balance</span>
                <span className="font-medium text-muted-foreground">
                  {formatCurrency(newBalancePreview, selectedSourceAccount?.currency)}
                </span>
              </div>
            </div>

            {/* Send Button */}
            <div className="pb-6 pt-4">
              <PaymentSlider
                amount={parsedAmount}
                currency={selectedSourceAccount?.currency || "DOP"}
                recipientName={recipientType === "beneficiary" ? selectedBeneficiary?.name || "" : accounts.find(a => a.id === selectedRecipient)?.name || ""}
                onConfirm={handleSend}
                disabled={!isValid || isSending}
                loading={isSending}
                label="Desliza para transferir"
              />
              <button type="button"
                onClick={() => setStep("amount")}
                className="mt-3 h-12 w-full text-sm text-muted-foreground"
              >
                Volver atrás
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Beneficiary Modal */}
      {showAddBeneficiary && (
        <BaseModalForm
          title="Nuevo beneficiario"
          onClose={() => setShowAddBeneficiary(false)}
          footer={
            <Button
              onClick={handleAddBeneficiary}
              disabled={!newBeneficiaryName || !newBeneficiaryAccount || isAddingBeneficiary}
              className="h-14 w-full rounded-2xl text-base font-semibold"
            >
              {isAddingBeneficiary ? "Agregando..." : "Agregar beneficiario"}
            </Button>
          }
        >
          <div className="space-y-4 pt-4">
            <div>
              <label htmlFor="beneficiary-name" className="mb-2 block text-sm font-medium text-muted-foreground">Nombre</label>
              <Input
                id="beneficiary-name"
                value={newBeneficiaryName}
                onChange={e => setNewBeneficiaryName(e.target.value)}
                placeholder="Ej. Juan Pérez"
                className="h-12"
              />
            </div>
            <div>
              <label htmlFor="beneficiary-account" className="mb-2 block text-sm font-medium text-muted-foreground">Número de cuenta</label>
              <Input
                id="beneficiary-account"
                value={newBeneficiaryAccount}
                onChange={e => setNewBeneficiaryAccount(e.target.value)}
                placeholder="000000000"
                className="h-12"
                inputMode="numeric"
              />
            </div>
          </div>
        </BaseModalForm>
      )}
      <MovementReceipt
        open={Boolean(receipt)}
        title="Transferencia registrada"
        amount={receipt ? formatCurrency(receipt.amount, receipt.currency) : ""}
        onClose={closeReceiptToDashboard}
        primaryActionLabel="Ver movimientos"
        secondaryActionLabel="Listo"
        onPrimaryAction={() => router.push("/history")}
        onSecondaryAction={closeReceiptToDashboard}
        sections={[
          {
            title: "Desde",
            lines: [
              { label: "Cuenta", value: receipt?.sourceName },
              { label: "Balance anterior", value: receipt ? formatCurrency(receipt.previousSourceBalance, receipt.currency) : undefined },
              { label: "Nuevo balance", value: receipt ? formatCurrency(receipt.newSourceBalance, receipt.currency) : undefined },
            ],
          },
          {
            title: "Hacia",
            lines: [
              { label: "Destino", value: receipt?.destinationName },
              { label: "Balance anterior", value: receipt?.previousDestinationBalance !== undefined ? formatCurrency(receipt.previousDestinationBalance, receipt.currency) : undefined },
              { label: "Nuevo balance", value: receipt?.newDestinationBalance !== undefined ? formatCurrency(receipt.newDestinationBalance, receipt.currency) : undefined },
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
    </MobilePageShell>
  )
}
