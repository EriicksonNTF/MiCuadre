"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRightLeft, ArrowUp, Banknote, Building2, ChevronDown, CreditCard, Landmark, PiggyBank, Plus, Star, Wallet } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { PaymentSlider } from "@/components/payment-slider"
import { BaseModalForm } from "@/components/ui/base-modal-form"
import { MoneyInput } from "@/components/ui/money-input"
import { BrandedAccountCard } from "@/components/accounts/branded-account-card"
import { notify } from "@/lib/notifications"
import { EventBus } from "@/lib/event-bus"
import { createClient } from "@/lib/supabase/client"
import { createAccount, createTransfer, reorderAccounts, setFavoriteAccount, useAccounts } from "@/hooks/use-data"
import { formatCurrency } from "@/lib/data"
import { parseAmount, transferSchema } from "@/lib/validation"

const ICON_PRESETS = [
  { value: "banknote", label: "Efectivo", icon: Banknote },
  { value: "building-2", label: "Banco", icon: Building2 },
  { value: "credit-card", label: "Tarjeta", icon: CreditCard },
  { value: "landmark", label: "Institución", icon: Landmark },
  { value: "piggy-bank", label: "Ahorro", icon: PiggyBank },
  { value: "wallet", label: "Billetera", icon: Wallet },
]

const COLOR_PRESETS = [
  { name: "Azul banco", primary: "#0b4a8a", secondary: "#38bdf8" },
  { name: "Verde efectivo", primary: "#0f766e", secondary: "#14b8a6" },
  { name: "Crédito premium", primary: "#07111f", secondary: "#0ea5e9" },
  { name: "Violeta moderno", primary: "#4338ca", secondary: "#6366f1" },
  { name: "Naranja cálido", primary: "#b45309", secondary: "#fb923c" },
  { name: "Personalizado", primary: "#334155", secondary: "#64748b" },
]

const EMOJI_PRESETS = ["💳", "🏦", "💵", "🪙", "🧾", "💼", "📈", "🛍️"]

