"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/dashboard/header"
import { BalanceCard } from "@/components/dashboard/balance-card"
import { AccountsList } from "@/components/dashboard/accounts-list"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { TransactionsList } from "@/components/dashboard/transactions-list"
import { useAuth } from "@/hooks/use-auth"

export default function DashboardPage() {
  const router = useRouter()
  const [isReady, setIsReady] = useState(false)
  const { loading } = useAuth()

  useEffect(() => {
    if (loading) return

    const onboardingCompleted =
      typeof window !== "undefined" &&
      window.localStorage.getItem("onboarding_completed") === "true"

    if (!onboardingCompleted) {
      router.replace("/onboarding")
      return
    }

    setIsReady(true)
  }, [loading, router])

  if (loading || !isReady) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Verificando sesion...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-6 pb-28 pt-8">
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
