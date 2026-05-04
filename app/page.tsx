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

export default function DashboardPage() {
  const router = useRouter()
  const [isReady, setIsReady] = useState(false)
  const { loading } = useAuth()
  const { data: profile, isLoading: profileLoading } = useProfile()

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
    </main>
  )
}
