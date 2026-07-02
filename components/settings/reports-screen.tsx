"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { AlertCircle, CheckCircle2, ChevronLeft, Info, TriangleAlert } from "lucide-react"
import { format, subDays } from "date-fns"
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis, YAxis } from "recharts"
import { useAccounts, useCategories, useFinancialSubscriptions, useTransactions } from "@/hooks/use-data"
import { useDebtsSummary, useFinancialCalendarSummary, usePlanningSummary } from "@/hooks/use-planning"
import { formatCurrency } from "@/lib/data"
import { useTranslations } from "@/lib/i18n/use-translations"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { generateFinancialInsights } from "@/lib/insights"
import { useEntitlements } from "@/hooks/use-entitlements"
import { FeatureGate } from "@/components/entitlements/feature-gate"
import { MobilePageShell } from "@/components/ui/mobile-foundation"
import { PlanBadge } from "@/components/entitlements/plan-badge"
import { getEntitlementCopy } from "@/lib/entitlements/entitlement-copy"
import { isExcludedFromRealIncome, isInternalTransfer } from "@/lib/transactions/reporting"

type ReportRange = "daily" | "weekly" | "monthly"

export function ReportsScreen() {
  const { t } = useTranslations()
  const [range, setRange] = useState<ReportRange>("monthly")
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all")
  const [accountFilter, setAccountFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [currencyFilter, setCurrencyFilter] = useState<"all" | "DOP" | "USD">("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const { data: transactions = [] } = useTransactions(500)
  const { data: subscriptions = [] } = useFinancialSubscriptions()
  const { data: accounts = [] } = useAccounts()
  const { data: categories = [] } = useCategories()
  const { canUseAdvancedReports, plan } = useEntitlements()
  const { summary: debtsSummary } = useDebtsSummary()
  const { next7Amount, monthCommitted, nextEvent } = useFinancialCalendarSummary()
  const { summary: planningSummary } = usePlanningSummary()
  const advancedReportsCopy = getEntitlementCopy("advanced_reports")

  const dateFrom = useMemo(() => {
    const now = new Date()
    if (range === "daily") return subDays(now, 1)
    if (range === "weekly") return subDays(now, 7)
    return subDays(now, 30)
  }, [range])

  const filtered = useMemo(() => transactions.filter((tx) => {
    const txDate = new Date(`${tx.date}T12:00:00`)
    if (isInternalTransfer(tx.metadata)) return false
    if (isExcludedFromRealIncome(tx.metadata)) return false
    if (startDate && tx.date < startDate) return false
    if (endDate && tx.date > endDate) return false
    if (!startDate && !endDate && txDate < dateFrom) return false
    if (typeFilter !== "all" && tx.type !== typeFilter) return false
    if (accountFilter !== "all" && tx.account_id !== accountFilter) return false
    if (categoryFilter !== "all" && tx.category_id !== categoryFilter) return false
    if (currencyFilter !== "all" && tx.currency !== currencyFilter) return false
    return true
  }), [accountFilter, categoryFilter, currencyFilter, dateFrom, endDate, startDate, transactions, typeFilter])

  const totals = useMemo(() => {
    const income = filtered.filter((tx) => tx.type === "income").reduce((acc, tx) => acc + Number(tx.amount), 0)
    const expense = filtered.filter((tx) => tx.type === "expense").reduce((acc, tx) => acc + Number(tx.amount), 0)
    return { income, expense, net: income - expense }
  }, [filtered])

  const byDay = useMemo(() => {
    const map = new Map<string, { day: string; income: number; expense: number }>()
    filtered.forEach((tx) => {
      const key = tx.date
      if (!map.has(key)) map.set(key, { day: format(new Date(`${key}T12:00:00`), "d MMM"), income: 0, expense: 0 })
      const row = map.get(key)
      if (!row) return
      if (tx.type === "income") row.income += Number(tx.amount)
      if (tx.type === "expense") row.expense += Number(tx.amount)
    })
    return Array.from(map.values())
  }, [filtered])

  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    filtered.filter((tx) => tx.type === "expense").forEach((tx) => {
      const name = tx.category?.name || "Sin categoría"
      map.set(name, (map.get(name) || 0) + Number(tx.amount))
    })
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
  }, [filtered])

  const byAccount = useMemo(() => {
    const map = new Map<string, number>()
    filtered.forEach((tx) => {
      const accountName = tx.account?.name || "Cuenta"
      const signed = tx.type === "income" ? Number(tx.amount) : -Number(tx.amount)
      map.set(accountName, (map.get(accountName) || 0) + signed)
    })
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
  }, [filtered])

  const subscriptionTotal = useMemo(() => {
    const subscriptionCategoryIds = new Set(categories.filter((item) => item.is_subscription).map((item) => item.id))
    return filtered
      .filter((tx) => tx.type === "expense" && (tx.subscription_id || (tx.category_id && subscriptionCategoryIds.has(tx.category_id))))
      .reduce((acc, tx) => acc + Number(tx.amount), 0)
  }, [categories, filtered])

  const topSubscriptions = useMemo(() => {
    const map = new Map<string, number>()
    filtered.filter((tx) => tx.type === "expense" && tx.subscription_id).forEach((tx) => {
      map.set(tx.description || "Suscripción", (map.get(tx.description || "Suscripción") || 0) + Number(tx.amount))
    })
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3)
  }, [filtered])

  const previousFiltered = useMemo(() => {
    const windowDays = range === "daily" ? 1 : range === "weekly" ? 7 : 30
    const previousStart = subDays(dateFrom, windowDays)
    const previousEnd = dateFrom
    return transactions.filter((tx) => {
      const txDate = new Date(`${tx.date}T12:00:00`)
      if (isInternalTransfer(tx.metadata)) return false
      if (isExcludedFromRealIncome(tx.metadata)) return false
      if (txDate < previousStart || txDate >= previousEnd) return false
      if (typeFilter !== "all" && tx.type !== typeFilter) return false
      if (accountFilter !== "all" && tx.account_id !== accountFilter) return false
      if (categoryFilter !== "all" && tx.category_id !== categoryFilter) return false
      if (currencyFilter !== "all" && tx.currency !== currencyFilter) return false
      return true
    })
  }, [accountFilter, categoryFilter, currencyFilter, dateFrom, range, transactions, typeFilter])

  const previousTotals = useMemo(() => {
    const income = previousFiltered.filter((tx) => tx.type === "income").reduce((acc, tx) => acc + Number(tx.amount), 0)
    const expense = previousFiltered.filter((tx) => tx.type === "expense").reduce((acc, tx) => acc + Number(tx.amount), 0)
    return { income, expense, net: income - expense }
  }, [previousFiltered])

  const savingsRate = totals.income > 0 ? ((totals.net / totals.income) * 100) : 0
  const netVsPrevious = totals.net - previousTotals.net
  const topCategory = byCategory.slice().sort((a, b) => b.value - a.value)[0] || null
  const mostExpensiveSubscription = subscriptions.slice().sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))[0] || null

  const insights = useMemo(() => generateFinancialInsights({
    transactions: filtered,
    previousTransactions: previousFiltered,
    accounts,
    subscriptions,
  }), [accounts, filtered, previousFiltered, subscriptions])

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

  const PIE_COLORS = ["#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#8b5cf6"]

  return (
    <MobilePageShell fullBleed className="pb-nav-safe">
      <div className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto max-w-md px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/settings" className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"><ChevronLeft className="h-5 w-5 text-foreground" /></Link>
            <h1 className="text-lg font-semibold text-foreground">{t.reports.title}</h1>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-md space-y-4 px-6 pt-6">
        <div className="flex gap-2 rounded-2xl bg-card p-1">
          {(["daily", "weekly", "monthly"] as const).map((item) => (
            <button type="button" key={item} onClick={() => setRange(item)} className={`flex-1 rounded-xl py-2 text-sm ${range === item ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{t.common[item]}</button>
          ))}
        </div>

        <div className="flex gap-2 rounded-2xl bg-card p-1">
          {(["all", "income", "expense"] as const).map((item) => (
            <button type="button" key={item} onClick={() => setTypeFilter(item)} className={`flex-1 rounded-xl py-2 text-xs ${typeFilter === item ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{t.common[item]}</button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-card p-3">
          <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-xs" />
          <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-xs" />
          <select value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-xs">
            <option value="all">{t.reports.allAccounts}</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-xs">
            <option value="all">{t.reports.allCategories}</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <select value={currencyFilter} onChange={(event) => setCurrencyFilter(event.target.value as "all" | "DOP" | "USD")} className="col-span-2 h-10 rounded-xl border border-border bg-background px-3 text-xs">
            <option value="all">{t.reports.allCurrencies}</option>
            <option value="DOP">DOP</option>
            <option value="USD">USD</option>
          </select>
        </div>

        <div className="space-y-2">
          <div className="mb-1">
            <PlanBadge plan={plan} />
          </div>
          {insights.map((insight, index) => {
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

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-card p-4"><p className="text-xs text-muted-foreground">{t.common.income}</p><p className="amount-inline font-bold text-income">{formatCurrency(totals.income)}</p></div>
          <div className="rounded-2xl bg-card p-4"><p className="text-xs text-muted-foreground">{t.common.expense}</p><p className="amount-inline font-bold text-expense">{formatCurrency(totals.expense)}</p></div>
          <div className="rounded-2xl bg-card p-4"><p className="text-xs text-muted-foreground">{t.reports.netBalance}</p><p className="amount-inline font-bold text-foreground">{formatCurrency(totals.net)}</p></div>
          <div className="rounded-2xl bg-card p-4"><p className="text-xs text-muted-foreground">{t.reports.subscriptions}</p><p className="amount-inline font-bold text-amber-600">{formatCurrency(subscriptionTotal)}</p></div>
        </div>

        <section className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-semibold text-foreground">Resumen del mes</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div><p className="text-xs text-muted-foreground">Ingreso total</p><p className="amount-inline font-bold text-income">{formatCurrency(totals.income)}</p></div>
            <div><p className="text-xs text-muted-foreground">Gasto total</p><p className="amount-inline font-bold text-expense">{formatCurrency(totals.expense)}</p></div>
            <div><p className="text-xs text-muted-foreground">Balance neto</p><p className="amount-inline font-bold text-foreground">{formatCurrency(totals.net)}</p></div>
            <div><p className="text-xs text-muted-foreground">Tasa de ahorro</p><p className="amount-sm font-semibold text-foreground">{Number.isFinite(savingsRate) ? `${savingsRate.toFixed(1)}%` : "0%"}</p></div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{netVsPrevious >= 0 ? `Este mes vas ${formatCurrency(Math.abs(netVsPrevious))} por encima del mes anterior.` : `Este mes vas ${formatCurrency(Math.abs(netVsPrevious))} por debajo del mes anterior.`}</p>
        </section>

        {filtered.length === 0 ? (
          <div className="rounded-2xl bg-card p-8 text-center text-sm text-muted-foreground">{t.reports.noData}</div>
        ) : (
          <>
            <div className="rounded-2xl bg-card p-4">
              <p className="mb-3 text-sm font-semibold text-foreground">{t.reports.moneyFlow}</p>
              <div className="w-full overflow-hidden">
              <ChartContainer
                className="h-56 w-full max-w-full"
                config={{ income: { label: "Ingresos", color: "#10b981" }, expense: { label: "Gastos", color: "#ef4444" } }}
              >
                <LineChart data={byDay}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} minTickGap={24} interval="preserveStartEnd" />
                  <YAxis width={36} tickLine={false} axisLine={false} tickFormatter={(value) => String(Math.round(Number(value) / 1000)).concat("k")} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line dataKey="income" stroke="var(--color-income)" strokeWidth={2} dot={false} />
                  <Line dataKey="expense" stroke="var(--color-expense)" strokeWidth={2} dot={false} />
                </LineChart>
              </ChartContainer>
              </div>
            </div>

            <div className="rounded-2xl bg-card p-4">
              <p className="mb-3 text-sm font-semibold text-foreground">{t.reports.incomeVsExpense}</p>
              <div className="w-full overflow-hidden">
              <ChartContainer className="h-52 w-full max-w-full" config={{ income: { label: "Ingresos", color: "#10b981" }, expense: { label: "Gastos", color: "#ef4444" } }}>
                <BarChart data={byDay}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} minTickGap={24} interval="preserveStartEnd" />
                  <YAxis width={36} tickLine={false} axisLine={false} tickFormatter={(value) => String(Math.round(Number(value) / 1000)).concat("k")} />
                  <Bar dataKey="income" fill="var(--color-income)" radius={8} />
                  <Bar dataKey="expense" fill="var(--color-expense)" radius={8} />
                </BarChart>
              </ChartContainer>
              </div>
            </div>

            <div className="rounded-2xl bg-card p-4">
              <p className="mb-3 text-sm font-semibold text-foreground">{t.reports.topExpenseCategories}</p>
              <div className="w-full overflow-hidden">
              <ChartContainer className="h-52 w-full max-w-full" config={{ value: { label: "Monto", color: "#f59e0b" } }}>
                <PieChart>
                  <Pie data={byCategory.slice(0, 5)} dataKey="value" nameKey="name" innerRadius={32} outerRadius={64}>
                    {byCategory.slice(0, 5).map((entry, index) => (
                      <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                </PieChart>
              </ChartContainer>
              </div>
              <div className="mt-3 space-y-1">
                {byCategory.slice(0, 5).map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                      <span className="text-muted-foreground">{item.name}</span>
                    </div>
                    <span className="font-medium text-foreground">{formatCurrency(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>

            <section className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-semibold text-foreground">Compromisos próximos</p>
              <div className="mt-3 space-y-2 text-sm">
                <p className="flex items-center justify-between"><span className="text-muted-foreground">Próximos 7 días</span><span className="font-semibold">{formatCurrency(next7Amount)}</span></p>
                <p className="flex items-center justify-between"><span className="text-muted-foreground">Comprometido del mes</span><span className="font-semibold">{formatCurrency(monthCommitted)}</span></p>
                <p className="text-xs text-muted-foreground">Próximo evento: {nextEvent ? `${nextEvent.title} · ${nextEvent.due_date}` : "No hay pagos próximos"}</p>
              </div>
            </section>

            <FeatureGate
              allowed={canUseAdvancedReports}
              title={advancedReportsCopy.title}
              description={advancedReportsCopy.shortDescription}
              feature="advanced_reports"
            >
            <div className="rounded-2xl bg-card p-4">
              <p className="mb-3 text-sm font-semibold text-foreground">{t.reports.accountFlow}</p>
              <div className="space-y-2">
                {byAccount.slice(0, 6).map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{item.name}</span>
                    <span className={item.value >= 0 ? "font-medium text-emerald-600 dark:text-emerald-400" : "font-medium text-red-600"}>
                      {item.value >= 0 ? "+" : ""}{formatCurrency(item.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-card p-4">
              <p className="text-sm font-semibold text-foreground">{t.reports.topSubscriptions}</p>
              <div className="mt-2 space-y-2">
                {topSubscriptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t.reports.noSubscriptions}</p>
                ) : topSubscriptions.map(([name, value]) => (
                  <div key={name} className="flex items-center justify-between text-sm">
                    <span>{name}</span>
                    <span className="font-medium">{formatCurrency(value)}</span>
                  </div>
                ))}
              </div>
            </div>

            <section className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-semibold text-foreground">Prioridad de deudas</p>
              <div className="mt-3 space-y-2 text-sm">
                <p className="flex items-center justify-between"><span className="text-muted-foreground">Pendiente DOP</span><span className="font-semibold">{debtsSummary.totalPendingDopLabel}</span></p>
                {debtsSummary.totalPendingUsd > 0 ? <p className="flex items-center justify-between"><span className="text-muted-foreground">Pendiente USD</span><span className="font-semibold">{debtsSummary.totalPendingUsdLabel}</span></p> : null}
                <p className="text-xs text-muted-foreground">{debtsSummary.nextDebt ? `Primero paga ${debtsSummary.nextDebt.name} porque su próxima cuota está cerca.` : "No hay deudas con cuota próxima."}</p>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-semibold text-foreground">Impacto de suscripciones</p>
              <div className="mt-3 space-y-2 text-sm">
                <p className="flex items-center justify-between"><span className="text-muted-foreground">Total mensual</span><span className="font-semibold">{formatCurrency(subscriptionTotal)}</span></p>
                <p className="text-xs text-muted-foreground">Más costosa: {mostExpensiveSubscription ? `${mostExpensiveSubscription.name} · ${formatCurrency(Number(mostExpensiveSubscription.amount || 0), mostExpensiveSubscription.currency as "DOP" | "USD")}` : "Sin suscripciones activas"}</p>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-semibold text-foreground">Planificación</p>
              <div className="mt-3 space-y-2 text-sm">
                <p className="flex items-center justify-between"><span className="text-muted-foreground">Uso presupuestos</span><span className="font-semibold">{planningSummary.budgetUsedLabel}</span></p>
                <p className="text-xs text-muted-foreground">{planningSummary.closestToLimit ? `Categoría en aumento: ${planningSummary.closestToLimit.category_name}` : "No hay presupuestos cercanos al límite"}</p>
                <p className="text-xs text-muted-foreground">Mayor gasto: {topCategory ? `${topCategory.name} · ${formatCurrency(topCategory.value)}` : "Sin datos"}</p>
              </div>
            </section>
            </FeatureGate>
          </>
        )}
      </div>
    </MobilePageShell>
  )
}
