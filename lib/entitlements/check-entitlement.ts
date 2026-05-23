import { createClient } from "@/lib/supabase/server"
import { blockedEntitlement, DEFAULT_PLAN, ENTITLEMENTS_BY_PLAN } from "@/lib/entitlements/entitlements"
import { normalizePlanTier } from "@/lib/billing/plans"
import type { FeatureKey, PlanTier } from "@/types/billing"

export type EntitlementCheckResult = {
  allowed: boolean
  feature: FeatureKey
  plan: PlanTier
  reason?: string
  currentUsage?: number
  limit?: number
  requiredPlan?: "pro" | "plus"
}

export async function checkEntitlement(userId: string, feature: FeatureKey): Promise<EntitlementCheckResult> {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_tier")
    .eq("id", userId)
    .maybeSingle()

  const plan = normalizePlanTier(profile?.plan_tier as string | null) || DEFAULT_PLAN
  const config = ENTITLEMENTS_BY_PLAN[plan] || ENTITLEMENTS_BY_PLAN[DEFAULT_PLAN]

  if (feature === "max_accounts") {
    if (config.max_accounts === "unlimited") return { allowed: true, feature, plan }
    const { count } = await supabase
      .from("accounts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
    const current = Number(count || 0)
    return current < config.max_accounts
      ? { allowed: true, feature, plan }
      : { ...blockedEntitlement({ feature, reason: "Alcanzaste el límite de tu plan Free.", currentUsage: current, limit: config.max_accounts }), plan }
  }

  if (feature === "max_goals") {
    if (config.max_goals === "unlimited") return { allowed: true, feature, plan }
    const { count } = await supabase
      .from("goals")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
    const current = Number(count || 0)
    return current < config.max_goals
      ? { allowed: true, feature, plan }
      : { ...blockedEntitlement({ feature, reason: "Alcanzaste el límite de tu plan Free.", currentUsage: current, limit: config.max_goals }), plan }
  }

  if (feature === "financial_subscriptions") {
    if (config.financial_subscriptions === "unlimited") {
      return { allowed: true, feature, plan }
    }
    const { count } = await supabase
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)

    const current = count || 0
    return current < config.financial_subscriptions
      ? { allowed: true, feature, plan }
      : { ...blockedEntitlement({ feature, reason: "Llegaste al límite de suscripciones financieras de tu plan.", currentUsage: current, limit: config.financial_subscriptions }), plan }
  }

  const allowed = Boolean(config[feature as "advanced_reports" | "exports" | "mia_advanced"])
  return allowed
    ? { allowed: true, feature, plan }
    : { ...blockedEntitlement({ feature, reason: "Esta función estará disponible en Pro y Plus." }), plan }
}
