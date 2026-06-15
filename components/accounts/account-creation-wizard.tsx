"use client"

import { useMemo, useState } from "react"
import { ChevronLeft, Check } from "lucide-react"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { MoneyInput } from "@/components/ui/money-input"
import { BrandedAccountCard } from "@/components/accounts/branded-account-card"
import { BANK_LOGO_OPTIONS, getBankLogoByKey } from "@/lib/bank-branding"
import { createAccount, useAccounts } from "@/hooks/use-data"
import { parseAmount } from "@/lib/validation"
import { getCurrencySymbol } from "@/lib/data"
import { notify } from "@/lib/notifications"
import { EventBus } from "@/lib/event-bus"
import { useEntitlementBlocked } from "@/hooks/use-entitlement-blocked"
import { UpsellModal } from "@/components/entitlements/upsell-modal"
import { cn } from "@/lib/utils"
import type { Account } from "@/lib/types/database"
import { useEntitlements } from "@/hooks/use-entitlements"

const TYPE_OPTIONS = [
  { value: "cash" as const, label: "Efectivo", icon: "💵", description: "Dinero en mano" },
  { value: "debit" as const, label: "Débito", icon: "💳", description: "Cuenta de banco" },
  { value: "credit" as const, label: "Crédito", icon: "💳", description: "Tarjeta de crédito" },
]

const ICON_PRESETS = [
  { value: "banknote", label: "Efectivo" },
  { value: "building-2", label: "Banco" },
  { value: "credit-card", label: "Tarjeta" },
  { value: "landmark", label: "Institución" },
  { value: "piggy-bank", label: "Ahorro" },
  { value: "wallet", label: "Billetera" },
]

const COLOR_PRESETS = [
  { key: "banreservas", name: "Banreservas", primary: "#0b4a8a", secondary: "#38bdf8" },
  { key: "premium", name: "Premium", primary: "#07111f", secondary: "#1f2937" },
  { key: "emerald", name: "Emerald", primary: "#0f766e", secondary: "#14b8a6" },
  { key: "sky", name: "Sky", primary: "#0369a1", secondary: "#38bdf8" },
  { key: "purple", name: "Purple", primary: "#4338ca", secondary: "#8b5cf6" },
  { key: "orange", name: "Orange", primary: "#b45309", secondary: "#fb923c" },
  { key: "teal", name: "Teal", primary: "#0f766e", secondary: "#2dd4bf" },
  { key: "neutral", name: "Neutral", primary: "#334155", secondary: "#64748b" },
]

type WizardState = {
  step: 1 | 2 | 3
  bankKey: string | null
  bankName: string | null
  type: "cash" | "debit" | "credit" | null
  name: string
  accountNumber: string
  currency: "DOP" | "USD"
  initialBalance: string
  creditLimitDop: string
  creditLimitUsd: string
  creditUsed: string
  closingDate: string
  iconType: "icon" | "image"
  iconValue: string
  iconUrl: string | null
  primaryColor: string
  secondaryColor: string
  backgroundStyle: "gradient" | "solid" | "glass"
}

const initialState: WizardState = {
  step: 1,
  bankKey: null,
  bankName: null,
  type: null,
  name: "",
  accountNumber: "",
  currency: "DOP",
  initialBalance: "",
  creditLimitDop: "",
  creditLimitUsd: "",
  creditUsed: "",
  closingDate: "",
  iconType: "icon",
  iconValue: "building-2",
  iconUrl: null,
  primaryColor: "#0b4a8a",
  secondaryColor: "#38bdf8",
  backgroundStyle: "gradient",
}

type AccountCreationWizardProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AccountCreationWizard({ open, onOpenChange }: AccountCreationWizardProps) {
  const { data: accounts = [] } = useAccounts()
  const { canCreateAccount, limits } = useEntitlements()
  const { blocked, isUpsellOpen, handleEntitlementBlocked, closeUpsell } = useEntitlementBlocked()
  const [state, setState] = useState<WizardState>(initialState)
  const [isSaving, setIsSaving] = useState(false)

  const typeLabel = state.type ? TYPE_OPTIONS.find((t) => t.value === state.type)?.label || "" : ""

  const previewAccount = useMemo(() => ({
    id: "preview",
    user_id: "preview",
    name: state.name || "Cuenta personalizada",
    type: state.type || "cash",
    currency: state.currency,
    balance: parseAmount(state.initialBalance),
    credit_limit: state.type === "credit" ? parseAmount(state.creditLimitDop || "0") : null,
    credit_limit_dop: state.type === "credit" ? parseAmount(state.creditLimitDop || "0") : null,
    credit_limit_usd: state.type === "credit" ? parseAmount(state.creditLimitUsd || "0") : null,
    current_debt: state.type === "credit" && state.currency === "DOP" ? parseAmount(state.creditUsed || "0") : 0,
    current_debt_dop: state.type === "credit" && state.currency === "DOP" ? parseAmount(state.creditUsed || "0") : 0,
    current_debt_usd: state.type === "credit" && state.currency === "USD" ? parseAmount(state.creditUsed || "0") : 0,
    statement_balance: null,
    pending_amount: null,
    paid_amount: null,
    cycle_start_date: null,
    cycle_end_date: null,
    closing_date: state.type === "credit" && state.closingDate ? parseInt(state.closingDate) : null,
    due_date: null,
    minimum_payment: null,
    color: "",
    icon: "",
    icon_url: state.iconUrl,
    icon_type: state.iconType,
    icon_value: state.iconValue,
    account_number: state.accountNumber || null,
    primary_color: state.primaryColor,
    secondary_color: state.secondaryColor,
    background_style: state.backgroundStyle,
    bank_name: state.bankName,
    bank_logo_key: state.bankKey === "other" ? null : state.bankKey,
    bank_logo_url: state.bankKey && state.bankKey !== "other" ? getBankLogoByKey(state.bankKey)?.logoUrl || null : null,
  }), [state])

  const reset = () => {
    setState(initialState)
    setIsSaving(false)
  }

  const handleClose = () => {
    onOpenChange(false)
    reset()
  }

  const selectBank = (key: string) => {
    const bank = getBankLogoByKey(key)
    if (!bank) {
      setState((prev) => ({
        ...prev,
        bankKey: "other",
        bankName: "Otro banco",
        iconType: "icon",
        iconValue: "building-2",
        iconUrl: null,
        primaryColor: "#0b4a8a",
        secondaryColor: "#38bdf8",
        name: prev.type ? `${TYPE_OPTIONS.find((t) => t.value === prev.type)?.label || ""}` : "",
      }))
      return
    }
    setState((prev) => ({
      ...prev,
      bankKey: key,
      bankName: bank.name,
      iconType: "image",
      iconValue: key,
      iconUrl: bank.logoUrl,
      primaryColor: bank.primaryColor,
      secondaryColor: bank.secondaryColor,
      name: prev.type ? `${bank.name} ${TYPE_OPTIONS.find((t) => t.value === prev.type)?.label || ""}` : "",
    }))
  }

  const selectEfectivoQuick = () => {
    setState((prev) => ({
      ...prev,
      step: 3,
      type: "cash",
      bankKey: null,
      bankName: null,
      name: "Efectivo",
      iconType: "icon",
      iconValue: "banknote",
      iconUrl: null,
      primaryColor: "#0f766e",
      secondaryColor: "#14b8a6",
    }))
  }

  const selectType = (value: "cash" | "debit" | "credit") => {
    const label = TYPE_OPTIONS.find((t) => t.value === value)?.label || ""
    setState((prev) => ({
      ...prev,
      type: value,
      name: prev.bankName && prev.bankName !== "Otro banco" ? `${prev.bankName} ${label}` : label,
    }))
  }

  const canGoNext = () => {
    if (state.step === 1) return state.bankKey !== null
    if (state.step === 2) return state.type !== null
    return true
  }

  const handleNext = () => {
    if (state.step === 1 && state.bankKey) {
      setState((prev) => ({ ...prev, step: 2 }))
    } else if (state.step === 2 && state.type) {
      setState((prev) => ({ ...prev, step: 3 }))
    }
  }

  const handleBack = () => {
    if (state.step > 1) {
      setState((prev) => ({ ...prev, step: (prev.step - 1) as 1 | 2 | 3 }))
    }
  }

  const handleSave = async () => {
    if (!canCreateAccount) {
      handleEntitlementBlocked({
        error: "max_accounts",
        message: "Límite de cuentas alcanzado",
        details: {
          currentUsage: accounts.length,
          limit: typeof limits.max_accounts === "number" ? limits.max_accounts : undefined,
          requiredPlan: "pro",
        },
      })
      return
    }
    if (!state.type || !state.name.trim()) return
    setIsSaving(true)
    try {
      const creditUsedAmount = parseAmount(state.creditUsed || "0")
      const initialBalanceAmount = state.type === "credit" ? 0 : parseAmount(state.initialBalance || "0")
      await createAccount({
        name: state.name.trim(),
        type: state.type,
        currency: state.currency,
        balance: initialBalanceAmount,
        credit_limit: state.type === "credit" ? parseAmount(state.creditLimitDop || state.initialBalance || "0") : null,
        current_debt: state.type === "credit" && state.currency === "DOP" ? creditUsedAmount : 0,
        credit_limit_dop: state.type === "credit" ? parseAmount(state.creditLimitDop || "0") : null,
        credit_limit_usd: state.type === "credit" ? parseAmount(state.creditLimitUsd || "0") : null,
        current_debt_dop: state.type === "credit" && state.currency === "DOP" ? creditUsedAmount : 0,
        current_debt_usd: state.type === "credit" && state.currency === "USD" ? creditUsedAmount : 0,
        statement_balance_dop: state.type === "credit" && state.currency === "DOP" ? creditUsedAmount : 0,
        statement_balance_usd: state.type === "credit" && state.currency === "USD" ? creditUsedAmount : 0,
        paid_statement_amount_dop: 0,
        paid_statement_amount_usd: 0,
        pending_transit_dop: 0,
        pending_transit_usd: 0,
        closing_day: state.type === "credit" && state.closingDate ? parseInt(state.closingDate) : null,
        due_days_after_cutoff: state.type === "credit" ? 20 : null,
        minimum_payment_percentage: state.type === "credit" ? 0.0278 : null,
        minimum_payment: null,
        color: "",
        icon: "",
        is_active: true,
        closing_date: state.type === "credit" && state.closingDate ? parseInt(state.closingDate) : null,
        due_date: null,
        icon_url: state.iconUrl,
        icon_type: state.iconType,
        icon_value: state.iconValue,
        account_number: state.accountNumber || null,
        primary_color: state.primaryColor,
        secondary_color: state.secondaryColor,
        background_style: state.backgroundStyle,
        bank_name: state.bankKey && state.bankKey !== "other" ? getBankLogoByKey(state.bankKey)?.name || null : null,
        bank_logo_key: state.bankKey && state.bankKey !== "other" ? state.bankKey : null,
        bank_logo_url: state.bankKey && state.bankKey !== "other" ? getBankLogoByKey(state.bankKey)?.logoUrl || null : null,
      })
      notify({ title: "Cuenta creada", message: "Tu cuenta fue creada correctamente." })
      EventBus.emit({ type: "account_created", payload: { name: state.name } })
      handleClose()
    } catch (error) {
      if (handleEntitlementBlocked(error)) return
      notify({ title: "No se pudo crear la cuenta", message: "Intenta de nuevo en unos segundos." })
    } finally {
      setIsSaving(false)
    }
  }

  const banks = BANK_LOGO_OPTIONS.filter((b) => b.key !== "none")

  const stepTitles = ["Selecciona tu banco", "Tipo de cuenta", "Detalles de la cuenta"]
  const stepLabels = ["Banco", "Tipo", "Detalles"]

  return (
    <>
      <Drawer open={open} onOpenChange={(open) => { if (!open) handleClose() }} direction="bottom">
        <DrawerContent className="mx-auto flex max-h-[90dvh] max-w-md flex-col rounded-t-[2rem] border-border bg-card p-0 shadow-2xl ring-1 ring-border">
          <DrawerHeader className="shrink-0 border-b border-border px-5 pb-4 pt-5">
            <div className="flex items-center gap-3">
              {state.step > 1 && (
                <button type="button" onClick={handleBack} className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-foreground" aria-label="Atrás">
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
              <div className="flex-1">
                <DrawerTitle className="text-left text-base">{stepTitles[state.step - 1]}</DrawerTitle>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              {([1, 2, 3] as const).map((s) => (
                <div key={s} className={cn(
                  "flex items-center gap-1.5",
                  s > 1 && "ml-1.5"
                )}>
                  {s > 1 && <div className="h-px w-4 bg-border" />}
                  <div className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                    s === state.step ? "bg-primary text-primary-foreground" : s < state.step ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                  )}>
                    {s < state.step ? <Check className="h-3 w-3" /> : s}
                  </div>
                  <span className={cn("text-[11px] font-medium", s === state.step ? "text-foreground" : "text-muted-foreground")}>{stepLabels[s - 1]}</span>
                </div>
              ))}
            </div>
          </DrawerHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-4">
            {state.step === 1 && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={selectEfectivoQuick}
                  className="relative flex flex-col items-center gap-2.5 rounded-2xl p-4 text-white transition-all active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg, #0f766e, #14b8a6)" }}
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/20 text-2xl">
                    💵
                  </div>
                  <span className="text-center text-[13px] font-bold leading-tight drop-shadow-sm">Efectivo</span>
                </button>
                {banks.map((bank) => {
                  const selected = state.bankKey === bank.key
                  return (
                    <button
                      key={bank.key}
                      type="button"
                      onClick={() => selectBank(bank.key)}
                      className={cn(
                        "group relative flex flex-col items-center gap-2.5 rounded-2xl p-4 text-white transition-all active:scale-[0.98]",
                        selected && "ring-2 ring-foreground ring-offset-2 ring-offset-card"
                      )}
                      style={{ background: `linear-gradient(135deg, ${bank.primaryColor}, ${bank.secondaryColor})` }}
                    >
                      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/20">
                        <img src={bank.logoUrl} alt={bank.name} className="h-8 w-auto object-contain" />
                      </div>
                      <span className="text-center text-[13px] font-bold leading-tight drop-shadow-sm">{bank.name}</span>
                      {selected && (
                        <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-foreground shadow-lg">
                          <Check className="h-3.5 w-3.5" />
                        </div>
                      )}
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={() => selectBank("none")}
                  className={cn(
                    "relative flex flex-col items-center gap-2.5 rounded-2xl border-2 border-dashed p-4 transition-all active:scale-[0.98]",
                    state.bankKey === "other" ? "border-foreground bg-foreground/5" : "border-border"
                  )}
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <span className="text-2xl">🏦</span>
                  </div>
                  <span className="text-center text-[13px] font-bold leading-tight text-foreground">Otro banco</span>
                  {state.bankKey === "other" && (
                    <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background shadow-lg">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                  )}
                </button>
              </div>
            )}

            {state.step === 2 && (
              <div className="space-y-3">
                {TYPE_OPTIONS.filter((o) => !state.bankKey || o.value !== "cash").map((option) => {
                  const selected = state.type === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => selectType(option.value)}
                      className={cn(
                        "flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all active:scale-[0.99]",
                        selected ? "border-foreground bg-foreground/5" : "border-border"
                      )}
                    >
                      <div className={cn(
                        "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl",
                        selected ? "bg-primary text-primary-foreground" : "bg-muted"
                      )}>
                        {option.icon}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-foreground">{option.label}</p>
                        <p className="text-xs text-muted-foreground">{option.description}</p>
                      </div>
                      {selected && <Check className="h-5 w-5 text-primary shrink-0" />}
                    </button>
                  )
                })}
              </div>
            )}

            {state.step === 3 && (
              <div className="space-y-5">
                <input
                  value={state.name}
                  onChange={(e) => setState((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Nombre de la cuenta"
                  className="h-14 w-full rounded-2xl border border-border bg-background px-4 text-foreground"
                />

                {state.type !== "cash" && (
                  <input
                    value={state.accountNumber}
                    onChange={(e) => setState((prev) => ({ ...prev, accountNumber: e.target.value.replace(/[^0-9]/g, "").slice(0, 24) }))}
                    placeholder="Número de cuenta"
                    className="h-14 w-full rounded-2xl border border-border bg-background px-4 text-foreground"
                  />
                )}

                <div className="grid grid-cols-2 gap-2">
                  {(["DOP", "USD"] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setState((prev) => ({ ...prev, currency: c, creditUsed: "" }))}
                      className={cn("rounded-xl px-3 py-2.5 text-xs font-semibold", state.currency === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}
                    >
                      {getCurrencySymbol(c)}
                    </button>
                  ))}
                </div>

                {state.type !== "credit" && (
                  <MoneyInput value={state.initialBalance} onValueChange={(v) => setState((prev) => ({ ...prev, initialBalance: v }))} placeholder="Balance" className="w-full rounded-xl bg-muted p-3" />
                )}

                {state.type === "credit" && (
                  <div className="space-y-3 rounded-2xl bg-muted/50 p-4">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {state.currency !== "USD" && <MoneyInput value={state.creditLimitDop} onValueChange={(v) => setState((prev) => ({ ...prev, creditLimitDop: v }))} placeholder="Límite de crédito" className="w-full rounded-xl border border-border bg-background py-3 px-4" />}
                      {state.currency !== "DOP" && <MoneyInput value={state.creditLimitUsd} onValueChange={(v) => setState((prev) => ({ ...prev, creditLimitUsd: v }))} placeholder="Límite de crédito USD" className="w-full rounded-xl border border-border bg-background py-3 px-4" />}
                    </div>
                    <MoneyInput value={state.creditUsed} onValueChange={(v) => setState((prev) => ({ ...prev, creditUsed: v }))} placeholder="Crédito utilizado" className="w-full rounded-xl border border-border bg-background py-3 px-4" />
                    <input type="text" inputMode="numeric" value={state.closingDate} onChange={(e) => setState((prev) => ({ ...prev, closingDate: e.target.value.replace(/[^0-9]/g, "").slice(0, 2) }))} placeholder="Día de corte" className="w-full rounded-xl border border-border bg-background py-3 px-4 text-foreground" />
                    <p className="text-xs text-muted-foreground">Fecha de pago: automática (corte + 20 días)</p>
                  </div>
                )}

                <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
                  <p className="text-sm font-semibold text-foreground">Personalización visual</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(["icon", "image"] as const).map((value) => (
                      <button key={value} type="button" onClick={() => setState((prev) => ({ ...prev, iconType: value, iconValue: value === "icon" ? "building-2" : prev.bankKey && prev.bankKey !== "other" ? prev.bankKey : "", iconUrl: value === "icon" ? null : getBankLogoByKey(prev.bankKey)?.logoUrl || null }))} className={cn("rounded-xl px-3 py-2 text-xs font-medium transition-colors", state.iconType === value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                        {value === "icon" ? "Ícono" : "Logo/Banco"}
                      </button>
                    ))}
                  </div>
                  {state.iconType === "image" ? (
                    <div className="grid grid-cols-4 gap-2">
                      {banks.map((bank) => (
                        <button key={bank.key} type="button" onClick={() => setState((prev) => ({ ...prev, iconValue: bank.key, iconUrl: bank.logoUrl, primaryColor: bank.primaryColor, secondaryColor: bank.secondaryColor, bankKey: bank.key, bankName: bank.name }))} className={cn("flex flex-col items-center gap-1 rounded-xl p-2", state.iconValue === bank.key ? "bg-primary text-primary-foreground" : "bg-muted")}>
                          <img src={bank.logoUrl} alt={bank.name} className="h-6 w-auto" />
                          <span className="text-[10px] text-center leading-tight">{bank.name}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {ICON_PRESETS.map((preset) => (
                        <button key={preset.value} type="button" onClick={() => setState((prev) => ({ ...prev, iconValue: preset.value }))} className={cn("flex flex-col items-center gap-1 rounded-xl p-2", state.iconValue === preset.value ? "bg-primary text-primary-foreground" : "bg-muted")}>
                          <span className="text-lg">{preset.label === "Efectivo" ? "💵" : preset.label === "Banco" ? "🏛️" : preset.label === "Tarjeta" ? "💳" : preset.label === "Institución" ? "🏦" : preset.label === "Ahorro" ? "🐷" : "👛"}</span>
                          <span className="text-[10px]">{preset.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {COLOR_PRESETS.map((preset) => (
                      <button key={preset.key} type="button" onClick={() => setState((prev) => ({ ...prev, primaryColor: preset.primary, secondaryColor: preset.secondary }))} className={cn("h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-background", state.primaryColor === preset.primary && state.secondaryColor === preset.secondary ? "ring-primary" : "ring-transparent")} title={preset.name}>
                        <span className="block h-full w-full rounded-full" style={{ background: `linear-gradient(135deg, ${preset.primary}, ${preset.secondary})` }} />
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(["gradient", "solid", "glass"] as const).map((style) => (
                      <button key={style} type="button" onClick={() => setState((prev) => ({ ...prev, backgroundStyle: style }))} className={cn("rounded-xl px-3 py-2 text-xs", state.backgroundStyle === style ? "bg-primary text-primary-foreground" : "bg-muted")}>
                        {style === "gradient" ? "Degradado" : style === "solid" ? "Sólido" : "Suave"}
                      </button>
                    ))}
                  </div>
                  <BrandedAccountCard account={previewAccount as any} compact />
                </div>
              </div>
            )}
          </div>

          <footer className="shrink-0 border-t border-border bg-card px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {state.step < 3 ? (
              <button type="button" disabled={!canGoNext()} onClick={handleNext} className="h-14 w-full rounded-full bg-primary text-base font-bold text-primary-foreground disabled:bg-muted disabled:text-muted-foreground">
                {state.step === 1 ? "Siguiente" : "Continuar"}
              </button>
            ) : (
              <button type="button" disabled={!state.name.trim() || isSaving} onClick={handleSave} className="h-14 w-full rounded-full bg-primary text-base font-bold text-primary-foreground disabled:bg-muted disabled:text-muted-foreground">
                {isSaving ? "Creando cuenta..." : "Guardar cuenta"}
              </button>
            )}
          </footer>
        </DrawerContent>
      </Drawer>
      <UpsellModal open={isUpsellOpen} onClose={closeUpsell} blocked={blocked} />
    </>
  )
}
