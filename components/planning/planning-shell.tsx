"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { BudgetsTab } from "@/components/planning/budgets-tab"
import { FinancialCalendarTab } from "@/components/planning/financial-calendar-tab"
import { DebtsTab } from "@/components/planning/debts-tab"
import { PlanningSummaryCards } from "@/components/planning/planning-summary-cards"
import { useDebtsSummary, useFinancialCalendarSummary, usePlanningSummary } from "@/hooks/use-planning"
import { useProfile } from "@/hooks/use-data"
import { normalizePlanTier } from "@/lib/billing/plans"
import { PlanningProLockScreen } from "@/components/planning/planning-pro-lock-screen"

type PlanningTab = "budgets" | "calendar" | "debts"

function PlanningProContent({ tab, onChangeTab }: { tab: PlanningTab; onChangeTab: (tab: PlanningTab) => void }) {
  const { summary } = usePlanningSummary()
  const { next7Amount, events } = useFinancialCalendarSummary()
  const { summary: debtsSummary } = useDebtsSummary()

  return (
    <>
      <PlanningSummaryCards
        totalBudget={summary.totalBudget}
        totalSpent={summary.totalSpent}
        usagePercentage={summary.usagePercentage}
        closestToLimit={summary.closestToLimit}
        next7Amount={next7Amount}
        events={events}
        debtPendingDop={debtsSummary.totalPendingDop}
        debtPendingUsd={debtsSummary.totalPendingUsd}
      />

      {tab === "budgets" && <BudgetsTab />}
      {tab === "calendar" && <FinancialCalendarTab />}
      {tab === "debts" && <DebtsTab />}
    </>
  )
}

export function PlanningShell() {
  const router = useRouter()
  const { data: profile } = useProfile()
  const isPro = normalizePlanTier((profile as any)?.plan_tier as string | undefined) === "pro"
  const [tab, setTab] = useState<PlanningTab>("calendar")

  useEffect(() => {
    if (typeof window === "undefined") return
    const queryTab = new URLSearchParams(window.location.search).get("tab")
    if (queryTab === "budgets" || queryTab === "calendar" || queryTab === "debts") {
      setTab(queryTab)
    }
  }, [])

  const onChangeTab = (nextTab: PlanningTab) => {
    setTab(nextTab)
    router.replace(`/planning?tab=${nextTab}`)
  }

  return (
    <div className="app-scroll min-h-[100dvh] overflow-y-auto bg-background pb-nav-safe">
      <div className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center gap-4 px-5 py-4">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined" && window.history.length > 1) {
                router.back()
                return
              }
              router.push("/dashboard")
            }}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-base font-bold text-foreground">Planificación</h1>
            <p className="text-xs text-muted-foreground">Controla tus presupuestos, pagos y deudas.</p>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-md space-y-4 px-5 py-4">
        {!isPro ? (
          <PlanningProLockScreen />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-card p-1">
              <button onClick={() => onChangeTab("budgets")} className={`h-10 rounded-xl text-xs font-bold ${tab === "budgets" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Presupuestos</button>
              <button onClick={() => onChangeTab("calendar")} className={`h-10 rounded-xl text-xs font-bold ${tab === "calendar" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Calendario</button>
              <button onClick={() => onChangeTab("debts")} className={`h-10 rounded-xl text-xs font-bold ${tab === "debts" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Deudas</button>
            </div>
            <PlanningProContent tab={tab} onChangeTab={onChangeTab} />
          </>
        )}
      </main>
    </div>
  )
}
