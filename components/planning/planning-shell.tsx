"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { BudgetsTab } from "@/components/planning/budgets-tab"
import { FinancialCalendarTab } from "@/components/planning/financial-calendar-tab"
import { DebtsTab } from "@/components/planning/debts-tab"
import { PlanningSummaryCards } from "@/components/planning/planning-summary-cards"
import { useDebtsSummary, useFinancialCalendarSummary, usePlanningSummary } from "@/hooks/use-planning"
import { PlanningProLockScreen } from "@/components/planning/planning-pro-lock-screen"
import { useEntitlements } from "@/hooks/use-entitlements"
import { MobilePageShell } from "@/components/ui/mobile-foundation"

type PlanningTab = "budgets" | "calendar" | "debts"

export function PlanningShell() {
  const router = useRouter()
  const { canAccessPlanningFull } = useEntitlements()
  const [tab, setTab] = useState<PlanningTab>("calendar")
  const { summary } = usePlanningSummary()
  const { next7Amount, events } = useFinancialCalendarSummary()
  const { summary: debtsSummary } = useDebtsSummary()

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
    <MobilePageShell fullBleed>
      <div className="sticky top-0 z-20 border-b border-border/55 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto max-w-md">
          <div className="flex items-center gap-4 px-5 py-4">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined" && window.history.length > 1) {
                  router.back()
                  return
                }
                router.push("/dashboard")
              }}
              className="tap-lift flex h-10 w-10 items-center justify-center rounded-full bg-muted/85"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="section-kicker">Tu mes</p>
              <h1 className="truncate text-base font-black tracking-tight text-foreground">Planificación</h1>
              <p className="truncate text-xs text-muted-foreground">Presupuestos, pagos y deudas en un solo radar.</p>
            </div>
          </div>
          {canAccessPlanningFull && (
            <div className="border-t border-border/20 px-5 pb-3 pt-3">
              <div className="grid grid-cols-3 gap-2 rounded-[1.45rem] border border-border/70 bg-card/82 p-1 shadow-sm backdrop-blur">
                <button type="button" onClick={() => onChangeTab("budgets")} className={`tap-lift h-11 rounded-2xl text-xs font-bold ${tab === "budgets" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`}>Presupuestos</button>
                <button type="button" onClick={() => onChangeTab("calendar")} className={`tap-lift h-11 rounded-2xl text-xs font-bold ${tab === "calendar" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`}>Calendario</button>
                <button type="button" onClick={() => onChangeTab("debts")} className={`tap-lift h-11 rounded-2xl text-xs font-bold ${tab === "debts" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`}>Deudas</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <main>
        {!canAccessPlanningFull ? (
          <div className="mx-auto max-w-md px-5 py-4">
            <PlanningProLockScreen />
          </div>
        ) : (
          <div className="motion-list mx-auto max-w-md space-y-4 px-5 py-4">
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
          </div>
        )}
      </main>
    </MobilePageShell>
  )
}
