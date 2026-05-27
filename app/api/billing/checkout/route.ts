import "server-only"

import { NextResponse } from "next/server"
import Stripe from "stripe"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { createAdminClient } from "@/lib/supabase/admin"
import { assertServerEnv } from "@/lib/env/server"
import { getUserPlanServer } from "@/lib/entitlements/server"
import type { BillingInterval, PaidPlanTier } from "@/types/billing"

function getStripeClient() {
  const env = assertServerEnv()
  return new Stripe(env.stripeSecretKey)
}

function getPriceIdForCheckout(plan: PaidPlanTier, interval: BillingInterval) {
  const env = assertServerEnv()
  if (plan === "pro" && interval === "monthly") {
    return env.stripeProMonthlyPriceId || env.stripeProPriceId
  }
  return env.stripeProYearlyPriceId || ""
}

function isValidStripePriceId(value: string | null | undefined): value is string {
  return typeof value === "string" && value.startsWith("price_")
}

function isStripeInvalidRequest(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { type?: string }).type === "StripeInvalidRequestError")
}

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
  return data.user || null
}

export async function POST(request: Request) {
  try {
    console.info("[billing-checkout] requested")
    const user = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const currentPlan = await getUserPlanServer(user.id)
    if (currentPlan === "pro") {
      return NextResponse.json({ error: "Tu cuenta ya tiene Pro activo." }, { status: 400 })
    }

    const body = (await request.json().catch(() => ({}))) as { plan?: string; interval?: string }
    if (body.plan !== "pro") {
      return NextResponse.json({ error: "Plan inválido" }, { status: 400 })
    }
    if (body.interval !== "monthly" && body.interval !== "yearly") {
      return NextResponse.json({ error: "Intervalo de facturación inválido" }, { status: 400 })
    }

    const plan = body.plan
    const interval = body.interval
    const priceId = getPriceIdForCheckout(plan, interval)
    if (!isValidStripePriceId(priceId)) {
      return NextResponse.json({ error: "La configuración de pago no está completa." }, { status: 500 })
    }

    const stripe = getStripeClient()
    const admin = createAdminClient()

    const { data: existingCustomer } = await admin
      .from("billing_customers")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle()

    let stripeCustomerId = existingCustomer?.stripe_customer_id || null

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        metadata: { user_id: user.id },
      })
      stripeCustomerId = customer.id

      await admin.from("billing_customers").upsert(
        {
          user_id: user.id,
          stripe_customer_id: stripeCustomerId,
          email: user.email || null,
        },
        { onConflict: "stripe_customer_id" }
      )

      await admin
        .from("profiles")
        .update({ stripe_customer_id: stripeCustomerId, billing_ready: true })
        .eq("id", user.id)
    }

    const origin = new URL(request.url).origin
    const sessionInput: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        user_id: user.id,
        plan,
        interval,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan,
          interval,
        },
      },
      success_url: `${origin}/settings/plan?checkout=success`,
      cancel_url: `${origin}/settings/plan?checkout=cancelled`,
      allow_promotion_codes: true,
    }

    if (assertServerEnv().stripeCheckoutEnablePaypal) {
      sessionInput.payment_method_types = ["card", "paypal"]
    }

    let session: Stripe.Checkout.Session
    try {
      session = await stripe.checkout.sessions.create(sessionInput)
    } catch (error) {
      if (assertServerEnv().stripeCheckoutEnablePaypal && isStripeInvalidRequest(error)) {
        console.warn("[billing-checkout] paypal unavailable, retrying with card", { userId: user.id })
        session = await stripe.checkout.sessions.create({ ...sessionInput, payment_method_types: ["card"] })
      } else {
        throw error
      }
    }

    if (!session.url) {
      return NextResponse.json({ error: "No se pudo crear la sesión de checkout" }, { status: 500 })
    }

    console.info("[billing-checkout] session created", { userId: user.id, plan, interval, sessionId: session.id })

    return NextResponse.json({ url: session.url }, { status: 200 })
  } catch {
    console.error("[billing-checkout] failed")
    return NextResponse.json({ error: "No pudimos iniciar el pago ahora mismo." }, { status: 500 })
  }
}
