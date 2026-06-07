import "server-only"

import { createClient } from "@/lib/supabase/server"
import { syncUserPlanFromBilling } from "@/lib/billing/sync-billing-state"
import { normalizePlanTier } from "@/lib/billing/plans"
import { DEFAULT_PLAN, ENTITLEMENTS_BY_PLAN } from "@/lib/entitlements/entitlements"
import { isTestFullAccessEmail } from "@/lib/entitlements/test-user"
import { isCoachIAEnabledForEmail } from "@/lib/feature-flags"
import type { PlanTier } from "@/types/billing"

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export type MiaAccessResult = {
  allowed: boolean
  plan: PlanTier
  requiresUpgrade: boolean
}

export const MIA_FORBIDDEN_RESPONSE = {
  error: "Forbidden",
  requiresUpgrade: true,
  message: "MIA requiere Pro",
} as const

export async function assertMiaAccess(
  supabase: SupabaseServerClient,
  user: { id: string; email?: string | null }
): Promise<MiaAccessResult> {
  try {
    await syncUserPlanFromBilling(user.id)
  } catch (err) {
    console.error("[mia-access] syncUserPlanFromBilling failed; continuing with cached plan_tier", {
      userId: user.id,
      error: err instanceof Error ? err.message : String(err),
    })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_tier, email")
    .eq("id", user.id)
    .maybeSingle()

  const cachedPlanTier = (profile as { plan_tier?: string | null } | null)?.plan_tier
  const userEmail =
    (profile as { email?: string | null } | null)?.email || user.email || null

  const plan: PlanTier = isTestFullAccessEmail(userEmail)
    ? "pro"
    : normalizePlanTier(cachedPlanTier) || DEFAULT_PLAN

  const hasMiaEntitlement = ENTITLEMENTS_BY_PLAN[plan].mia_advanced === true
  const allowed = hasMiaEntitlement || isCoachIAEnabledForEmail(userEmail)

  return {
    allowed,
    plan,
    requiresUpgrade: !allowed,
  }
}
