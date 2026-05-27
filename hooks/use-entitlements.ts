"use client"

import { useMemo } from "react"
import { useAccounts, useFinancialSubscriptions, useProfile } from "@/hooks/use-data"
import { DEFAULT_PLAN, ENTITLEMENTS_BY_PLAN } from "@/lib/entitlements/entitlements"
import { normalizePlanTier } from "@/lib/billing/plans"

export function useEntitlements() {
  const { data: profile } = useProfile()
  const { data: accounts = [] } = useAccounts()
  const { data: subscriptions = [] } = useFinancialSubscriptions()

  const plan = normalizePlanTier((profile as any)?.plan_tier as string | undefined) || DEFAULT_PLAN
  const limits = ENTITLEMENTS_BY_PLAN[plan] || ENTITLEMENTS_BY_PLAN[DEFAULT_PLAN]

  return useMemo(() => {
    const canCreateAccount = limits.max_accounts === "unlimited" || accounts.length < limits.max_accounts
    const canCreateBudget = limits.max_budgets === "unlimited" || limits.max_budgets > 0
    const canCreateDebt = limits.max_active_debts === "unlimited" || limits.max_active_debts > 0
    const canUseFinancialSubscriptions = limits.financial_subscriptions === "unlimited" || subscriptions.length < limits.financial_subscriptions

    return {
      plan,
      isFree: plan === "free",
      isPro: plan === "pro",
      canCreateAccount,
      canCreateBudget,
      canCreateDebt,
      canUseAdvancedReports: limits.advanced_reports,
      canUseMIAAdvanced: limits.mia_advanced,
      canExport: limits.exports,
      canAccessPlanningFull: limits.planning_full,
      canUseFinancialSubscriptions,
      usage: {
        accounts: accounts.length,
        budgets: 0,
        debts: 0,
        subscriptions: subscriptions.length,
      },
      limits,
    }
  }, [accounts.length, limits, plan, subscriptions.length])
}
