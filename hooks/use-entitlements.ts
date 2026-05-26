"use client"

import { useMemo } from "react"
import { useAccounts, useFinancialSubscriptions, useGoals, useProfile } from "@/hooks/use-data"
import { DEFAULT_PLAN, ENTITLEMENTS_BY_PLAN } from "@/lib/entitlements/entitlements"
import { normalizePlanTier } from "@/lib/billing/plans"
import type { PlanTier } from "@/types/billing"

export function useEntitlements() {
  const { data: profile } = useProfile()
  const { data: accounts = [] } = useAccounts()
  const { data: goals = [] } = useGoals()
  const { data: subscriptions = [] } = useFinancialSubscriptions()

  const plan = normalizePlanTier((profile as any)?.plan_tier as string | undefined) || DEFAULT_PLAN
  const limits = ENTITLEMENTS_BY_PLAN[plan] || ENTITLEMENTS_BY_PLAN[DEFAULT_PLAN]

  return useMemo(() => {
    const canCreateAccount = limits.max_accounts === "unlimited" || accounts.length < limits.max_accounts
    const canCreateGoal = limits.max_goals === "unlimited" || goals.length < limits.max_goals
    const canUseFinancialSubscriptions = limits.financial_subscriptions === "unlimited" || subscriptions.length < limits.financial_subscriptions

    return {
      plan,
      isFree: plan === "free",
      isPro: plan === "pro",
      canCreateAccount,
      canCreateGoal,
      canUseAdvancedReports: limits.advanced_reports,
      canUseMIAAdvanced: limits.mia_advanced,
      canExport: limits.exports,
      canUseFinancialSubscriptions,
      usage: {
        accounts: accounts.length,
        goals: goals.length,
        subscriptions: subscriptions.length,
      },
      limits,
    }
  }, [accounts.length, goals.length, limits, plan, subscriptions.length])
}
