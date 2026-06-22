"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowRightLeft, ChevronDown, Pencil, Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { PaymentSlider } from "@/components/payment-slider"
import { BaseModalForm } from "@/components/ui/base-modal-form"
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { MoneyInput } from "@/components/ui/money-input"
import { AccountCarouselSelector } from "@/components/ui/account-carousel-selector"
import { BrandedAccountCard } from "@/components/accounts/branded-account-card"
import { notify } from "@/lib/notifications"
import { triggerHaptic } from "@/lib/haptics"
import { EventBus } from "@/lib/event-bus"
import { createTransfer, deleteAccount, getAccountDeletionImpact, reorderAccounts, useAccounts } from "@/hooks/use-data"
import { MobilePageShell } from "@/components/ui/mobile-foundation"
import { formatCurrency, getCurrencySymbol } from "@/lib/data"
import { parseAmount, transferSchema } from "@/lib/validation"
import { useRouter } from "next/navigation"
import type { Account } from "@/lib/types/database"
import { AccountCreationWizard } from "@/components/accounts/account-creation-wizard"
import { useEntitlements } from "@/hooks/use-entitlements"
import { UsageLimitBanner } from "@/components/entitlements/usage-limit-banner"
import { useEntitlementBlocked } from "@/hooks/use-entitlement-blocked"
import { UpsellModal } from "@/components/entitlements/upsell-modal"
import { createBlockedResponse } from "@/lib/entitlements/entitlement-copy"
import { HoldToConfirmButton } from "@/components/ui/hold-to-confirm-button"



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



  const [fromAccount, setFromAccount] = useState("")
  const [toAccount, setToAccount] = useState("")
  const [transferAmount, setTransferAmount] = useState("")
  const [isTransferring, setIsTransferring] = useState(false)

  
  const resetTransferForm = () => {
    setFromAccount("")
    setToAccount("")
    setTransferAmount("")
  }

  const parsedTransferAmount = parseFloat(transferAmount.replace(/[^0-9.]/g, "")) || 0
  const selectedFromAccount = accounts.find((a) => a.id === fromAccount)
  const exceedsFromBalance = Boolean(selectedFromAccount && parsedTransferAmount > Number(selectedFromAccount.balance || 0))

