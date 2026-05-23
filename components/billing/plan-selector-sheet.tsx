"use client"

import { useState } from "react"
import { ArrowUpRight, Check, CreditCard, RefreshCw, ShieldCheck, Sparkles, X } from "lucide-react"
import { PlanBadge } from "@/components/entitlements/plan-badge"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { useBillingStatus } from "@/hooks/use-billing-status"
import { useEntitlements } from "@/hooks/use-entitlements"
import {
  ANNUAL_DISCOUNT_PERCENT,
  PLAN_CONFIG,
  PLAN_ORDER,
  formatPlanPrice,
  getBillingIntervalSuffix,
  getFinancialSubscriptionLimitLabel,
  isPaidPlan,
  normalizePlanTier,
} from "@/lib/billing/plans"
import { BILLING_COPY } from "@/lib/entitlements/entitlement-copy"
import { notify } from "@/lib/notifications"
import { cn } from "@/lib/utils"
import type { BillingInterval, PaidPlanTier } from "@/types/billing"

type PlanSelectorSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  reasonTitle?: string
  reasonBody?: string
  defaultInterval?: BillingInterval
}

function compactLimit(value: number | "unlimited", label: string) {
  if (value === "unlimited") return `${label} ilimitadas`
  return `${value} ${label}`
}

