"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronLeft, Pause, Play, Trash2, XCircle } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { BaseModalForm } from "@/components/ui/base-modal-form"
import { MoneyInput } from "@/components/ui/money-input"
import { formatCurrency, getLocalDateString } from "@/lib/data"
import { FINANCIAL_SUBSCRIPTION_PROVIDERS, getFinancialSubscriptionProvider, getNextFinancialBillingDateFrom } from "@/lib/financial-subscriptions"
import { createFinancialSubscription, deleteFinancialSubscription, updateFinancialSubscription, useAccounts, useCategories, useFinancialSubscriptions } from "@/hooks/use-data"
import { notify } from "@/lib/notifications"
import { useEntitlementBlocked } from "@/hooks/use-entitlement-blocked"
import { UpsellModal } from "@/components/entitlements/upsell-modal"
import { useEntitlements } from "@/hooks/use-entitlements"
import { createBlockedResponse } from "@/lib/entitlements/entitlement-copy"

export function SubscriptionsScreen({ initialOpenCreate = false }: { initialOpenCreate?: boolean }) {
  const router = useRouter()
  const { data: subscriptions = [] } = useFinancialSubscriptions()
  const { data: accounts = [] } = useAccounts()
  const { data: categories = [] } = useCategories()
  const [showCreate, setShowCreate] = useState(initialOpenCreate)
  const [providerKey, setProviderKey] = useState("netflix")
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState<"DOP" | "USD">("DOP")
  const [sourceAccountId, setSourceAccountId] = useState("")
  const [billingDay, setBillingDay] = useState(String(new Date().getDate()))
  const [autoRecordEnabled, setAutoRecordEnabled] = useState(false)
  const [preAlertEnabled, setPreAlertEnabled] = useState(true)
  const { blocked, isUpsellOpen, handleEntitlementBlocked, closeUpsell } = useEntitlementBlocked()
  const { canUseFinancialSubscriptions } = useEntitlements()

  useEffect(() => {
    if (initialOpenCreate && !canUseFinancialSubscriptions) {
      handleEntitlementBlocked(createBlockedResponse("financial_subscriptions", { requiredPlan: "pro" }))
      setShowCreate(false)
    }
  }, [canUseFinancialSubscriptions, handleEntitlementBlocked, initialOpenCreate])

  const openCreateSubscription = () => {
    if (!canUseFinancialSubscriptions) {
      handleEntitlementBlocked(createBlockedResponse("financial_subscriptions", { requiredPlan: "pro" }))
      return
    }
    setShowCreate(true)
  }

  const active = subscriptions.filter((item) => item.status === "active")
  const pausedOrCancelled = subscriptions.filter((item) => item.status !== "active")
  const monthlyTotal = active.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const upcoming = active.slice(0, 3)

  const subscriptionCategoryId = useMemo(() => {
    return categories.find((item) => item.is_subscription)?.id || categories.find((item) => item.name.toLowerCase().includes("suscrip"))?.id || null
  }, [categories])

  const save = async () => {
    const parsed = Number(amount)
    if (!sourceAccountId || !parsed || !billingDay) return

    const linkedAccount = accounts.find((account) => account.id === sourceAccountId) || null
    const provider = getFinancialSubscriptionProvider(providerKey)
    const nextDate = getNextFinancialBillingDateFrom(new Date(), Number(billingDay))

    try {
      await createFinancialSubscription({
        name: provider.name,
        provider_key: provider.key,
        amount: parsed,
        currency,
        account_id: sourceAccountId,
        linked_account_id: linkedAccount?.type === "credit" ? null : sourceAccountId,
        linked_credit_card_id: linkedAccount?.type === "credit" ? sourceAccountId : null,
        auto_record_enabled: autoRecordEnabled,
        pre_alert_enabled: preAlertEnabled,
        category_id: subscriptionCategoryId,
        billing_day: Number(billingDay),
        next_payment_date: getLocalDateString(nextDate),
      })
      setShowCreate(false)
      setAmount("")
      setAutoRecordEnabled(false)
      setPreAlertEnabled(true)
      notify({ title: "Creado correctamente", message: "La suscripción fue guardada." })
      router.push("/settings/subscriptions")
    } catch (error) {
      if (handleEntitlementBlocked(error)) return
      notify({ title: "No se pudo guardar", message: "Intenta de nuevo en unos segundos." })
    }
  }

  return (
    <div className="app-scroll min-h-[100dvh] overflow-y-auto bg-background pb-nav-safe">
      <div className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/settings" className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"><ChevronLeft className="h-5 w-5 text-foreground" /></Link>
            <h1 className="text-lg font-semibold text-foreground">Suscripciones</h1>
          </div>
          <button type="button" onClick={openCreateSubscription} className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">Nueva</button>
        </div>
      </div>

      <div className="mx-auto max-w-md space-y-4 px-6 pt-6">
        <div className="rounded-2xl bg-card p-4">
          <p className="text-xs text-muted-foreground">Total mensual</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{formatCurrency(monthlyTotal)}</p>
          <p className="mt-2 text-xs text-muted-foreground">Activas: {active.length}</p>
        </div>

        <div className="rounded-2xl bg-card p-4">
          <p className="text-sm font-semibold text-foreground">Próximos pagos</p>
          <div className="mt-3 space-y-2">
            {upcoming.length === 0 ? <p className="text-xs text-muted-foreground">No hay pagos próximos.</p> : upcoming.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <span>{item.name}</span>
                <span className="text-muted-foreground">{format(new Date(`${item.next_payment_date}T12:00:00`), "d MMM", { locale: es })}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {active.map((item) => (
            <div key={item.id} className="rounded-2xl bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-foreground">{item.name}</p>
                  <p className="text-sm text-muted-foreground">{formatCurrency(Number(item.amount), item.currency)} / mes</p>
                  <p className="text-xs text-muted-foreground">Próximo pago: {item.next_payment_date} · Cuenta: {item.account?.name || "-"}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => updateFinancialSubscription(item.id, { status: "paused" })} className="rounded-lg bg-muted p-2"><Pause className="h-4 w-4" /></button>
                  <button type="button" onClick={() => updateFinancialSubscription(item.id, { status: "cancelled" })} className="rounded-lg bg-red-50 p-2 text-red-600 dark:bg-red-900/30"><XCircle className="h-4 w-4" /></button>
                  <button type="button" onClick={() => deleteFinancialSubscription(item.id)} className="rounded-lg bg-muted p-2"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {pausedOrCancelled.length > 0 && (
          <div className="rounded-2xl bg-card p-4">
            <p className="text-sm font-semibold text-foreground">Pausadas o canceladas</p>
            <div className="mt-2 space-y-2">
              {pausedOrCancelled.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <span>{item.name}</span>
                  <button type="button" onClick={() => updateFinancialSubscription(item.id, { status: "active" })} className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs"><Play className="h-3 w-3" />Reactivar</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <BaseModalForm
          title="Nueva suscripción"
          onClose={() => setShowCreate(false)}
          footer={<button type="button" onClick={save} className="h-12 w-full rounded-xl bg-primary font-semibold text-primary-foreground">Guardar</button>}
        >
          <div className="space-y-3 pb-safe-areas">
            <select value={providerKey} onChange={(event) => setProviderKey(event.target.value)} className="h-12 w-full rounded-xl border border-border bg-background px-4">
              {FINANCIAL_SUBSCRIPTION_PROVIDERS.map((provider) => <option key={provider.key} value={provider.key}>{provider.name}</option>)}
            </select>
            <MoneyInput value={amount} onValueChange={setAmount} placeholder="Monto mensual" className="h-12 w-full rounded-xl border border-border bg-background px-4" />
            <select value={currency} onChange={(event) => setCurrency(event.target.value as "DOP" | "USD")} className="h-12 w-full rounded-xl border border-border bg-background px-4">
              <option value="DOP">DOP</option>
              <option value="USD">USD</option>
            </select>
            <select value={sourceAccountId} onChange={(event) => setSourceAccountId(event.target.value)} className="h-12 w-full rounded-xl border border-border bg-background px-4">
              <option value="">Cuenta o tarjeta vinculada</option>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.type === "credit" ? "Tarjeta" : "Cuenta"}</option>)}
            </select>
            <input value={billingDay} onChange={(event) => setBillingDay(event.target.value)} type="number" min={1} max={31} className="h-12 w-full rounded-xl border border-border bg-background px-4" placeholder="Día de cobro" />

            <label className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-sm">
              <span>Registrar automáticamente</span>
              <input type="checkbox" checked={autoRecordEnabled} onChange={(event) => setAutoRecordEnabled(event.target.checked)} />
            </label>
            <label className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-sm">
              <span>Alerta 1 día antes</span>
              <input type="checkbox" checked={preAlertEnabled} onChange={(event) => setPreAlertEnabled(event.target.checked)} />
            </label>

            <p className="text-xs text-muted-foreground">Se registrará automáticamente en MiCuadre cuando llegue la fecha.</p>
            <p className="text-xs text-muted-foreground">Esto no realiza cargos reales en tu banco.</p>
          </div>
        </BaseModalForm>
      )}
      <UpsellModal open={isUpsellOpen} onClose={closeUpsell} blocked={blocked} />
    </div>
  )
}
