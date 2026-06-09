"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { Header } from "@/components/dashboard/header"
import { BalanceCard } from "@/components/dashboard/balance-card"
import { AccountsList } from "@/components/dashboard/accounts-list"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { TransactionsList } from "@/components/dashboard/transactions-list"
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { processDueFinancialSubscriptions, useProfile } from "@/hooks/use-data"
import { useAccounts, useFinancialSubscriptions, useTransactions } from "@/hooks/use-data"
import { Button } from "@/components/ui/button"
import { formatCurrency, getLocalDateString } from "@/lib/data"
import { generateFinancialInsights } from "@/lib/insights"
import { AppSplash, DashboardLoadingIcon } from "@/components/dashboard/app-splash"
import { ActivationPanel } from "@/components/dashboard/activation-panel"
import { PlanningSummaryCard } from "@/components/dashboard/planning-summary-card"
import { CalendarPreviewCard } from "@/components/dashboard/calendar-preview-card"
import { showToast } from "@/components/toast/smart-toast"
import { EventBus } from "@/lib/event-bus"
import { PlanSelectorSheet } from "@/components/billing/plan-selector-sheet"
import { useEntitlements } from "@/hooks/use-entitlements"

const CoachIAWidget = dynamic(() => import("@/components/dashboard/coach-ia-widget").then((mod) => mod.CoachIAWidget), {
  ssr: false,
  loading: () => null,
})

