"use client"

import { useEffect, useMemo, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { Header } from "@/components/dashboard/header"
import { BalanceCard } from "@/components/dashboard/balance-card"
import { AccountsList } from "@/components/dashboard/accounts-list"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { TransactionsList } from "@/components/dashboard/transactions-list"
import { motion, AnimatePresence } from "framer-motion"
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { processDueFinancialSubscriptions, useProfile } from "@/hooks/use-data"
import { useAccounts, useFinancialSubscriptions, useTransactions, useGoals } from "@/hooks/use-data"
import { useBudgetsWithUsage } from "@/hooks/use-planning"
import { Button } from "@/components/ui/button"
import { MobilePageShell } from "@/components/ui/mobile-foundation"
import { formatCurrency, getLocalDateString } from "@/lib/data"
import { clampDay } from "@/lib/credit-cycle"
import { generateFinancialInsights } from "@/lib/insights"
import { generateSmartNotifications } from "@/lib/smart-notifications"
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
  const { data: budgetsWithUsage = [] } = useBudgetsWithUsage()
  const { data: goals = [] } = useGoals()

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
      if (!isPro) {
        const promptKey = `micuadre_plan_prompt_seen_${profile?.id || user?.id || "local"}`
        if (window.localStorage.getItem(promptKey) !== "true") {
          window.localStorage.setItem(promptKey, "true")
          setShowWelcomePlanPrompt(true)
        }
      }
    }

    setIsReady(true)
  }, [isPro, loading, profile?.id, profile?.onboarding_completed, profileLoading, router, user?.id])

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
        const cutoff = new Date(now.getFullYear(), now.getMonth(), clampDay(now.getFullYear(), now.getMonth(), closingDay))
        if (cutoff.getTime() < now.getTime()) cutoff.setMonth(cutoff.getMonth() + 1)
        const cutoffDays = Math.ceil((new Date(cutoff.toDateString()).getTime() - new Date(now.toDateString()).getTime()) / (1000 * 60 * 60 * 24))
        if (cutoffDays <= 3 && cutoffDays >= 1) {
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
      if (account.statement_due_date) {
        const due = new Date(`${account.statement_due_date}T12:00:00`)
        const dueDays = Math.ceil((new Date(due.toDateString()).getTime() - new Date(now.toDateString()).getTime()) / (1000 * 60 * 60 * 24))
        if (dueDays <= 5 && dueDays >= 1) {
          if (dopPending > 0) {
            warnings.push({
              key: `${account.id}-credit_payment_warning_dop-${today}`,
              kind: "credit_payment_warning",
              title: `Pago próximo: ${account.name} (DOP)`,
              message: `Tu pago de tarjeta ${account.name} vence en 5 días. Balance pendiente: ${formatCurrency(dopPending, "DOP")}.`,
            })
          }
          if (usdPending > 0) {
            warnings.push({
              key: `${account.id}-credit_payment_warning_usd-${today}`,
              kind: "credit_payment_warning",
              title: `Pago próximo: ${account.name} (USD)`,
              message: `Tu pago de tarjeta ${account.name} vence en 5 días. Balance pendiente: ${formatCurrency(usdPending, "USD")}.`,
            })
          }
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

  const shownBudgetNotifications = useRef(new Set<string>())
  useEffect(() => {
    if (!isReady || budgetsWithUsage.length === 0) return
    const notifications = generateSmartNotifications(recentTransactions, accounts, goals, {
      budgets: budgetsWithUsage,
      subscriptions,
    })
    for (const n of notifications) {
      if (shownBudgetNotifications.current.has(n.id)) continue
      if (n.type === "budget_exceeded" || n.type === "budget_near_limit") {
        shownBudgetNotifications.current.add(n.id)
        showToast({
          title: n.title,
          body: n.body,
          type: n.type === "budget_exceeded" ? "warning" : "info",
          duration: 5000,
        })
      }
    }
  }, [isReady, budgetsWithUsage, recentTransactions, accounts, goals, subscriptions])

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
    <><MobilePageShell>
        <Header />

        <div className="motion-list mt-5 flex flex-col gap-5">
          <BalanceCard />
          <QuickActions />

          {accounts.length === 0 && recentTransactions.length === 0 && (
            <ActivationPanel />
          )}

          <div>
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

          <AccountsList />

          {isPro ? (
            <CalendarPreviewCard />
          ) : null}

          <TransactionsList />

          {dashboardInsights.length > 0 && (
            <div className="flex flex-col gap-2">
              {dashboardInsights.map((insight, index) => {
                const Icon = insightIcon[insight.type]
                return (
                  <div key={`${insight.title}-${index}`} className={`rounded-2xl border p-3 ${insightStyles[insight.type]}`}>
                    <div className="flex items-start gap-3">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                      <div className="min-w-0 flex-1">
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

    </MobilePageShell>

      <AnimatePresence>
        {showCreditReminder && creditWarnings[activeWarningIndex] && (
          <motion.div
            key="credit-reminder"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[--z-overlay] flex min-h-dvh items-center justify-center bg-foreground/80 p-6 backdrop-blur-[6px] dark:bg-black/80"
            onClick={closeCreditReminder}
          >
            <motion.div
              key="card"
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: "spring", damping: 26, stiffness: 280, mass: 0.8 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-[1.6rem] border border-border/70 bg-card/96 p-6 shadow-[var(--shadow-float)] backdrop-blur-2xl"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                <TriangleAlert className="h-6 w-6 text-amber-500" />
              </div>
              <p className="text-lg font-bold text-foreground">{creditWarnings[activeWarningIndex].title}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{creditWarnings[activeWarningIndex].message}</p>
              <Button className="mt-6 h-12 w-full rounded-xl text-sm font-bold" onClick={closeCreditReminder}>Entendido</Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <PlanSelectorSheet open={showWelcomePlanPrompt} onOpenChange={setShowWelcomePlanPrompt} welcome />
      <PlanSelectorSheet open={planningUpsellOpen} onOpenChange={setPlanningUpsellOpen} reasonTitle="Planificación Pro" reasonBody="Desbloquea presupuestos, calendario y deudas con Pro." />

    {!showWelcomePlanPrompt && !planningUpsellOpen && <CoachIAWidget />}
    </>
  )
}
