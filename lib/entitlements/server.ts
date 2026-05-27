import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { normalizePlanTier } from "@/lib/billing/plans"
import { DEFAULT_PLAN, ENTITLEMENTS_BY_PLAN } from "@/lib/entitlements/entitlements"
import type { FeatureKey, PlanTier } from "@/types/billing"

export async function getUserPlanServer(userId: string): Promise<PlanTier> {
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("profiles")
    .select("plan_tier")
    .eq("id", userId)
    .maybeSingle()

  return normalizePlanTier((profile as any)?.plan_tier as string | undefined) || DEFAULT_PLAN
}

export async function requireFeature(userId: string, feature: FeatureKey) {
  const plan = await getUserPlanServer(userId)
  const config = ENTITLEMENTS_BY_PLAN[plan] || ENTITLEMENTS_BY_PLAN[DEFAULT_PLAN]

  const allowed = feature in config ? Boolean((config as any)[feature]) || (config as any)[feature] === "unlimited" || (typeof (config as any)[feature] === "number" && (config as any)[feature] > 0) : false

  return {
    allowed,
    plan,
    config,
  }
}
