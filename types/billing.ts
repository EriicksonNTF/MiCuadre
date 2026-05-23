// Billing domain types for MiCuadre product plans.
// Independent from financial_subscriptions (user recurring expenses).

export type PlanTier = "free" | "pro" | "plus"

export type PaidPlanTier = Exclude<PlanTier, "free">

export type BillingInterval = "monthly" | "yearly"

export type FeatureKey =
  | "advanced_reports"
  | "exports"
  | "mia_advanced"
  | "financial_subscriptions"
  | "max_accounts"
  | "max_goals"

export type BillingSubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "unpaid"
  | "canceled"
  | "incomplete"

export type EntitlementConfig = {
  max_accounts: number | "unlimited"
  max_goals: number | "unlimited"
  basic_reports: boolean
  advanced_reports: boolean
  exports: boolean
  mia_advanced: boolean
  financial_subscriptions: number | "unlimited"
}

export type UserEntitlements = {
  plan: PlanTier
  status: BillingSubscriptionStatus | "active"
  config: EntitlementConfig
}

export type EntitlementBlockedResponse = {
  allowed: false
  feature: FeatureKey
  reason: string
  currentUsage?: number
  limit?: number
  requiredPlan: PaidPlanTier
}
