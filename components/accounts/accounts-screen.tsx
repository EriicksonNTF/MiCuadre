"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowRightLeft, Banknote, Building2, ChevronDown, CreditCard, Landmark, Pencil, PiggyBank, Plus, Trash2, Wallet } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { PaymentSlider } from "@/components/payment-slider"
import { BaseModalForm } from "@/components/ui/base-modal-form"
import { MoneyInput } from "@/components/ui/money-input"
import { AccountCarouselSelector } from "@/components/ui/account-carousel-selector"
import { BrandedAccountCard } from "@/components/accounts/branded-account-card"
import { notify } from "@/lib/notifications"
import { EventBus } from "@/lib/event-bus"
import { createAccount, createTransfer, deleteAccount, getAccountDeletionImpact, reorderAccounts, useAccounts } from "@/hooks/use-data"
import { formatCurrency } from "@/lib/data"
import { parseAmount, transferSchema } from "@/lib/validation"
import { useRouter } from "next/navigation"
import type { Account } from "@/lib/types/database"
import { BANK_LOGO_OPTIONS, getBankLogoByKey } from "@/lib/bank-branding"
import { useEntitlements } from "@/hooks/use-entitlements"
import { UsageLimitBanner } from "@/components/entitlements/usage-limit-banner"
import { useEntitlementBlocked } from "@/hooks/use-entitlement-blocked"
import { UpsellModal } from "@/components/entitlements/upsell-modal"
import { createBlockedResponse } from "@/lib/entitlements/entitlement-copy"
import { HoldToConfirmButton } from "@/components/ui/hold-to-confirm-button"

const ICON_PRESETS = [
  { value: "banknote", label: "Efectivo", icon: Banknote },
  { value: "building-2", label: "Banco", icon: Building2 },
  { value: "credit-card", label: "Tarjeta", icon: CreditCard },
  { value: "landmark", label: "Institución", icon: Landmark },
  { value: "piggy-bank", label: "Ahorro", icon: PiggyBank },
  { value: "wallet", label: "Billetera", icon: Wallet },
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

export function AccountsScreen() {
  const router = useRouter()
  const { data: accounts = [], isLoading } = useAccounts()
  const { canCreateAccount, limits, isFree } = useEntitlements()
  const { blocked, isUpsellOpen, handleEntitlementBlocked, closeUpsell } = useEntitlementBlocked()
  const [showTransfer, setShowTransfer] = useState(false)
  const [showCreateAccount, setShowCreateAccount] = useState(false)
  const [orderedAccounts, setOrderedAccounts] = useState<Account[] | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null)
  const [swipeOffset, setSwipeOffset] = useState<{ id: string; offset: number } | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleteImpact, setDeleteImpact] = useState<{ count: number; hasMovements: boolean } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const pointerRef = useRef<{ id: string; startX: number; startY: number; moved: boolean; swiping: boolean } | null>(null)
  const suppressClickRef = useRef(false)
  const dragIdRef = useRef<string | null>(null)
  const longPressTimerRef = useRef<number | null>(null)
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const [accountName, setAccountName] = useState("")
  const [accountType, setAccountType] = useState<"cash" | "debit" | "credit">("cash")
  const [accountCurrency, setAccountCurrency] = useState<"DOP" | "USD">("DOP")
  const [initialBalance, setInitialBalance] = useState("")
  const [creditLimitDop, setCreditLimitDop] = useState("")
  const [creditLimitUsd, setCreditLimitUsd] = useState("")
  const [creditUsed, setCreditUsed] = useState("")
  const [closingDate, setClosingDate] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  const [brandingIconType, setBrandingIconType] = useState<"icon" | "image">("icon")
  const [brandingIconValue, setBrandingIconValue] = useState("building-2")
  const [brandingIconUrl, setBrandingIconUrl] = useState<string | null>(null)
  const [accountNumber, setAccountNumber] = useState("")
  const [brandingPrimaryColor, setBrandingPrimaryColor] = useState("#0b4a8a")
  const [brandingSecondaryColor, setBrandingSecondaryColor] = useState("#38bdf8")
  const [brandingBackgroundStyle, setBrandingBackgroundStyle] = useState<"gradient" | "solid" | "glass">("gradient")
  const [brandingBankKey, setBrandingBankKey] = useState("none")

  const [fromAccount, setFromAccount] = useState("")
  const [toAccount, setToAccount] = useState("")
  const [transferAmount, setTransferAmount] = useState("")
  const [applyCommission, setApplyCommission] = useState(false)
  const [isTransferring, setIsTransferring] = useState(false)

  const resetCreateAccountForm = () => {
    setAccountName("")
    setAccountType("cash")
    setAccountCurrency("DOP")
    setInitialBalance("")
    setCreditLimitDop("")
    setCreditLimitUsd("")
    setCreditUsed("")
    setClosingDate("")
    setDueDate("")
    setBrandingIconType("icon")
    setBrandingIconValue("building-2")
    setBrandingIconUrl(null)
    setAccountNumber("")
    setBrandingPrimaryColor("#0b4a8a")
    setBrandingSecondaryColor("#38bdf8")
    setBrandingBackgroundStyle("gradient")
    setBrandingBankKey("none")
  }

  const resetTransferForm = () => {
    setFromAccount("")
    setToAccount("")
    setTransferAmount("")
    setApplyCommission(false)
  }

  const parsedTransferAmount = parseFloat(transferAmount.replace(/[^0-9.]/g, "")) || 0
  const transferCommissionAmount = applyCommission ? Math.round(parsedTransferAmount * 0.15) / 100 : 0
  const totalTransferAmount = parsedTransferAmount + transferCommissionAmount
  const selectedFromAccount = accounts.find((a) => a.id === fromAccount)
  const exceedsFromBalance = Boolean(selectedFromAccount && totalTransferAmount > Number(selectedFromAccount.balance || 0))

