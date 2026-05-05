"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  X,
  Search,
  ChevronRight,
  Banknote,
  Building2,
  User,
  Plus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAccounts, useBeneficiaries, createTransfer, createBeneficiary } from "@/hooks/use-data"
import { formatCurrency } from "@/lib/data"
import { PaymentSlider } from "@/components/payment-slider"
import { MoneyInput } from "@/components/ui/money-input"
import { mutate } from "swr"
import { BaseModalForm } from "@/components/ui/base-modal-form"
import { notify } from "@/lib/notifications"
import { EventBus } from "@/lib/event-bus"

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
  const [isSending, setIsSending] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

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
  const selectedBeneficiary = beneficiaries.find(b => b.id === selectedRecipient)
  const parsedAmount = parseFloat(amount.replace(/[^0-9.]/g, "")) || 0
  const availableBalance = selectedSourceAccount?.balance || 0
  const commissionAmount = applyCommission ? Math.round(parsedAmount * 0.15) / 100 : 0
  const totalAmount = parsedAmount + commissionAmount
  const exceedsBalance = totalAmount > availableBalance

  const isValid = parsedAmount > 0 && !exceedsBalance && selectedRecipient

  const handleSend = async () => {
    if (!isValid) return
    setIsSending(true)
    try {
      await createTransfer({
        from_account_id: selectedAccount,
        to_account_id: recipientType === "account" ? selectedRecipient : undefined,
        to_beneficiary_id: recipientType === "beneficiary" ? selectedRecipient : undefined,
        amount: parsedAmount,
        currency: selectedSourceAccount?.currency || "DOP",
        description: description || undefined,
        apply_commission: applyCommission,
      })
      setIsSending(false)
      setShowSuccess(true)
      notify({ title: "Transferencia realizada", message: "Movimiento creado con éxito y balance actualizado." })
      EventBus.emit({ type: "transfer_completed" })
      setTimeout(() => router.push("/"), 1500)
    } catch (error) {
      console.error("Transfer error:", error)
      notify({
        title: "No se pudo enviar",
        message: "Ese monto supera tu balance disponible. Intenta con un monto menor.",
      })
      setIsSending(false)
    }
  }

  return (
    <div className="app-scroll min-h-[100dvh] overflow-y-auto bg-background pb-nav-safe">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 pb-4 pt-8">
        <Link
          href="/"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-semibold text-foreground">Enviar dinero</h1>
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
              <button
                onClick={() => { setRecipientType("account"); setSelectedRecipient("") }}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all",
                  recipientType === "account" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                )}
              >
                <Building2 className="h-4 w-4" />
                Cuenta
              </button>
              <button
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
              <div className="flex gap-2">
                {nonCreditAccounts.map(account => {
                  const Icon = account.type === "cash" ? Banknote : Building2
                  return (
                    <button
                      key={account.id}
                      onClick={() => setSelectedAccount(account.id)}
                      className={cn(
                        "flex flex-1 flex-col items-center gap-2 rounded-2xl border p-4 transition-all",
                        selectedAccount === account.id
                          ? "border-primary bg-primary/10"
                          : "border-border bg-card"
                      )}
                    >
                      <Icon className={cn("h-6 w-6", selectedAccount === account.id ? "text-primary" : "text-muted-foreground")} />
                      <span className="text-xs font-medium">{account.name}</span>
                      <span className="text-xs text-muted-foreground">{formatCurrency(account.balance)}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Recipient Selection */}
            {recipientType === "beneficiary" && (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">Beneficiario</p>
                  <button
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
                <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                  {filteredBeneficiaries.map(b => (
                    <button
                      key={b.id}
                      onClick={() => setSelectedRecipient(b.id)}
                      className={cn(
                        "flex w-full items-center gap-4 rounded-2xl bg-card p-4 transition-all",
                        selectedRecipient === b.id && "border-2 border-primary"
                      )}
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <User className="h-5 w-5" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-medium">{b.name}</p>
                        {b.bank_name && <p className="text-sm text-muted-foreground">{b.bank_name}</p>}
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </button>
                  ))}
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
                <div className="flex gap-2">
                  {nonCreditAccounts.filter(a => a.id !== selectedAccount).map(account => {
                    const Icon = account.type === "cash" ? Banknote : Building2
                    return (
                      <button
                        key={account.id}
                        onClick={() => setSelectedRecipient(account.id)}
                        className={cn(
                          "flex flex-1 flex-col items-center gap-2 rounded-2xl border p-4 transition-all",
                          selectedRecipient === account.id
                            ? "border-primary bg-primary/10"
                            : "border-border bg-card"
                        )}
                      >
                        <Icon className="h-6 w-6" />
                        <span className="text-xs font-medium">{account.name}</span>
                      </button>
                    )
                  })}
                </div>
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
              <button onClick={() => setStep("select")} className="text-sm text-primary">
                Cambiar
              </button>
            </div>

            <div className="flex flex-col items-center pt-4">
              <p className="text-sm text-muted-foreground">Monto a enviar</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-medium text-muted-foreground">RD$</span>
                <MoneyInput
                  value={amount}
                  onValueChange={setAmount}
                  placeholder="0"
                  className="w-full bg-transparent text-center text-5xl font-bold text-foreground outline-none placeholder:text-muted-foreground/30"
                  autoFocus
                />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Disponible: {formatCurrency(availableBalance)}
              </p>
              <button
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
                <p className="mt-1 text-xs text-red-500">
                  El monto más comisión excede tu balance disponible.
                </p>
              )}
            </div>

            {/* Quick amounts */}
            <div className="flex flex-wrap justify-center gap-2">
              {[500, 1000, 2000, 5000].map(val => (
                <button
                  key={val}
                  onClick={() => setAmount(val.toString())}
                  className="rounded-full bg-muted px-4 py-2 text-sm font-medium"
                >
                  RD${val.toLocaleString()}
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
                  onClick={() => setStep("confirm")}
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
                <span className="text-sm text-muted-foreground">Recipient</span>
                <span className="font-medium">
                  {recipientType === "beneficiary"
                    ? selectedBeneficiary?.name
                    : accounts.find(a => a.id === selectedRecipient)?.name}
                </span>
              </div>
              <div className="my-4 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Monto</span>
                <span className="text-3xl font-bold text-foreground">
                  RD${totalAmount.toLocaleString()}
                </span>
              </div>
              {applyCommission && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Comisión</span>
                  <span className="font-medium">RD${commissionAmount.toLocaleString()}</span>
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
                  {formatCurrency(availableBalance - parsedAmount)}
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
              <label className="mb-2 block text-sm font-medium text-muted-foreground">Nombre</label>
              <Input
                value={newBeneficiaryName}
                onChange={e => setNewBeneficiaryName(e.target.value)}
                placeholder="Ej. Juan Pérez"
                className="h-12"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-muted-foreground">Número de cuenta</label>
              <Input
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
    </div>
  )
}
