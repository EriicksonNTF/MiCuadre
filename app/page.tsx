"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/dashboard/header"
import { BalanceCard } from "@/components/dashboard/balance-card"
import { AccountsList } from "@/components/dashboard/accounts-list"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { TransactionsList } from "@/components/dashboard/transactions-list"
import { useAuth } from "@/hooks/use-auth"
import { useProfile } from "@/hooks/use-data"
import { useAccounts } from "@/hooks/use-data"
import { BaseModalForm } from "@/components/ui/base-modal-form"
import { Button } from "@/components/ui/button"
import { formatCurrency, getDaysUntilDue, getLocalDateString } from "@/lib/data"

export default function DashboardPage() {
  const router = useRouter()
  const [isReady, setIsReady] = useState(false)
  const [showCreditReminder, setShowCreditReminder] = useState(false)
  const { loading, user } = useAuth()
  const { data: profile, isLoading: profileLoading } = useProfile()
  const { data: accounts = [] } = useAccounts()

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

  const creditAccounts = accounts.filter(
    (account) => account.type === "credit" && Number((account.pending_amount ?? account.current_debt) || 0) > 0
  )

  const closeCreditReminder = () => {
    if (user && typeof window !== "undefined") {
      const today = getLocalDateString()
      const key = `credit_reminder_seen_${user.id}_${today}`
      window.localStorage.setItem(key, "true")
    }
    setShowCreditReminder(false)
  }

  if (loading || profileLoading || !isReady) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Verificando sesion...</p>
      </main>
    )
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