// Initialize orderedAccounts when accounts load, sync when accounts change
  useEffect(() => {
    if (accounts.length === 0) return

    if (orderedAccounts === null) {
      setOrderedAccounts(accounts)
      return
    }

    // Check if accounts have changed (new or deleted)
    const orderedIds = new Set(orderedAccounts.map(a => a.id))
    const currentIds = new Set(accounts.map(a => a.id))
    const hasNewAccount = accounts.some(a => !orderedIds.has(a.id))
    const hasDeletedAccount = orderedAccounts.some(a => !currentIds.has(a.id))

    if (hasNewAccount || hasDeletedAccount) {
      setOrderedAccounts(prev => {
        if (prev === null) return accounts
        const prevIds = new Set(prev.map(a => a.id))
        // Preserve user order for existing accounts, append new ones
        const merged = accounts.filter(a => prevIds.has(a.id))
        const newAccounts = accounts.filter(a => !prevIds.has(a.id))
        return [...merged, ...newAccounts]
      })
    }
  }, [accounts])

  // Use orderedAccounts if available, otherwise fall back to accounts
  const displayAccounts = orderedAccounts ?? accounts

  useEffect(() => {
    const onOutside = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest("[data-account-row='true']")) return
      setOpenSwipeId(null)
      setSwipeOffset(null)
    }

    document.addEventListener("pointerdown", onOutside)
    return () => document.removeEventListener("pointerdown", onOutside)
  }, [])

  const previewAccount = useMemo(() => ({
    id: "preview",
    user_id: "preview",
    name: accountName || "Cuenta personalizada",
    type: accountType,
    currency: accountCurrency,
    balance: parseAmount(initialBalance),
    credit_limit: accountType === "credit" ? parseAmount(creditLimitDop || "0") : null,
    credit_limit_dop: accountType === "credit" ? parseAmount(creditLimitDop || "0") : null,
    credit_limit_usd: accountType === "credit" ? parseAmount(creditLimitUsd || "0") : null,
    current_debt: accountType === "credit" && accountCurrency === "DOP" ? parseAmount(creditUsed || "0") : 0,
    current_debt_dop: accountType === "credit" && accountCurrency === "DOP" ? parseAmount(creditUsed || "0") : 0,
    current_debt_usd: accountType === "credit" && accountCurrency === "USD" ? parseAmount(creditUsed || "0") : 0,
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
    account_number: accountNumber || null,
    primary_color: brandingPrimaryColor,
    secondary_color: brandingSecondaryColor,
    background_style: brandingBackgroundStyle,
    is_active: true,
    sort_order: null,
    is_favorite: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }), [accountName, accountType, accountCurrency, initialBalance, creditLimitDop, creditLimitUsd, creditUsed, closingDate, dueDate, brandingIconUrl, brandingIconType, brandingIconValue, brandingPrimaryColor, brandingSecondaryColor, brandingBackgroundStyle, accountNumber])

  const triggerHaptic = () => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(12)
    }
  }

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  const startLongPress = (id: string) => {
    clearLongPressTimer()
    longPressTimerRef.current = window.setTimeout(() => {
      dragIdRef.current = id
      setDraggingId(id)
      setOpenSwipeId(null)
      setSwipeOffset(null)
      triggerHaptic()
    }, 500)
  }

