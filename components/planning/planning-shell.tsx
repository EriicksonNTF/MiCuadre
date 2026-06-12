"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { BudgetsTab } from "@/components/planning/budgets-tab"
import { FinancialCalendarTab } from "@/components/planning/financial-calendar-tab"
import { DebtsTab } from "@/components/planning/debts-tab"
import { PlanningProLockScreen } from "@/components/planning/planning-pro-lock-screen"
import { useEntitlements } from "@/hooks/use-entitlements"
import { MobilePageShell } from "@/components/ui/mobile-foundation"

type PlanningTab = "budgets" | "calendar" | "debts"

export function PlanningShell() {
  const router = useRouter()
  const { canAccessPlanningFull } = useEntitlements()
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
    <MobilePageShell fullBleed>
      <div className="sticky top-0 z-20 border-b border-border/55 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto max-w-md">
          <div className="px-5 py-4">
            <p className="section-kicker">Tu mes</p>
            <h1 className="truncate text-base font-black tracking-tight text-foreground">Planificación</h1>
            <p className="truncate text-xs text-muted-foreground">Presupuestos, pagos y deudas en un solo radar.</p>
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
          <div className="motion-list mx-auto max-w-md space-y-4 px-5 py-4 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            {tab === "budgets" && <BudgetsTab />}
            {tab === "calendar" && <FinancialCalendarTab />}
            {tab === "debts" && <DebtsTab />}
          </div>
        )}
      </main>
    </MobilePageShell>
  )
}