export function AccountsScreen() {
  const { data: accounts = [] } = useAccounts()
  const [showTransfer, setShowTransfer] = useState(false)
  const [showCreateAccount, setShowCreateAccount] = useState(false)

  const [accountName, setAccountName] = useState("")
  const [accountType, setAccountType] = useState<"cash" | "debit" | "credit">("cash")
  const [accountCurrency, setAccountCurrency] = useState<"DOP" | "USD">("DOP")
  const [initialBalance, setInitialBalance] = useState("")
  const [creditLimit, setCreditLimit] = useState("")
  const [closingDate, setClosingDate] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  const [brandingIconType, setBrandingIconType] = useState<"emoji" | "icon" | "image">("icon")
  const [brandingIconValue, setBrandingIconValue] = useState("building-2")
  const [brandingIconUrl, setBrandingIconUrl] = useState<string | null>(null)
  const [brandingPrimaryColor, setBrandingPrimaryColor] = useState("#0b4a8a")
  const [brandingSecondaryColor, setBrandingSecondaryColor] = useState("#38bdf8")
  const [brandingBackgroundStyle, setBrandingBackgroundStyle] = useState<"gradient" | "solid" | "glass">("gradient")
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)

  const [fromAccount, setFromAccount] = useState("")
  const [toAccount, setToAccount] = useState("")
  const [transferAmount, setTransferAmount] = useState("")
  const [applyCommission, setApplyCommission] = useState(false)
  const [isTransferring, setIsTransferring] = useState(false)

  const parsedTransferAmount = parseFloat(transferAmount.replace(/[^0-9.]/g, "")) || 0
  const transferCommissionAmount = applyCommission ? Math.round(parsedTransferAmount * 0.15) / 100 : 0
  const totalTransferAmount = parsedTransferAmount + transferCommissionAmount
  const selectedFromAccount = accounts.find((a) => a.id === fromAccount)
  const exceedsFromBalance = Boolean(selectedFromAccount && totalTransferAmount > Number(selectedFromAccount.balance || 0))

  const previewAccount = useMemo(() => ({
    id: "preview",
    user_id: "preview",
    name: accountName || "Cuenta personalizada",
    type: accountType,
    currency: accountCurrency,
    balance: parseAmount(initialBalance),
    credit_limit: accountType === "credit" ? parseAmount(creditLimit) : null,
    current_debt: 0,
    statement_balance: null,
    pending_amount: null,
    paid_amount: null,
    cycle_start_date: null,
    cycle_end_date: null,
    closing_date: accountType === "credit" && closingDate ? parseInt(closingDate) : null,
    due_date: accountType === "credit" && dueDate ? parseInt(dueDate) : null,
    minimum_payment: null,
    color: "",
    icon: "",
    icon_url: brandingIconUrl,
    icon_type: brandingIconType,
    icon_value: brandingIconValue,
    primary_color: brandingPrimaryColor,
    secondary_color: brandingSecondaryColor,
    background_style: brandingBackgroundStyle,
    is_active: true,
    sort_order: null,
    is_favorite: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }), [accountName, accountType, accountCurrency, initialBalance, creditLimit, closingDate, dueDate, brandingIconUrl, brandingIconType, brandingIconValue, brandingPrimaryColor, brandingSecondaryColor, brandingBackgroundStyle])

  const moveAccountUp = async (id: string) => {
    const index = accounts.findIndex((a) => a.id === id)
    if (index <= 0) return
    const next = [...accounts]
    const [item] = next.splice(index, 1)
    next.splice(index - 1, 0, item)
    await reorderAccounts(next.map((a) => a.id))
  }

  const handleLogoUpload = async (file?: File) => {
    if (!file) return
    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"]
    if (!validTypes.includes(file.type) || file.size > 2 * 1024 * 1024) {
      notify({ title: "Archivo no válido", message: "Usa PNG/JPG/WEBP y máximo 2MB." })
      return
    }

    setIsUploadingLogo(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const ext = file.name.split(".").pop() || "png"
      const path = `${user.id}/accounts/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from("account-logos").upload(path, file, { upsert: true, contentType: file.type })
      if (error) throw error
      const { data } = supabase.storage.from("account-logos").getPublicUrl(path)
      setBrandingIconUrl(data.publicUrl)
      setBrandingIconType("image")
    } catch {
      notify({ title: "Error", message: "No se pudo subir el logo." })
    } finally {
      setIsUploadingLogo(false)
    }
  }

  const handleCreateAccount = async () => {
    if (!accountName || !initialBalance) return
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
        color: "",
        icon: "",
        is_active: true,
        closing_date: accountType === "credit" && closingDate ? parseInt(closingDate) : null,
        due_date: accountType === "credit" && dueDate ? parseInt(dueDate) : null,
        icon_url: brandingIconUrl,
        icon_type: brandingIconType,
        icon_value: brandingIconValue,
        primary_color: brandingPrimaryColor,
        secondary_color: brandingSecondaryColor,
        background_style: brandingBackgroundStyle,
      })
      notify({ title: "Cuenta creada", message: "Tu cuenta fue creada correctamente." })
      EventBus.emit({ type: "account_created", payload: { name: accountName } })
      setShowCreateAccount(false)
    } finally {
      setIsCreating(false)
    }
  }

  const handleTransfer = async () => {
    const validation = transferSchema.safeParse({ fromAccountId: fromAccount, toAccountId: toAccount, amount: transferAmount, description: undefined })
    if (!validation.success) return
    const amount = parseAmount(transferAmount)
    const source = accounts.find((a) => a.id === fromAccount)
    if (!source) return
    const commissionAmount = applyCommission ? Math.round(amount * 0.15) / 100 : 0
    if (amount + commissionAmount > Number(source.balance || 0)) {
      notify({ title: "Fondos insuficientes", message: "El monto más comisión supera tu balance disponible." })
      return
    }

    setIsTransferring(true)
    try {
      await createTransfer({ from_account_id: fromAccount, to_account_id: toAccount, amount, currency: source.currency, apply_commission: applyCommission })
      notify({ title: "Transferencia exitosa", message: "Se han transferido los fondos." })
      EventBus.emit({ type: "transfer_completed" })
      setShowTransfer(false)
      setFromAccount("")
      setToAccount("")
      setTransferAmount("")
      setApplyCommission(false)
    } finally {
      setIsTransferring(false)
    }
  }

  return (
    <div className="app-scroll min-h-[100dvh] overflow-y-auto bg-background pb-nav-safe">
      <header className="px-6 pb-4 pt-8">
        <h1 className="text-2xl font-bold text-foreground">Cuentas</h1>
        <p className="mt-1 text-sm text-muted-foreground">Administra tu dinero</p>
      </header>

      <div className="space-y-4 px-6 pt-4">
        {accounts.map((account) => (
          <div key={account.id} className="space-y-2">
            <Link href={`/accounts/${account.id}`} className="group block transition-transform active:scale-[0.98]">
              <BrandedAccountCard account={account} />
            </Link>
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => void setFavoriteAccount(account.id)} className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                <Star className={cn("h-3.5 w-3.5", account.is_favorite ? "fill-amber-500 text-amber-500" : "")} /> Favorita
              </button>
              <button onClick={() => void moveAccountUp(account.id)} className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                <ArrowUp className="h-3.5 w-3.5" /> Subir
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3 px-6 pt-6">
        <Button variant="outline" onClick={() => setShowTransfer(true)} className="h-12 flex-1 gap-2 rounded-2xl"><ArrowRightLeft className="h-4 w-4" />Transferir</Button>
        <Button variant="outline" onClick={() => setShowCreateAccount(true)} className="h-12 flex-1 gap-2 rounded-2xl"><Plus className="h-4 w-4" />Nueva cuenta</Button>
      </div>

      {showTransfer && (
        <BaseModalForm
          title="Transferir dinero"
          onClose={() => setShowTransfer(false)}
          footer={<PaymentSlider amount={parsedTransferAmount} currency={selectedFromAccount?.currency || "DOP"} recipientName={accounts.find((a) => a.id === toAccount)?.name || "la cuenta"} onConfirm={handleTransfer} disabled={!fromAccount || !toAccount || parsedTransferAmount <= 0 || exceedsFromBalance || isTransferring} />}
        >
          <div className="space-y-4 pb-safe-areas">
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Desde</p>
              <div className="grid grid-cols-3 gap-2">{accounts.filter((a) => a.type !== "credit").map((a) => <button key={a.id} onClick={() => setFromAccount(a.id)} className={cn("rounded-xl p-3 text-xs", fromAccount === a.id ? "bg-primary text-primary-foreground" : "bg-muted")}>{a.name}</button>)}</div>
            </div>
            <div className="flex justify-center"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted"><ChevronDown className="h-4 w-4 text-muted-foreground" /></div></div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Hacia</p>
              <div className="grid grid-cols-3 gap-2">{accounts.map((a) => <button key={a.id} onClick={() => setToAccount(a.id)} className={cn("rounded-xl p-3 text-xs", toAccount === a.id ? "bg-primary text-primary-foreground" : "bg-muted")}>{a.name}</button>)}</div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Monto</p>
              <MoneyInput value={transferAmount} onValueChange={setTransferAmount} className="w-full rounded-xl bg-muted p-3 text-xl" />
              <button onClick={() => setApplyCommission((prev) => !prev)} className={cn("mt-2 rounded-full px-3 py-1 text-xs font-medium", applyCommission ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>Comisión 0.15%</button>
              {applyCommission && parsedTransferAmount > 0 && <p className="mt-1 text-xs text-muted-foreground">Comisión: {formatCurrency(transferCommissionAmount)} · Total: {formatCurrency(totalTransferAmount)}</p>}
            </div>
          </div>
        </BaseModalForm>
      )}

      {showCreateAccount && (
        <BaseModalForm title="Nueva cuenta" onClose={() => setShowCreateAccount(false)} footer={<Button onClick={handleCreateAccount} disabled={!accountName || !initialBalance || isCreating} className="h-12 w-full rounded-xl">{isCreating ? "Creando cuenta..." : "Guardar cuenta"}</Button>}>
          <div className="space-y-5 pb-safe-areas">
            <input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Nombre de la cuenta" className="w-full rounded-2xl border border-border bg-background px-4 py-4" />
            <div className="grid grid-cols-3 gap-2">{(["cash", "debit", "credit"] as const).map((t) => <button key={t} onClick={() => setAccountType(t)} className={cn("rounded-xl px-3 py-2 text-xs", accountType === t ? "bg-primary text-primary-foreground" : "bg-muted")}>{t === "cash" ? "Efectivo" : t === "debit" ? "Débito" : "Crédito"}</button>)}</div>
            <MoneyInput value={initialBalance} onValueChange={setInitialBalance} placeholder="Balance inicial" className="w-full rounded-xl bg-muted p-3" />

            <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-semibold">Personalización visual</p>
              <div className="grid grid-cols-3 gap-2">{(["icon", "emoji", "image"] as const).map((value) => <button key={value} onClick={() => setBrandingIconType(value)} className={cn("rounded-xl px-3 py-2 text-xs font-medium transition-colors", brandingIconType === value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{value === "icon" ? "Ícono" : value === "emoji" ? "Emoji" : "Logo"}</button>)}</div>
              {brandingIconType === "image" ? <div><input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" onChange={(e) => void handleLogoUpload(e.target.files?.[0])} className="text-xs" />{isUploadingLogo && <p className="mt-1 text-xs text-muted-foreground">Subiendo logo...</p>}</div> : brandingIconType === "emoji" ? <div className="grid grid-cols-8 gap-2">{EMOJI_PRESETS.map((emoji) => <button key={emoji} onClick={() => setBrandingIconValue(emoji)} className={cn("rounded-lg p-2 text-lg", brandingIconValue === emoji ? "bg-primary/15 ring-1 ring-primary" : "bg-muted")}>{emoji}</button>)}</div> : <div className="grid grid-cols-3 gap-2">{ICON_PRESETS.map((preset) => <button key={preset.value} onClick={() => setBrandingIconValue(preset.value)} className={cn("flex flex-col items-center gap-1 rounded-xl p-2", brandingIconValue === preset.value ? "bg-primary text-primary-foreground" : "bg-muted")}><preset.icon className="h-4 w-4" /><span className="text-[10px]">{preset.label}</span></button>)}</div>}
              <div className="grid grid-cols-2 gap-2">{COLOR_PRESETS.map((preset) => <button key={preset.name} onClick={() => { setBrandingPrimaryColor(preset.primary); setBrandingSecondaryColor(preset.secondary) }} className="rounded-xl border border-border p-2 text-left"><div className="h-6 rounded-md" style={{ background: `linear-gradient(135deg, ${preset.primary}, ${preset.secondary})` }} /><p className="mt-1 text-[10px] text-muted-foreground">{preset.name}</p></button>)}</div>
              <div className="grid grid-cols-2 gap-2"><input type="color" value={brandingPrimaryColor} onChange={(e) => setBrandingPrimaryColor(e.target.value)} className="h-10 w-full rounded-xl" /><input type="color" value={brandingSecondaryColor} onChange={(e) => setBrandingSecondaryColor(e.target.value)} className="h-10 w-full rounded-xl" /></div>
              <div className="grid grid-cols-3 gap-2">{(["gradient", "solid", "glass"] as const).map((style) => <button key={style} onClick={() => setBrandingBackgroundStyle(style)} className={cn("rounded-xl px-3 py-2 text-xs", brandingBackgroundStyle === style ? "bg-primary text-primary-foreground" : "bg-muted")}>{style === "gradient" ? "Degradado" : style === "solid" ? "Sólido" : "Soft"}</button>)}</div>
              <BrandedAccountCard account={previewAccount as any} compact />
            </div>

            {accountType === "credit" && (
              <div className="space-y-3 rounded-2xl bg-muted/50 p-4">
                <MoneyInput value={creditLimit} onValueChange={setCreditLimit} placeholder="Límite" className="w-full rounded-xl border border-border bg-background py-3 px-4" />
                <input type="text" inputMode="numeric" value={closingDate} onChange={(e) => setClosingDate(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))} placeholder="Día de cierre" className="w-full rounded-xl border border-border bg-background py-3 px-4" />
                <input type="text" inputMode="numeric" value={dueDate} onChange={(e) => setDueDate(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))} placeholder="Día de pago" className="w-full rounded-xl border border-border bg-background py-3 px-4" />
              </div>
            )}
          </div>
        </BaseModalForm>
      )}
    </div>
  )
}
