import type { EntitlementBlockedResponse, EntitlementConfig, FeatureKey, PaidPlanTier, PlanTier } from "@/types/billing"

export const ENTITLEMENTS_BY_PLAN: Record<PlanTier, EntitlementConfig> = {
  free: {
    max_accounts: 3,
    max_goals: 2,
    basic_reports: true,
    advanced_reports: false,
    exports: false,
    mia_advanced: false,
    financial_subscriptions: 0,
  },
  pro: {
    max_accounts: "unlimited",
    max_goals: "unlimited",
    basic_reports: true,
    advanced_reports: true,
    exports: true,
    mia_advanced: true,
    financial_subscriptions: 10,
  },
  plus: {
    max_accounts: "unlimited",
    max_goals: "unlimited",
    basic_reports: true,
    advanced_reports: true,
    exports: true,
    mia_advanced: true,
    financial_subscriptions: "unlimited",
  },
}

export const DEFAULT_PLAN: PlanTier = "free"

export function blockedEntitlement(input: {
  feature: FeatureKey
  reason: string
  currentUsage?: number
  limit?: number
  requiredPlan?: PaidPlanTier
}): EntitlementBlockedResponse {
  return {
    allowed: false,
    feature: input.feature,
    reason: input.reason,
    currentUsage: input.currentUsage,
    limit: input.limit,
    requiredPlan: input.requiredPlan ?? "pro",
  }
}