export function DashboardContent() {
  const router = useRouter()
  const [isReady, setIsReady] = useState(false)
  const [showSplash, setShowSplash] = useState(true)
  const [showCreditReminder, setShowCreditReminder] = useState(false)
  const [showWelcomePlanPrompt, setShowWelcomePlanPrompt] = useState(false)
  const [activeWarningIndex, setActiveWarningIndex] = useState(0)
  const { loading, user } = useAuth()
  const { data: profile, isLoading: profileLoading, mutate: mutateProfile } = useProfile()
  const { data: accounts = [] } = useAccounts()
  const { data: subscriptions = [] } = useFinancialSubscriptions()
  const { data: recentTransactions = [] } = useTransactions(120)
  const { isPro } = useEntitlements()
  const [planningUpsellOpen, setPlanningUpsellOpen] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false

    fetch("/api/auth/sync-profile", { method: "POST", credentials: "same-origin" })
      .then((response) => {
        if (!cancelled && response.ok) {
          mutateProfile()
        }
      })
      .catch(() => {
      })

    return () => {
      cancelled = true
    }
  }, [mutateProfile, user])

  useEffect(() => {
    if (loading || profileLoading) return

    const onboardingCompleted = Boolean(profile?.onboarding_completed)

    if (!onboardingCompleted) {
      router.replace("/onboarding")
      return
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem("onboarding_completed", "true")
      const promptKey = `micuadre_plan_prompt_seen_${profile?.id || user?.id || "local"}`
      if (window.localStorage.getItem(promptKey) !== "true") {
        window.localStorage.setItem(promptKey, "true")
        setShowWelcomePlanPrompt(true)
      }
    }

    setIsReady(true)
  }, [loading, profile?.id, profile?.onboarding_completed, profileLoading, router, user?.id])

  useEffect(() => {
    if (typeof window === "undefined") return

    const alreadyShown = window.sessionStorage.getItem("micuadre_splash_seen") === "true"
    if (alreadyShown) {
      setShowSplash(false)
      return
    }

    const timer = window.setTimeout(() => {
      setShowSplash(false)
      window.sessionStorage.setItem("micuadre_splash_seen", "true")
    }, 1400)

    return () => window.clearTimeout(timer)
  }, [])

  const creditWarnings = useMemo(() => {
    const now = new Date()
    const today = getLocalDateString(now)

    return accounts.flatMap((account) => {
      if (account.type !== "credit") return [] as Array<{ key: string; kind: "credit_cutoff_warning" | "credit_payment_warning"; title: string; message: string }>

      const warnings: Array<{ key: string; kind: "credit_cutoff_warning" | "credit_payment_warning"; title: string; message: string }> = []
      const closingDay = Number(account.closing_day || 0)
      if (closingDay >= 1 && closingDay <= 31) {
        const cutoff = new Date(now.getFullYear(), now.getMonth(), Math.min(closingDay, 28))
        if (cutoff.getTime() < now.getTime()) cutoff.setMonth(cutoff.getMonth() + 1)
        const cutoffDays = Math.ceil((new Date(cutoff.toDateString()).getTime() - new Date(now.toDateString()).getTime()) / (1000 * 60 * 60 * 24))
        if (cutoffDays === 3) {
          warnings.push({
            key: `${account.id}-credit_cutoff_warning-${today}`,
            kind: "credit_cutoff_warning",
            title: `Corte próximo: ${account.name}`,
            message: `Tu tarjeta ${account.name} corta en 3 días. Revisa tus consumos antes del corte.`,
          })
        }
      }

      const dopPending = Math.max(0, Number(account.statement_balance_dop ?? 0) - Number(account.paid_statement_amount_dop ?? 0))
      const usdPending = Math.max(0, Number(account.statement_balance_usd ?? 0) - Number(account.paid_statement_amount_usd ?? 0))
      const pending = dopPending + usdPending
      if (account.statement_due_date && pending > 0) {
        const due = new Date(`${account.statement_due_date}T12:00:00`)
        const dueDays = Math.ceil((new Date(due.toDateString()).getTime() - new Date(now.toDateString()).getTime()) / (1000 * 60 * 60 * 24))
        if (dueDays === 5) {
          warnings.push({
            key: `${account.id}-credit_payment_warning-${today}`,
            kind: "credit_payment_warning",
            title: `Pago próximo: ${account.name}`,
            message: `Tu pago de tarjeta ${account.name} vence en 5 días. Balance pendiente: ${formatCurrency(pending, account.currency)}.`,
          })
        }
      }

      return warnings
    })
  }, [accounts])

  useEffect(() => {
    if (!user || loading || profileLoading || !isReady || typeof window === "undefined") return
    if (creditWarnings.length === 0) {
      setShowCreditReminder(false)
      return
    }

    const unseen = creditWarnings.findIndex((warning) => {
      const key = `credit_warning_seen_${user.id}_${warning.key}`
      const toastKey = `credit_toast_shown_${user.id}_${warning.key}`
      return window.localStorage.getItem(key) !== "true" && window.localStorage.getItem(toastKey) !== "true"
    })

    if (unseen >= 0) {
      setActiveWarningIndex(unseen)
      setShowCreditReminder(true)
      const warning = creditWarnings[unseen]
      const toastKey = `credit_toast_shown_${user.id}_${warning.key}`
      window.localStorage.setItem(toastKey, "true")
      if (warning.kind === "credit_cutoff_warning") {
        showToast({ title: "Corte de tarjeta en 3 días", body: `Revisa tus consumos en ${warning.title.replace("Corte próximo: ", "")} antes del corte.`, type: "warning", duration: 5000 })
      } else if (warning.kind === "credit_payment_warning") {
        showToast({ title: "Pago de tarjeta pendiente", body: warning.message, type: "warning", duration: 5000 })
      }
    } else {
      setShowCreditReminder(false)
    }
  }, [creditWarnings, isReady, loading, profileLoading, user])

  useEffect(() => {
    if (!user || !isReady) return
    let cancelled = false
    processDueFinancialSubscriptions().then(() => {
      if (cancelled) return
    }).catch(() => {
    })
    return () => { cancelled = true }
  }, [isReady, user])

  useEffect(() => {
    if (!isReady) return

    const unsubTx = EventBus.on("transaction_created", (event) => {
      const { type, amount, currency } = event.payload ?? {}
      if (type === "income") {
        showToast({ title: "Ingreso registrado", body: `+${formatCurrency(amount, currency)}`, type: "success", duration: 2500 })
      } else {
        showToast({ title: "Gasto guardado", body: `-${formatCurrency(amount, currency)}`, type: "success", duration: 2500 })
      }
    })

    const unsubAcc = EventBus.on("account_created", (event) => {
      const { name } = event.payload ?? {}
      showToast({ title: "Cuenta creada", body: `${name} está lista para rastrear`, type: "success", duration: 2500 })
    })

    const unsubSub = EventBus.on("subscription_created", (event) => {
      const { name, amount } = event.payload ?? {}
      showToast({ title: "Suscripción agregada", body: `${name} · ${formatCurrency(amount)} al mes`, type: "success", duration: 2500 })
    })

    return () => {
      unsubTx()
      unsubAcc()
      unsubSub()
    }
  }, [isReady])

  const dashboardInsights = useMemo(() => generateFinancialInsights({
    transactions: recentTransactions,
    accounts,
    subscriptions,
  }).slice(0, 2), [accounts, recentTransactions, subscriptions])

  const insightStyles = {
    success: "border-emerald-200 bg-emerald-50/70 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-300",
    warning: "border-amber-200 bg-amber-50/70 text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300",
    info: "border-sky-200 bg-sky-50/70 text-sky-800 dark:border-sky-900/50 dark:bg-sky-900/20 dark:text-sky-300",
    danger: "border-red-200 bg-red-50/70 text-red-800 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300",
  } as const

  const insightIcon = {
    success: CheckCircle2,
    warning: TriangleAlert,
    info: Info,
    danger: AlertCircle,
  } as const

  const closeCreditReminder = () => {
    if (user && typeof window !== "undefined") {
      const warning = creditWarnings[activeWarningIndex]
      if (warning) {
        const key = `credit_warning_seen_${user.id}_${warning.key}`
        window.localStorage.setItem(key, "true")
      }
    }
    setShowCreditReminder(false)
  }

  if (showSplash) {
    return <AppSplash />
  }

  if (loading || profileLoading || !isReady) {
    return <DashboardLoadingIcon />
  }

  return (
    <main className="app-scroll min-h-[100dvh] overflow-y-auto bg-background">
      <div className="mobile-page">
        <Header />

        <div className="motion-list">
        <div className="mt-6">
          <BalanceCard />
        </div>

        <div className="mt-5">
          <QuickActions />
        </div>

        {accounts.length === 0 && recentTransactions.length === 0 && (
          <ActivationPanel />
        )}

        <div className="mt-6">
          {isPro ? (
            <PlanningSummaryCard />
          ) : (
            <section className="relative overflow-hidden rounded-[1.65rem] border border-accent/20 bg-accent/8 p-5 shadow-sm">
              <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-accent/12" />
              <p className="section-kicker">Planificación</p>
              <p className="mt-2 text-sm font-black text-foreground">Controla tu mes con Pro</p>
              <p className="mt-1 text-xs text-muted-foreground">Presupuestos, deudas y pagos próximos en un solo lugar.</p>
              <button
                type="button"
                onClick={() => setPlanningUpsellOpen(true)}
                className="tap-lift mt-4 inline-flex h-11 items-center justify-center rounded-2xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-lift)]"
              >
                Ver planes
              </button>
            </section>
          )}
        </div>

        <div className="mt-6">
          <AccountsList />
        </div>

        {isPro ? (
          <div className="mt-6">
            <CalendarPreviewCard />
          </div>
        ) : null}

        <div className="mt-6">
          <TransactionsList />
        </div>

        {dashboardInsights.length > 0 && (
          <div className="mt-6 space-y-2">
            {dashboardInsights.map((insight, index) => {
              const Icon = insightIcon[insight.type]
              return (
                <div key={`${insight.title}-${index}`} className={`rounded-2xl border p-3 ${insightStyles[insight.type]}`}>
                  <div className="flex items-start gap-3">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold">{insight.title}</p>
                      <p className="text-xs leading-relaxed opacity-90">{insight.message}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        </div>
      </div>

      <CoachIAWidget />

      {showCreditReminder && creditWarnings[activeWarningIndex] && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/18 px-6 backdrop-blur-[6px] dark:bg-black/45">
          <div className="w-full max-w-sm animate-in fade-in-0 zoom-in-95 duration-300 ease-[var(--ease-sheet-ios)] rounded-[1.6rem] border border-border/70 bg-card/96 p-5 shadow-[var(--shadow-float)] backdrop-blur-2xl">
            <p className="text-sm font-semibold text-foreground">{creditWarnings[activeWarningIndex].title}</p>
            <p className="mt-2 text-sm text-muted-foreground">{creditWarnings[activeWarningIndex].message}</p>
            <Button className="mt-4 h-11 w-full" onClick={closeCreditReminder}>Entendido</Button>
          </div>
        </div>
      )}
      <PlanSelectorSheet open={showWelcomePlanPrompt} onOpenChange={setShowWelcomePlanPrompt} welcome />
      <PlanSelectorSheet open={planningUpsellOpen} onOpenChange={setPlanningUpsellOpen} reasonTitle="Planificación Pro" reasonBody="Desbloquea presupuestos, calendario y deudas con Pro." />
    </main>
  )
}