// Initialize orderedAccounts when accounts load, sync when accounts change
  // React 19: Add orderedAccounts to deps to satisfy exhaustive-deps rule
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
  }, [accounts, orderedAccounts])

  // Use orderedAccounts if available, otherwise fall back to accounts
  const displayAccounts = orderedAccounts ?? accounts
  const accountSummary = useMemo(() => {
    const cards = displayAccounts.filter((account) => account.type === "credit").length
    const liquidAccounts = displayAccounts.length - cards
    const dopBalance = displayAccounts
      .filter((account) => account.type !== "credit" && account.currency === "DOP")
      .reduce((total, account) => total + Number(account.balance || 0), 0)

    return { cards, liquidAccounts, dopBalance }
  }, [displayAccounts])

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
    const active = document.activeElement as HTMLElement | null
    if (active && typeof active.blur === "function") active.blur()
    setConfirmDeleteId(accountId)
    setDeleteImpact(null)
    try {
      setDeleteImpact(await getAccountDeletionImpact(accountId))
    } catch {
      setDeleteImpact({ count: 1, hasMovements: true })
    }
  }



  const handleTransfer = async () => {
    const validation = transferSchema.safeParse({ fromAccountId: fromAccount, toAccountId: toAccount, amount: transferAmount, description: undefined })
    if (!validation.success) return
    const amount = parseAmount(transferAmount)
    const source = accounts.find((a) => a.id === fromAccount)
    if (!source) return
    if (amount > Number(source.balance || 0)) {
      notify({ title: "Fondos insuficientes", message: "No tienes suficiente balance disponible." })
      return
    }

    setIsTransferring(true)
    try {
      await createTransfer({ from_account_id: fromAccount, to_account_id: toAccount, amount, currency: source.currency, apply_commission: false })
      notify({ title: "Transferencia exitosa", message: "Se han transferido los fondos." })
      EventBus.emit({ type: "transfer_completed" })
      resetTransferForm()
      setShowTransfer(false)
    } finally {
      setIsTransferring(false)
    }
  }

  return (
    <>
    <MobilePageShell fullBleed className={cn("pb-nav-safe", showTransfer && "hidden")}>
      <header className="mx-auto max-w-md px-5 pb-4 pt-[calc(1.5rem+env(safe-area-inset-top))]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="section-kicker">Centro financiero</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-foreground">Cuentas</h1>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">Administra tu dinero, tarjetas y movimientos.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => setShowTransfer(true)}
              aria-label="Mover dinero"
              className="tap-lift group flex h-12 w-12 items-center justify-center rounded-2xl border border-border/70 bg-card/76 shadow-sm backdrop-blur transition hover:shadow-[var(--shadow-lift)]"
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
              className="tap-lift group flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[var(--shadow-lift)] transition"
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
        <div className="mx-auto max-w-md space-y-4 px-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-3xl bg-card/80 shadow-sm" />
          ))}
        </div>
      ) : displayAccounts.length === 0 ? (
        <div className="mobile-card mx-auto max-w-md p-6 text-center">
          <p className="text-sm font-semibold text-foreground">No tienes cuentas todavía</p>
          <p className="mt-1 text-xs text-muted-foreground">Agrega tu primera cuenta y empieza a rastrear tu dinero.</p>
        </div>
      ) : (
        <>
          <div className="mx-auto max-w-md px-5 pt-3">
            <div className="rounded-2xl border border-border/60 bg-muted/45 px-3 py-2 text-[0.6875rem] font-semibold text-muted-foreground">
              Mantén presionado una tarjeta para ordenar. Desliza hacia la izquierda para editar o eliminar.
            </div>
          </div>

          <div className="mx-auto max-w-md space-y-3 px-5 pt-1">
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
                <button type="button"
                  onClick={() => router.push(`/accounts/${account.id}?edit=1`)}
                  className="tap-lift flex h-11 w-11 items-center justify-center rounded-2xl bg-muted text-foreground"
                  aria-label="Editar cuenta"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button type="button"
                  onClick={() => openDeleteConfirm(account.id)}
                  className="tap-lift flex h-11 w-11 items-center justify-center rounded-2xl bg-destructive text-destructive-foreground"
                  aria-label="Eliminar cuenta"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div
                className={cn(
                  "relative z-10 transition-transform duration-200 ease-[var(--ease-out-ios)]",
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
                  className="group block transition-transform duration-200 ease-[var(--ease-out-ios)] active:scale-[0.98]"
                >
                  <BrandedAccountCard account={account} compact />
                </Link>
              </div>
            </div>
          )
        })}
      </div>
        </>
      )}

      <AccountCreationWizard open={showCreateAccount} onOpenChange={setShowCreateAccount} />

      <AlertDialog open={!!confirmDeleteId} onOpenChange={(open) => { if (!open) { setConfirmDeleteId(null); setDeleteImpact(null) } }}>
        <AlertDialogContent className="max-w-sm p-0 gap-0" onCloseAutoFocus={(e) => { e.preventDefault() }}>
          <div className="p-5">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/12 text-destructive">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <div className="mt-4 text-center">
              <AlertDialogTitle className="text-lg font-black text-foreground">Eliminar cuenta</AlertDialogTitle>
              <AlertDialogDescription className="mt-2 text-sm font-semibold text-foreground">
                {deleteImpact?.hasMovements ? "Esta cuenta tiene movimientos registrados." : "¿Eliminar esta cuenta?"}
              </AlertDialogDescription>
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
        </AlertDialogContent>
      </AlertDialog>
      <UpsellModal open={isUpsellOpen} onClose={closeUpsell} blocked={blocked} />
    </MobilePageShell>

    {showTransfer && (
      <BaseModalForm
        title="Transferir dinero"
        onClose={() => {
          setShowTransfer(false)
          resetTransferForm()
        }}
        footer={<PaymentSlider amount={parsedTransferAmount} currency={selectedFromAccount?.currency || "DOP"} recipientName={accounts.find((a) => a.id === toAccount)?.name || "la cuenta"} onConfirm={handleTransfer} disabled={!fromAccount || !toAccount || fromAccount === toAccount || parsedTransferAmount <= 0 || exceedsFromBalance || isTransferring} loading={isTransferring} label="Desliza para transferir" />}
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
                  items={accounts.filter((a) => a.type !== "credit" && a.id !== fromAccount).map((a) => ({ id: a.id, title: a.name, subtitle: formatCurrency(Number(a.balance || 0), a.currency), detail: a.currency }))}
                  selectedId={toAccount}
                  onSelect={setToAccount}
                />
          </div>
          <div className="mobile-card p-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Monto</p>
            <MoneyInput value={transferAmount} onValueChange={setTransferAmount} className="hero-amount w-full rounded-2xl bg-muted p-3 text-center text-input-hero font-extrabold leading-none tabular-nums min-w-[100px]" />
          </div>
          </div>
        </BaseModalForm>
    )}
    </>
  )
}
