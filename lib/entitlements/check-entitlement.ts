import { createClient } from "@/lib/supabase/server"
import { blockedEntitlement, DEFAULT_PLAN, ENTITLEMENTS_BY_PLAN } from "@/lib/entitlements/entitlements"
import { normalizePlanTier } from "@/lib/billing/plans"
import { isTestFullAccessEmail } from "@/lib/entitlements/test-user"
import type { FeatureKey, PlanTier } from "@/types/billing"

export type EntitlementCheckResult = {
  allowed: boolean
  feature: FeatureKey
  plan: PlanTier
  reason?: string
  currentUsage?: number
  limit?: number
  requiredPlan?: "pro"
}

export async function checkEntitlement(userId: string, feature: FeatureKey): Promise<EntitlementCheckResult> {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_tier, email")
    .eq("id", userId)
    .maybeSingle()

  const plan = isTestFullAccessEmail((profile as any)?.email)
    ? "pro"
    : normalizePlanTier(profile?.plan_tier as string | null) || DEFAULT_PLAN
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

  if (feature === "max_daily_transactions") {
    if (config.max_daily_transactions === "unlimited") return { allowed: true, feature, plan }
    const today = new Date().toISOString().slice(0, 10)
    const { count } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("date", today)
    const current = Number(count || 0)
    return current < config.max_daily_transactions
      ? { allowed: true, feature, plan }
      : { ...blockedEntitlement({ feature, reason: "Alcanzaste el límite diario del plan Free.", currentUsage: current, limit: config.max_daily_transactions }), plan }
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

  if (feature === "max_budgets") {
    if (config.max_budgets === "unlimited") return { allowed: true, feature, plan }
    const { count } = await supabase
      .from("budgets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_active", true)
    const current = Number(count || 0)
    return current < config.max_budgets
      ? { allowed: true, feature, plan }
      : { ...blockedEntitlement({ feature, reason: "Alcanzaste el límite de presupuestos de tu plan Free.", currentUsage: current, limit: config.max_budgets }), plan }
  }

  if (feature === "max_active_debts") {
    if (config.max_active_debts === "unlimited") return { allowed: true, feature, plan }
    const { count } = await supabase
      .from("debts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_active", true)
    const current = Number(count || 0)
    return current < config.max_active_debts
      ? { allowed: true, feature, plan }
      : { ...blockedEntitlement({ feature, reason: "Alcanzaste el límite de deudas activas de tu plan Free.", currentUsage: current, limit: config.max_active_debts }), plan }
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
      : { ...blockedEntitlement({ feature, reason: "Llegaste al límite de suscripciones del plan Free.", currentUsage: current, limit: config.financial_subscriptions }), plan }
  }

  const allowed = Boolean(config[feature as "advanced_reports" | "exports" | "mia_advanced" | "planning_full"])
  return allowed
    ? { allowed: true, feature, plan }
    : { ...blockedEntitlement({ feature, reason: "Esta función estará disponible en Pro." }), plan }
}
