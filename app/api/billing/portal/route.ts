import "server-only"

import { NextResponse } from "next/server"
import Stripe from "stripe"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { createAdminClient } from "@/lib/supabase/admin"
import { assertServerEnv } from "@/lib/env/server"
import { API_RATE_LIMIT } from "@/lib/rate-limit"

function getStripeClient() {
  const env = assertServerEnv()
  return new Stripe(env.stripeSecretKey)
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
    console.info("[billing-portal] requested")
    const user = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const rateCheck = API_RATE_LIMIT.billing(user.id)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Intenta de nuevo en un momento." },
        { status: 429, headers: { "Retry-After": String(rateCheck.retryAfterSeconds) } }
      )
    }

    const admin = createAdminClient()
    const stripe = getStripeClient()

    const { data: customer } = await admin
      .from("billing_customers")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle()

    if (!customer?.stripe_customer_id) {
      return NextResponse.json({ error: "No tienes cliente de facturacion activo aun." }, { status: 404 })
    }

    const origin = new URL(request.url).origin
    const portal = await stripe.billingPortal.sessions.create({
      customer: customer.stripe_customer_id,
      return_url: `${origin}/settings/plan`,
    })

    console.info("[billing-portal] session created", { userId: user.id })

    return NextResponse.json({ url: portal.url }, { status: 200 })
  } catch (error) {
    console.error("[billing-portal] failed")
    return NextResponse.json({ error: "No pudimos abrir el portal de facturacion." }, { status: 500 })
  }
}
