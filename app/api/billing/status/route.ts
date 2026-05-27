import "server-only"

import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { DEFAULT_PLAN } from "@/lib/entitlements/entitlements"
import { syncUserPlanFromBilling } from "@/lib/billing/sync-billing-state"
import { normalizePlanTier } from "@/lib/billing/plans"
import type { BillingSubscriptionStatus, PlanTier } from "@/types/billing"

async function getAuthenticatedUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    }
  )

  const { data } = await supabase.auth.getUser()
  return { user: data.user || null, supabase }
}

export async function GET() {
  try {
    const paypalAvailable = process.env.STRIPE_CHECKOUT_ENABLE_PAYPAL === "true"
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    try {
      await syncUserPlanFromBilling(user.id)
    } catch {
      // Status endpoint must stay resilient; webhook remains source of truth.
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("plan_tier, plan_status, billing_ready")
      .eq("id", user.id)
      .single()

    const { data: subscription } = await supabase
      .from("billing_subscriptions")
      .select("status, current_period_end, cancel_at_period_end, updated_at")
      .eq("user_id", user.id)
      .order("current_period_end", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()

    const { data: latestEvent } = await supabase
      .from("billing_events")
      .select("processed_at, status")
      .eq("user_id", user.id)
      .eq("status", "processed")
      .order("processed_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()

    const planTier = normalizePlanTier((profile as any)?.plan_tier as string | undefined) || DEFAULT_PLAN
    const planStatus = ((profile as any)?.plan_status as BillingSubscriptionStatus | "active" | undefined) || "active"
    const billingReady = Boolean((profile as any)?.billing_ready)
    const billingStatus = (subscription?.status as BillingSubscriptionStatus | "active" | null) || planStatus

    console.info("[billing-status] checked", { userId: user.id, planTier, planStatus, billingStatus })

    return NextResponse.json(
      {
        planTier,
        planStatus,
        billingStatus,
        currentPeriodEnd: subscription?.current_period_end || null,
        cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
        billingReady,
        paypalAvailable,
        lastSyncedAt: latestEvent?.processed_at || subscription?.updated_at || null,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("[billing-status] failed", error)
    return NextResponse.json({ error: "No pudimos verificar tu plan ahora mismo." }, { status: 500 })
  }
}
