"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/dashboard/header"
import { BalanceCard } from "@/components/dashboard/balance-card"
import { AccountsList } from "@/components/dashboard/accounts-list"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { TransactionsList } from "@/components/dashboard/transactions-list"
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { processDueSubscriptions, useProfile } from "@/hooks/use-data"
import { useAccounts, useSubscriptions, useTransactions } from "@/hooks/use-data"
import { BaseModalForm } from "@/components/ui/base-modal-form"
import { Button } from "@/components/ui/button"
import { formatCurrency, getDaysUntilDue, getLocalDateString } from "@/lib/data"
import { generateFinancialInsights } from "@/lib/insights"
import { AppSplash, DashboardLoadingIcon } from "@/components/dashboard/app-splash"

export default function DashboardPage() {
  const router = useRouter()
  const [isReady, setIsReady] = useState(false)
  const [showSplash, setShowSplash] = useState(false)
  const [showCreditReminder, setShowCreditReminder] = useState(false)
  const { loading, user } = useAuth()
  const { data: profile, isLoading: profileLoading } = useProfile()
  const { data: accounts = [] } = useAccounts()
  const { data: subscriptions = [] } = useSubscriptions()
  const { data: recentTransactions = [] } = useTransactions(120)

  useEffect(() => {
    if (loading || profileLoading) return

    const onboardingCompleted = Boolean(profile?.onboarding_completed)

    if (!onboardingCompleted) {
      router.replace("/onboarding")
      return
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem("onboarding_completed", "true")
    }

    setIsReady(true)
  }, [loading, profile?.onboarding_completed, profileLoading, router])

  useEffect(() => {
    if (loading || profileLoading || !profile?.onboarding_completed) return
    if (typeof window === "undefined") return

    const alreadyShown = window.sessionStorage.getItem("micuadre_splash_seen") === "true"
    if (alreadyShown) return

    setShowSplash(true)
    const timer = window.setTimeout(() => {
      setShowSplash(false)
      window.sessionStorage.setItem("micuadre_splash_seen", "true")
    }, 1600)

    return () => window.clearTimeout(timer)
  }, [loading, profile?.onboarding_completed, profileLoading])

  useEffect(() => {
    if (!user || loading || profileLoading || !isReady) return

    const today = getLocalDateString()
    const key = `credit_reminder_seen_${user.id}_${today}`
    const alreadySeen = typeof window !== "undefined" && window.localStorage.getItem(key) === "true"
    if (alreadySeen) return

    const hasPendingPayment = accounts.some(
      (account) => account.type === "credit" && Number((account.pending_amount ?? account.current_debt) || 0) > 0 && account.due_date
    )

    if (hasPendingPayment) {
      setShowCreditReminder(true)
    }
  }, [accounts, isReady, loading, profileLoading, user])

  useEffect(() => {
    if (!user || !isReady) return
    processDueSubscriptions().catch(() => {
      // noop
    })
  }, [isReady, user])

  const creditAccounts = accounts.filter(
    (account) => account.type === "credit" && Number((account.pending_amount ?? account.current_debt) || 0) > 0
  )

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
      const today = getLocalDateString()
      const key = `credit_reminder_seen_${user.id}_${today}`
      window.localStorage.setItem(key, "true")
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
      <div className="mx-auto max-w-md px-6 pb-nav-safe pt-8">
        <Header />

        <div className="mt-10">
          <BalanceCard />
        </div>

        <div className="mt-8">
          <QuickActions />
        </div>

        <div className="mt-10">
          <AccountsList />
        </div>

        <div className="mt-10">
          <TransactionsList />
        </div>

        {dashboardInsights.length > 0 && (
          <div className="mt-8 space-y-2">
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

      {showCreditReminder && creditAccounts.length > 0 && (
        <BaseModalForm
          title="Pagos pendientes de tarjeta"
          onClose={closeCreditReminder}
          footer={<Button className="h-12 w-full" onClick={closeCreditReminder}>OK</Button>}
        >
          <div className="space-y-3">
            {creditAccounts.map((account) => (
              <div key={account.id} className="rounded-xl border border-border bg-card p-3">
                <p className="text-sm font-semibold text-foreground">{account.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Monto pendiente: <span className="font-medium text-foreground">{formatCurrency(Number((account.pending_amount ?? account.current_debt) || 0), account.currency)}</span>
                </p>
                {account.due_date && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {getDaysUntilDue(account.due_date)} días restantes para pagar.
                  </p>
                )}
              </div>
            ))}
          </div>
        </BaseModalForm>
      )}
    </main>
  )
}