export function PlanSelectorSheet({
  open,
  onOpenChange,
  reasonTitle,
  reasonBody,
  defaultInterval = "monthly",
}: PlanSelectorSheetProps) {
  const { plan } = useEntitlements()
  const { data: billingStatus } = useBillingStatus()
  const [interval, setInterval] = useState<BillingInterval>(defaultInterval)
  const [isLoadingCheckout, setIsLoadingCheckout] = useState<PaidPlanTier | null>(null)
  const [isOpeningPortal, setIsOpeningPortal] = useState(false)

  const effectivePlan = normalizePlanTier((billingStatus?.planTier || plan) as string | undefined)
  const canManagePlan = isPaidPlan(effectivePlan) || Boolean(billingStatus?.billingReady)

  const startCheckout = async (targetPlan: PaidPlanTier) => {
    setIsLoadingCheckout(targetPlan)
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: targetPlan, interval }),
      })

      const data = (await response.json().catch(() => null)) as { url?: string; error?: string } | null
      if (!response.ok || !data?.url) {
        notify({ title: "No pudimos abrir el pago", message: data?.error || BILLING_COPY.checkout.error })
        return
      }

      window.location.href = data.url
    } catch {
      notify({ title: "No pudimos abrir el pago", message: BILLING_COPY.checkout.error })
    } finally {
      setIsLoadingCheckout(null)
    }
  }

  const openBillingPortal = async () => {
    setIsOpeningPortal(true)
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" })
      const data = (await response.json().catch(() => null)) as { url?: string; error?: string } | null
      if (!response.ok || !data?.url) {
        notify({ title: "Portal de facturación", message: BILLING_COPY.portal.error })
        return
      }
      window.location.href = data.url
    } catch {
      notify({ title: "Portal de facturación", message: "Intenta de nuevo en unos segundos." })
    } finally {
      setIsOpeningPortal(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
      <DrawerContent className="mx-auto max-h-[92dvh] max-w-md rounded-t-[1.75rem] border-border bg-background">
        <div className="app-scroll overflow-y-auto px-5 pb-safe">
          <DrawerHeader className="px-0 pb-2 pt-4 text-left">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  Planes MiCuadre
                </div>
                <DrawerTitle className="mt-3 text-2xl font-black tracking-tight">
                  Elige el plan ideal para ti
                </DrawerTitle>
                <DrawerDescription className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Empieza gratis y desbloquea más control financiero cuando lo necesites.
                </DrawerDescription>
              </div>
              <DrawerClose className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition hover:text-foreground">
                <X className="h-5 w-5" />
              </DrawerClose>
            </div>
          </DrawerHeader>

          {(reasonTitle || reasonBody) && (
            <div className="mt-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
              {reasonTitle && <p className="text-sm font-black text-foreground">{reasonTitle}</p>}
              {reasonBody && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{reasonBody}</p>}
            </div>
          )}

          <div className="mt-4 rounded-2xl border border-border bg-card p-1.5">
            <div className="grid grid-cols-2 gap-1">
              {(["monthly", "yearly"] as BillingInterval[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setInterval(value)}
                  className={cn(
                    "h-11 rounded-xl text-sm font-black transition-all duration-300 active:scale-[0.98]",
                    interval === value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/70"
                  )}
                >
                  {value === "monthly" ? "Mensual" : `Anual · Ahorra ${ANNUAL_DISCOUNT_PERCENT}%`}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {PLAN_ORDER.map((tier, index) => {
              const config = PLAN_CONFIG[tier]
              const current = tier === effectivePlan
              const paid = isPaidPlan(tier)
              const isPro = tier === "pro"
              const isPlus = tier === "plus"

              return (
                <article
                  key={tier}
                  className={cn(
                    "relative overflow-hidden rounded-[1.35rem] border bg-card p-4 transition-all duration-300 active:scale-[0.995]",
                    current && "border-emerald-500/40 bg-emerald-500/[0.03]",
                    !current && isPro && "border-primary/40 shadow-[0_8px_28px_rgba(34,197,94,0.08)]",
                    !current && isPlus && "border-amber-500/35 shadow-[0_8px_28px_rgba(245,158,11,0.08)]",
                    !current && !paid && "border-border"
                  )}
                  style={{ animationDelay: `${index * 70}ms` }}
                >
                  {(isPro || isPlus) && (
                    <div className={cn("pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl", isPro ? "bg-primary/12" : "bg-amber-500/12")} />
                  )}
                  <div className="relative flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-black">{config.label}</h3>
                        {config.badge && (
                          <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-black", isPro ? "bg-primary/10 text-primary" : "bg-amber-500/15 text-amber-700 dark:text-amber-300")}>
                            {config.badge}
                          </span>
                        )}
                        {current && (
                          <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-black text-emerald-700 dark:text-emerald-300">
                            Plan actual
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs font-medium text-muted-foreground">{config.audience}</p>
                    </div>
                    <PlanBadge plan={tier} />
                  </div>

                  <div className="relative mt-4">
                    <span className="text-3xl font-black tracking-tight">{formatPlanPrice(tier, interval)}</span>
                    <span className="ml-1 text-sm font-semibold text-muted-foreground">{getBillingIntervalSuffix(interval)}</span>
                    {paid && interval === "yearly" && (
                      <p className="mt-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        Equivale a ${config.price.yearlyMonthlyEquivalent.toFixed(2)}/mes
                      </p>
                    )}
                  </div>

                  <div className="relative mt-4 grid gap-2 text-xs text-muted-foreground">
                    {config.benefits.slice(0, 4).map((benefit) => (
                      <span key={benefit} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                        {benefit}
                      </span>
                    ))}
                  </div>

                  <div className="relative mt-4 grid grid-cols-3 gap-2 text-center text-[10px]">
                    <div className="rounded-xl bg-muted/35 px-2 py-2">
                      <p className="font-bold text-foreground">{compactLimit(config.limits.max_accounts, "cuentas")}</p>
                    </div>
                    <div className="rounded-xl bg-muted/35 px-2 py-2">
                      <p className="font-bold text-foreground">{compactLimit(config.limits.max_goals, "metas")}</p>
                    </div>
                    <div className="rounded-xl bg-muted/35 px-2 py-2">
                      <p className="font-bold text-foreground">{getFinancialSubscriptionLimitLabel(tier)}</p>
                    </div>
                  </div>

                  <div className="relative mt-4">
                    {current ? (
                      <button disabled className="h-11 w-full rounded-xl bg-muted/50 text-sm font-black text-muted-foreground">
                        Plan actual
                      </button>
                    ) : !paid ? (
                      <button disabled className="h-11 w-full rounded-xl bg-muted/30 text-sm font-black text-muted-foreground">
                        Incluido
                      </button>
                    ) : isPaidPlan(effectivePlan) ? (
                      <button
                        type="button"
                        onClick={openBillingPortal}
                        disabled={isOpeningPortal}
                        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-black transition hover:bg-muted/40 active:scale-[0.99] disabled:opacity-60"
                      >
                        <CreditCard className="h-4 w-4" />
                        {isOpeningPortal ? "Abriendo..." : "Gestionar plan"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startCheckout(tier as PaidPlanTier)}
                        disabled={isLoadingCheckout !== null}
                        className={cn(
                          "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-black text-primary-foreground transition active:scale-[0.99] disabled:opacity-60",
                          isPlus ? "bg-amber-600 hover:bg-amber-600/95" : "bg-primary hover:bg-primary/95"
                        )}
                      >
                        {isLoadingCheckout === tier ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Abriendo pago seguro...
                          </>
                        ) : (
                          <>
                            {config.cta}
                            <ArrowUpRight className="h-4 w-4" />
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </article>
              )
            })}
          </div>

          {canManagePlan && (
            <button
              type="button"
              onClick={openBillingPortal}
              disabled={isOpeningPortal}
              className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-black transition hover:bg-muted/40 active:scale-[0.99] disabled:opacity-60"
            >
              <CreditCard className="h-4 w-4" />
              {isOpeningPortal ? "Abriendo portal..." : "Gestionar plan"}
            </button>
          )}

          <div className="mt-4 rounded-2xl border border-border bg-muted/20 p-4">
            <div className="flex items-center gap-2 text-sm font-black">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Pago seguro con Stripe
            </div>
            <div className="mt-2 space-y-1 text-xs leading-relaxed text-muted-foreground">
              <p>Puedes cancelar cuando quieras.</p>
              <p>Tu plan puede tardar unos segundos en actualizarse después del pago.</p>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