const reorderOnDrag = (draggedId: string, clientY: number) => {
    const current = orderedAccounts ?? accounts
    const next = [...current]
    const fromIndex = next.findIndex((a) => a.id === draggedId)
    if (fromIndex < 0) return

    const hovered = next.find((account) => {
      const row = rowRefs.current[account.id]
      if (!row) return false
      const rect = row.getBoundingClientRect()
      return clientY >= rect.top && clientY <= rect.bottom
    })

    if (!hovered || hovered.id === draggedId) return
    const toIndex = next.findIndex((a) => a.id === hovered.id)
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    setOrderedAccounts(next)
  }

  const finishDrag = async () => {
    const draggedId = dragIdRef.current
    dragIdRef.current = null
    setDraggingId(null)
    clearLongPressTimer()
if (!draggedId) return
    await reorderAccounts(displayAccounts.map((account) => account.id))
  }

  const handleDeleteFromList = async () => {
    if (!confirmDeleteId) return
    setIsDeleting(true)
    try {
      await deleteAccount(confirmDeleteId)
      notify({ title: "Cuenta eliminada", message: "La cuenta fue eliminada correctamente." })
      setConfirmDeleteId(null)
      setDeleteImpact(null)
      setOpenSwipeId(null)
    } catch (error) {
      notify({
        title: "No se pudo eliminar",
        message: error instanceof Error ? error.message : "Intenta de nuevo.",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const openDeleteConfirm = async (accountId: string) => {
    setConfirmDeleteId(accountId)
    setDeleteImpact(null)
    try {
      setDeleteImpact(await getAccountDeletionImpact(accountId))
    } catch {
      setDeleteImpact({ count: 1, hasMovements: true })
    }
  }

  const handleBankLogoChange = (key: string) => {
    const selected = getBankLogoByKey(key)
    setBrandingBankKey(key)
    if (!selected || key === "none") {
      setBrandingIconUrl(null)
      setBrandingIconType("icon")
      setBrandingIconValue("building-2")
      return
    }
    setBrandingIconType("image")
    setBrandingIconValue(key)
    setBrandingIconUrl(selected.logoUrl)
  }

  const handleCreateAccount = async () => {
    const creditUsedAmount = parseAmount(creditUsed || "0")
    const initialBalanceAmount = accountType === "credit" ? 0 : parseAmount(initialBalance || "0")
    if (!accountName) return
    if (!canCreateAccount) {
      handleEntitlementBlocked({
        ...createBlockedResponse("max_accounts", {
          currentUsage: accounts.length,
          limit: typeof limits.max_accounts === "number" ? limits.max_accounts : undefined,
          requiredPlan: "pro",
        }),
      })
      return
    }
    setIsCreating(true)
    try {
      await createAccount({
        name: accountName,
        type: accountType,
        currency: accountCurrency,
        balance: initialBalanceAmount,
        credit_limit: accountType === "credit" ? parseAmount(creditLimitDop || initialBalance || "0") : null,
        current_debt: accountType === "credit" && accountCurrency === "DOP" ? creditUsedAmount : 0,
        credit_limit_dop: accountType === "credit" ? parseAmount(creditLimitDop || "0") : null,
        credit_limit_usd: accountType === "credit" ? parseAmount(creditLimitUsd || "0") : null,
        current_debt_dop: accountType === "credit" && accountCurrency === "DOP" ? creditUsedAmount : 0,
        current_debt_usd: accountType === "credit" && accountCurrency === "USD" ? creditUsedAmount : 0,
        statement_balance_dop: accountType === "credit" && accountCurrency === "DOP" ? creditUsedAmount : 0,
        statement_balance_usd: accountType === "credit" && accountCurrency === "USD" ? creditUsedAmount : 0,
        paid_statement_amount_dop: 0,
        paid_statement_amount_usd: 0,
        pending_transit_dop: 0,
        pending_transit_usd: 0,
        closing_day: accountType === "credit" && closingDate ? parseInt(closingDate) : null,
        due_days_after_cutoff: accountType === "credit" ? 20 : null,
        minimum_payment_percentage: accountType === "credit" ? 0.0278 : null,
        minimum_payment: null,
        color: "",
        icon: "",
        is_active: true,
        closing_date: accountType === "credit" && closingDate ? parseInt(closingDate) : null,
        due_date: null,
        icon_url: brandingIconUrl,
        icon_type: brandingIconType,
        icon_value: brandingIconValue,
        account_number: accountNumber || null,
        primary_color: brandingPrimaryColor,
        secondary_color: brandingSecondaryColor,
        background_style: brandingBackgroundStyle,
        bank_name: brandingBankKey !== "none" ? getBankLogoByKey(brandingBankKey)?.name || null : null,
        bank_logo_key: brandingBankKey !== "none" ? brandingBankKey : null,
        bank_logo_url: brandingBankKey !== "none" ? getBankLogoByKey(brandingBankKey)?.logoUrl || null : null,
      })
      notify({ title: "Cuenta creada", message: "Tu cuenta fue creada correctamente." })
      EventBus.emit({ type: "account_created", payload: { name: accountName } })
      resetCreateAccountForm()
      setShowCreateAccount(false)
      router.push("/accounts")
    } catch (error) {
      if (handleEntitlementBlocked(error)) return
      notify({
        title: "No se pudo crear la cuenta",
        message: "Intenta de nuevo en unos segundos.",
      })
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
      resetTransferForm()
      setShowTransfer(false)
    } finally {
      setIsTransferring(false)
    }
  }

  return (
    <div className="app-scroll min-h-[100dvh] overflow-y-auto bg-background pb-nav-safe">
      <header className="mx-auto max-w-md px-5 pb-4 pt-[calc(1.5rem+env(safe-area-inset-top))]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Cuentas</h1>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">Administra tu dinero, tarjetas y movimientos.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => setShowTransfer(true)}
              aria-label="Mover dinero"
              className="group flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-95"
            >
              <ArrowRightLeft className="h-4 w-4 text-foreground transition group-hover:text-accent" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (!canCreateAccount) {
                  handleEntitlementBlocked({
                    ...createBlockedResponse("max_accounts", {
                      currentUsage: accounts.length,
                      limit: typeof limits.max_accounts === "number" ? limits.max_accounts : undefined,
                      requiredPlan: "pro",
                    }),
                  })
                  return
                }
                setShowCreateAccount(true)
              }}
              aria-label="Crear cuenta"
              className="group flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-95"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>
        {isFree && !canCreateAccount && (
          <div className="mt-4">
            <UsageLimitBanner
              feature="max_accounts"
              currentUsage={accounts.length}
              limit={typeof limits.max_accounts === "number" ? limits.max_accounts : undefined}
            />
          </div>
        )}
      </header>

{isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-3xl bg-card" />
          ))}
        </div>
      ) : displayAccounts.length === 0 ? (
        <div className="mx-auto max-w-md rounded-[28px] border-2 border-dashed border-border bg-card p-6 text-center">
          <p className="text-sm font-semibold text-foreground">No tienes cuentas todavía</p>
          <p className="mt-1 text-xs text-muted-foreground">Agrega tu primera cuenta y empieza a rastrear tu dinero.</p>
        </div>
      ) : (
        <>
          <div className="mx-auto max-w-md px-5 pt-3">
            <p className="mb-3 text-xs text-muted-foreground">Mantén presionado para ordenar</p>
          </div>

          <div className="mx-auto max-w-md space-y-4 px-5 pt-1">
        {displayAccounts.map((account) => {
          const isOpen = openSwipeId === account.id
          const isDragging = draggingId === account.id
          const currentOffset = swipeOffset?.id === account.id ? swipeOffset.offset : isOpen ? -112 : 0

          return (
            <div
              key={account.id}
              data-account-row="true"
              ref={(node) => {
                rowRefs.current[account.id] = node
              }}
              className="relative overflow-hidden rounded-3xl"
            >
              <div className="absolute inset-y-0 right-0 z-0 flex w-28 items-center justify-end gap-1 rounded-3xl pr-2">
                <button
                  onClick={() => router.push(`/accounts/${account.id}?edit=1`)}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted text-foreground"
                  aria-label="Editar cuenta"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => openDeleteConfirm(account.id)}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-500 text-white"
                  aria-label="Eliminar cuenta"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div
                className={cn(
                  "relative z-10 transition-transform duration-200",
                  isDragging && "scale-[1.02] shadow-xl"
                )}
                style={{ transform: `translateX(${currentOffset}px)` }}
                onPointerDown={(event) => {
                  const target = event.target as HTMLElement
                  if (target.closest("button")) return
                  suppressClickRef.current = false
                  pointerRef.current = {
                    id: account.id,
                    startX: event.clientX,
                    startY: event.clientY,
                    moved: false,
                    swiping: false,
                  }
                  startLongPress(account.id)
                }}
                onPointerMove={(event) => {
                  const pointer = pointerRef.current
                  if (!pointer || pointer.id !== account.id) return

                  const dx = event.clientX - pointer.startX
                  const dy = event.clientY - pointer.startY

                  if (dragIdRef.current === account.id) {
                    suppressClickRef.current = true
                    event.preventDefault()
                    reorderOnDrag(account.id, event.clientY)
                    return
                  }

                  if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
                    pointer.moved = true
                    clearLongPressTimer()
                  }

                  if (Math.abs(dx) > Math.abs(dy) && (dx < 0 || isOpen)) {
                    pointer.swiping = true
                    suppressClickRef.current = true
                    setOpenSwipeId(account.id)
                    const base = isOpen ? -112 : 0
                    setSwipeOffset({ id: account.id, offset: Math.min(0, Math.max(-112, base + dx)) })
                  }
                }}
                onPointerUp={async () => {
                  clearLongPressTimer()

                  if (dragIdRef.current === account.id) {
                    await finishDrag()
                    pointerRef.current = null
                    return
                  }

                  const pointer = pointerRef.current
                  if (!pointer || pointer.id !== account.id) return

                  if (pointer.swiping) {
                    const finalOffset = swipeOffset?.id === account.id ? swipeOffset.offset : 0
                    if (finalOffset < -56) {
                      setOpenSwipeId(account.id)
                      setSwipeOffset({ id: account.id, offset: -112 })
                    } else {
                      setOpenSwipeId(null)
                      setSwipeOffset(null)
                    }
                  }

                  pointerRef.current = null
                }}
                onPointerCancel={() => {
                  clearLongPressTimer()
                  pointerRef.current = null
                  if (dragIdRef.current === account.id) {
                    dragIdRef.current = null
                    setDraggingId(null)
                  }
                }}
              >
                <Link
                  href={`/accounts/${account.id}`}
                  onClick={(event) => {
                    if (suppressClickRef.current || dragIdRef.current === account.id) {
                      event.preventDefault()
                      suppressClickRef.current = false
                    }
                  }}
                  className="group block transition-transform active:scale-[0.98]"
                >
                  <BrandedAccountCard account={account} />
                </Link>
              </div>
            </div>
          )
})}
      </div>
        </>
      )}

      {showTransfer && (
        <BaseModalForm
          title="Transferir dinero"
          onClose={() => {
            setShowTransfer(false)
            resetTransferForm()
          }}
          footer={<PaymentSlider amount={parsedTransferAmount} currency={selectedFromAccount?.currency || "DOP"} recipientName={accounts.find((a) => a.id === toAccount)?.name || "la cuenta"} onConfirm={handleTransfer} disabled={!fromAccount || !toAccount || parsedTransferAmount <= 0 || exceedsFromBalance || isTransferring} loading={isTransferring} label="Desliza para transferir" />}
        >
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Desde</p>
              <AccountCarouselSelector
                compact
                items={accounts.filter((a) => a.type !== "credit").map((a) => ({ id: a.id, title: a.name, subtitle: formatCurrency(Number(a.balance || 0), a.currency), detail: a.currency }))}
                selectedId={fromAccount}
                onSelect={setFromAccount}
              />
            </div>
            <div className="flex justify-center"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted"><ChevronDown className="h-4 w-4 text-muted-foreground" /></div></div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Hacia</p>
              <AccountCarouselSelector
                compact
                items={accounts.map((a) => ({ id: a.id, title: a.name, subtitle: formatCurrency(Number(a.balance || 0), a.currency), detail: a.currency }))}
                selectedId={toAccount}
                onSelect={setToAccount}
              />
            </div>
            <div className="mobile-card p-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Monto</p>
              <MoneyInput value={transferAmount} onValueChange={setTransferAmount} className="w-full rounded-2xl bg-muted p-4 text-2xl font-bold" />
              <button onClick={() => setApplyCommission((prev) => !prev)} className={cn("mt-2 rounded-full px-3 py-1 text-xs font-medium", applyCommission ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>Comisión 0.15%</button>
              {applyCommission && parsedTransferAmount > 0 && <p className="mt-1 text-xs text-muted-foreground">Comisión: {formatCurrency(transferCommissionAmount)} · Total: {formatCurrency(totalTransferAmount)}</p>}
            </div>
          </div>
        </BaseModalForm>
      )}

      {showCreateAccount && (
        <BaseModalForm title="Nueva cuenta" onClose={() => {
          setShowCreateAccount(false)
          resetCreateAccountForm()
        }} footer={<Button onClick={handleCreateAccount} disabled={!canCreateAccount || !accountName || (accountType === "credit" && !creditLimitDop && !creditLimitUsd) || isCreating} className="mobile-action-button w-full">{isCreating ? "Creando cuenta..." : "Guardar cuenta"}</Button>}>
          <div className="space-y-5">
            <input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Nombre" className="h-14 w-full rounded-2xl border border-border bg-background px-4" />
            {accountType !== "cash" && (
              <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/[^0-9]/g, "").slice(0, 24))} placeholder="Número de cuenta" className="h-14 w-full rounded-2xl border border-border bg-background px-4" />
            )}
            <div className="grid grid-cols-3 gap-2">{(["cash", "debit", "credit"] as const).map((t) => <button key={t} onClick={() => setAccountType(t)} className={cn("h-12 rounded-2xl px-2 text-xs font-bold", accountType === t ? "bg-primary text-primary-foreground" : "bg-muted")}>{t === "cash" ? "Efectivo" : t === "debit" ? "Débito" : "Crédito"}</button>)}</div>
            <div className="grid grid-cols-2 gap-2">
              {(["DOP", "USD"] as const).map((currency) => (
                <button key={currency} onClick={() => { setAccountCurrency(currency); setCreditUsed("") }} className={cn("rounded-xl px-3 py-2 text-xs font-semibold", accountCurrency === currency ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                  {currency === "DOP" ? "RD$" : "US$"}
                </button>
              ))}
            </div>
            {accountType !== "credit" && (
              <MoneyInput value={initialBalance} onValueChange={setInitialBalance} placeholder="Balance" className="w-full rounded-xl bg-muted p-3" />
            )}

            {accountType === "credit" && (
              <div className="space-y-3 rounded-2xl bg-muted/50 p-4">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {accountCurrency !== "USD" && <MoneyInput value={creditLimitDop} onValueChange={setCreditLimitDop} placeholder="Límite de crédito" className="w-full rounded-xl border border-border bg-background py-3 px-4" />}
                  {accountCurrency !== "DOP" && <MoneyInput value={creditLimitUsd} onValueChange={setCreditLimitUsd} placeholder="Límite de crédito USD" className="w-full rounded-xl border border-border bg-background py-3 px-4" />}
                </div>
                <MoneyInput value={creditUsed} onValueChange={setCreditUsed} placeholder="Crédito utilizado" className="w-full rounded-xl border border-border bg-background py-3 px-4" />
                <input type="text" inputMode="numeric" value={closingDate} onChange={(e) => setClosingDate(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))} placeholder="Día de corte" className="w-full rounded-xl border border-border bg-background py-3 px-4" />
                <p className="text-xs text-muted-foreground">Fecha de pago: automática (corte + 20 días)</p>
              </div>
            )}

            <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-semibold">Personalización visual</p>
              <div className="grid grid-cols-2 gap-2">{(["icon", "image"] as const).map((value) => <button key={value} onClick={() => setBrandingIconType(value)} className={cn("rounded-xl px-3 py-2 text-xs font-medium transition-colors", brandingIconType === value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{value === "icon" ? "Ícono" : "Logo/Banco"}</button>)}</div>
              {brandingIconType === "image" ? (
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Banco / Logo</p>
                  <select value={brandingBankKey} onChange={(e) => handleBankLogoChange(e.target.value)} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm">
                    {BANK_LOGO_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.name}</option>)}
                  </select>
                </div>
              ) : <div className="grid grid-cols-3 gap-2">{ICON_PRESETS.map((preset) => <button key={preset.value} onClick={() => setBrandingIconValue(preset.value)} className={cn("flex flex-col items-center gap-1 rounded-xl p-2", brandingIconValue === preset.value ? "bg-primary text-primary-foreground" : "bg-muted")}><preset.icon className="h-4 w-4" /><span className="text-[10px]">{preset.label}</span></button>)}</div>}
              <div className="flex flex-wrap gap-2">{COLOR_PRESETS.map((preset) => <button key={preset.key} onClick={() => { setBrandingPrimaryColor(preset.primary); setBrandingSecondaryColor(preset.secondary) }} className={cn("h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-background", brandingPrimaryColor === preset.primary && brandingSecondaryColor === preset.secondary ? "ring-primary" : "ring-transparent")} title={preset.name}><span className="block h-full w-full rounded-full" style={{ background: `linear-gradient(135deg, ${preset.primary}, ${preset.secondary})` }} /></button>)}</div>
              <div className="grid grid-cols-3 gap-2">{(["gradient", "solid", "glass"] as const).map((style) => <button key={style} onClick={() => setBrandingBackgroundStyle(style)} className={cn("rounded-xl px-3 py-2 text-xs", brandingBackgroundStyle === style ? "bg-primary text-primary-foreground" : "bg-muted")}>{style === "gradient" ? "Degradado" : style === "solid" ? "Sólido" : "Suave"}</button>)}</div>
              <BrandedAccountCard account={previewAccount as any} compact />
            </div>

          </div>
        </BaseModalForm>
      )}

      {confirmDeleteId && (
        <>
          <div className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm" onClick={() => { setConfirmDeleteId(null); setDeleteImpact(null) }} />
          <div className="fixed left-1/2 top-1/2 z-[100] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-border bg-card p-5 shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-500/12 text-red-500">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <div className="mt-4 text-center">
              <h2 className="text-lg font-black text-foreground">Eliminar cuenta</h2>
              <p className="mt-2 text-sm font-semibold text-foreground">
                {deleteImpact?.hasMovements ? "Esta cuenta tiene movimientos registrados." : "¿Eliminar esta cuenta?"}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {deleteImpact?.hasMovements
                  ? "Si la eliminas, también se perderán sus movimientos, historial e información asociada. Esta acción no se puede deshacer."
                  : "Esta acción no se puede deshacer."}
              </p>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-12 rounded-2xl" onClick={() => { setConfirmDeleteId(null); setDeleteImpact(null) }}>
                Cancelar
              </Button>
              <HoldToConfirmButton onConfirm={handleDeleteFromList} loading={isDeleting} className="w-full" label="Eliminar" />
            </div>
          </div>
        </>
      )}
      <UpsellModal open={isUpsellOpen} onClose={closeUpsell} blocked={blocked} />
    </div>
  )
}
