"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { CalendarDays, ChevronLeft, CreditCard, PiggyBank } from "lucide-react"
import { BudgetsTab } from "@/components/planning/budgets-tab"
import { FinancialCalendarTab } from "@/components/planning/financial-calendar-tab"
import { DebtsTab } from "@/components/planning/debts-tab"
import { PlanningSummaryCards } from "@/components/planning/planning-summary-cards"
import { useDebtsSummary, useFinancialCalendarSummary, usePlanningSummary } from "@/hooks/use-planning"
import { PlanningProLockScreen } from "@/components/planning/planning-pro-lock-screen"
import { useEntitlements } from "@/hooks/use-entitlements"

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
    <div className="app-scroll min-h-[100dvh] overflow-y-auto bg-background pb-nav-safe">
      <div className="sticky top-0 z-20 border-b border-border/55 bg-background/88 backdrop-blur-xl">
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
      </div>

      <main className="motion-list mx-auto max-w-md space-y-4 px-5 py-4">
        {!canAccessPlanningFull ? (
          <PlanningProLockScreen />
        ) : (
          <>
            <section className="relative overflow-hidden rounded-[1.8rem] bg-foreground p-4 text-background shadow-[0_24px_60px_-32px_rgba(0,0,0,0.72)]">
              <div className="absolute -right-12 -top-14 h-40 w-40 rounded-full bg-background/10" />
              <div className="absolute -bottom-20 left-8 h-44 w-44 rounded-full border border-background/10" />
              <div className="relative">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-background/55">Centro de mando</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight">Planifica antes de gastar</h2>
                <p className="mt-1 text-sm leading-6 text-background/68">Mira límites, pagos próximos y deudas antes de mover dinero.</p>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-2xl bg-background/10 p-3">
                    <PiggyBank className="h-4 w-4 text-emerald-200" />
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-background/60">Presupuesto</p>
                  </div>
                  <div className="rounded-2xl bg-background/10 p-3">
                    <CalendarDays className="h-4 w-4 text-sky-200" />
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-background/60">Calendario</p>
                  </div>
                  <div className="rounded-2xl bg-background/10 p-3">
                    <CreditCard className="h-4 w-4 text-amber-200" />
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-background/60">Deudas</p>
                  </div>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-3 gap-2 rounded-[1.45rem] border border-border/70 bg-card/82 p-1 shadow-sm backdrop-blur">
              <button type="button" onClick={() => onChangeTab("budgets")} className={`tap-lift h-11 rounded-2xl text-xs font-bold ${tab === "budgets" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`}>Presupuestos</button>
              <button type="button" onClick={() => onChangeTab("calendar")} className={`tap-lift h-11 rounded-2xl text-xs font-bold ${tab === "calendar" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`}>Calendario</button>
              <button type="button" onClick={() => onChangeTab("debts")} className={`tap-lift h-11 rounded-2xl text-xs font-bold ${tab === "debts" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`}>Deudas</button>
            </div>
            <PlanningProContent tab={tab} onChangeTab={onChangeTab} />
          </>
        )}
      </main>
    </div>
  )
}
