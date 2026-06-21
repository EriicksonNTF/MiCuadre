import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { DEFAULT_PLAN } from "@/lib/entitlements/entitlements"
import { normalizePlanTier } from "@/lib/billing/plans"
import type { BillingSubscriptionStatus, PlanTier } from "@/types/billing"

// Statuses to consider when looking up a user's latest subscription.
// Note: "canceled" is intentionally excluded — canceled subs are handled
// by isSubscriptionEntitled() which correctly denies them entitlement.
const BILLING_ACTIVE_STATUSES: BillingSubscriptionStatus[] = [
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "incomplete",
]

function isSubscriptionEntitled(input: {
  status: BillingSubscriptionStatus | null | undefined
  currentPeriodEnd: string | null | undefined
}) {
  if (!input.status) return false
  if (input.status === "active" || input.status === "trialing") return true
  if (input.status === "past_due" || input.status === "unpaid" || input.status === "incomplete") {
    if (!input.currentPeriodEnd) return false
    return new Date(input.currentPeriodEnd).getTime() > Date.now()
  }
  return false
}

export function mapBillingStatusToPlanStatus(status: string | null | undefined): BillingSubscriptionStatus | "active" {
  if (!status) return "active"
  if (status === "active") return "active"
  if (status === "trialing") return "trialing"
  if (status === "past_due") return "past_due"
  if (status === "unpaid") return "unpaid"
  if (status === "incomplete") return "incomplete"
  if (status === "canceled") return "canceled"
  return "active"
}

export async function getActiveBillingSubscription(userId: string) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("billing_subscriptions")
    .select("id, user_id, plan_tier, status, current_period_start, current_period_end, cancel_at_period_end, updated_at")
    .eq("user_id", userId)
    .in("status", BILLING_ACTIVE_STATUSES)
    .order("current_period_end", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function syncUserPlanFromBilling(userId: string) {
  const supabase = createAdminClient()
  const latestSubscription = await getActiveBillingSubscription(userId)
  const entitled = isSubscriptionEntitled({
    status: latestSubscription?.status as BillingSubscriptionStatus | undefined,
    currentPeriodEnd: latestSubscription?.current_period_end,
  })
  const subscription = entitled ? latestSubscription : null

  const planTier: PlanTier = normalizePlanTier(subscription?.plan_tier as string | undefined) || DEFAULT_PLAN
  const planStatus = mapBillingStatusToPlanStatus(latestSubscription?.status)

  const profileUpdate = subscription
    ? {
        plan_tier: planTier,
        plan_status: planStatus,
        billing_ready: true,
      }
    : {
        plan_tier: DEFAULT_PLAN,
        plan_status: latestSubscription ? planStatus : "active",
        billing_ready: true,
      }

  const { data, error } = await supabase
    .from("profiles")
    .update(profileUpdate)
    .eq("id", userId)
    .select("id, plan_tier, plan_status, billing_ready")
    .single()

  if (error) {
    console.error("[billing-sync] failed", { userId })
    throw error
  }

  console.info("[billing-sync] completed", {
    userId,
    planTier: data.plan_tier,
    planStatus: data.plan_status,
    syncedFromBilling: Boolean(subscription),
  })

  return {
    profile: data,
    subscription,
    syncedFromBilling: Boolean(subscription),
  }
}
