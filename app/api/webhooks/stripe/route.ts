import "server-only"

import { NextResponse } from "next/server"
import Stripe from "stripe"
import { createAdminClient } from "@/lib/supabase/admin"
import { syncUserPlanFromBilling } from "@/lib/billing/sync-billing-state"
import { assertServerEnv } from "@/lib/env/server"
import { normalizePlanTier } from "@/lib/billing/plans"
import type { PlanTier } from "@/types/billing"

export const runtime = "nodejs"

function getStripeClient() {
  const env = assertServerEnv()
  return new Stripe(env.stripeSecretKey)
}

function mapStripePriceToPlan(priceId: string | null | undefined): PlanTier {
  const env = assertServerEnv()
  const proPriceIds = [
    env.stripeProMonthlyPriceId,
    env.stripeProYearlyPriceId,
    env.stripeProPriceId,
    env.stripeBusinessPriceId,
  ].filter(Boolean)

  if (!priceId) return "free"
  if (proPriceIds.includes(priceId)) return "pro"
  return "free"
}

function getMetadataUserId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null
  const metadata = (value as { metadata?: Record<string, unknown> }).metadata
  const userId = metadata?.user_id
  return typeof userId === "string" && userId.length > 0 ? userId : null
}

function getCustomerId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null
  const customer = (value as { customer?: unknown }).customer
  return typeof customer === "string" ? customer : null
}

async function findUserIdByStripeCustomer(customerId: string | null) {
  if (!customerId) return null
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("billing_customers")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle()

  return data?.user_id || null
}

async function upsertBillingCustomer(input: { userId: string; customerId: string | null; email: string | null }) {
  if (!input.customerId) return
  const supabase = createAdminClient()
  await supabase.from("billing_customers").upsert(
    {
      user_id: input.userId,
      stripe_customer_id: input.customerId,
      email: input.email,
    },
    { onConflict: "stripe_customer_id" }
  )
}

function toIsoOrNull(unixTime: number | null | undefined) {
  if (!unixTime) return null
  return new Date(unixTime * 1000).toISOString()
}

function getUnixTimestampField(value: unknown, key: string) {
  if (!value || typeof value !== "object") return null
  const field = (value as Record<string, unknown>)[key]
  return typeof field === "number" ? field : null
}

export async function POST(request: Request) {
  const env = assertServerEnv()
  const webhookSecret = env.stripeWebhookSecret
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 })
  }

  const signature = request.headers.get("stripe-signature")
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 })
  }

  const rawBody = await request.text()
  const stripe = getStripeClient()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (error) {
    console.error("[stripe-webhook] invalid signature")
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  console.info("[stripe-webhook] event received", event.type, event.id)
  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from("billing_events")
    .select("id, status")
    .eq("stripe_event_id", event.id)
    .maybeSingle()

  if (existing) {
    console.info("[stripe-webhook] duplicate event skipped", event.id)
    return NextResponse.json({ ok: true, duplicate: true }, { status: 200 })
  }

  const baseObject = event.data.object as unknown
  const customerFromObject = getCustomerId(baseObject)
  const metadataUserId = getMetadataUserId(baseObject)
  const userId = (await findUserIdByStripeCustomer(customerFromObject)) || metadataUserId

  const { data: insertedEvent, error: insertError } = await supabase
    .from("billing_events")
    .insert({
      user_id: userId,
      stripe_event_id: event.id,
      event_type: event.type,
      payload: event,
      status: "processing",
    })
    .select("id")
    .single()

  if (insertError) {
    if (insertError.code === "23505") {
      console.info("[stripe-webhook] duplicate event skipped on insert", event.id)
      return NextResponse.json({ ok: true, duplicate: true }, { status: 200 })
    }
    console.error("[stripe-webhook] failed to insert event", insertError.message)
    return NextResponse.json({ error: "Failed to persist event" }, { status: 500 })
  }

  const eventRowId = insertedEvent.id

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        const checkoutUserId = getMetadataUserId(session)
        const customerId = typeof session.customer === "string" ? session.customer : null
        const email = session.customer_details?.email || session.customer_email || null

        if (checkoutUserId && customerId) {
          await upsertBillingCustomer({ userId: checkoutUserId, customerId, email })
        }
        break
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = typeof subscription.customer === "string" ? subscription.customer : null
        const subscriptionUserId =
          (await findUserIdByStripeCustomer(customerId)) ||
          getMetadataUserId(subscription) ||
          userId

        if (!subscriptionUserId) {
          console.warn("[stripe-webhook] unknown customer for subscription event", event.id)
          break
        }

        const firstItem = subscription.items.data[0]
        const priceId = firstItem?.price?.id || null
        const planTier = normalizePlanTier(mapStripePriceToPlan(priceId))

        if (!priceId) {
          console.warn("[stripe-webhook] missing price id, defaulting plan to free", subscription.id)
        }

        await supabase.from("billing_subscriptions").upsert(
          {
            user_id: subscriptionUserId,
            stripe_subscription_id: subscription.id,
            stripe_price_id: priceId,
            plan_tier: planTier,
            status: subscription.status,
            current_period_start: toIsoOrNull(getUnixTimestampField(subscription, "current_period_start")),
            current_period_end: toIsoOrNull(getUnixTimestampField(subscription, "current_period_end")),
            cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
          },
          { onConflict: "stripe_subscription_id" }
        )

        console.info("[stripe-webhook] subscription synced", subscription.id, subscriptionUserId)
        await syncUserPlanFromBilling(subscriptionUserId)
        console.info("[stripe-webhook] profile synced", subscriptionUserId)
        break
      }

      case "invoice.payment_succeeded":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = typeof invoice.customer === "string" ? invoice.customer : null
        const invoiceUserId =
          (await findUserIdByStripeCustomer(customerId)) ||
          getMetadataUserId(invoice) ||
          userId

        if (!invoiceUserId) {
          console.warn("[stripe-webhook] unknown customer for invoice event", event.id)
          break
        }

        await syncUserPlanFromBilling(invoiceUserId)
        console.info("[stripe-webhook] profile synced from invoice", invoiceUserId)
        break
      }

      default:
        break
    }

    await supabase
      .from("billing_events")
      .update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("id", eventRowId)

    console.info("[stripe-webhook] processed", event.type, event.id)

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error) {
    console.error("[stripe-webhook] failed event", event.id, event.type)
    await supabase
      .from("billing_events")
      .update({ status: "failed", processed_at: new Date().toISOString() })
      .eq("id", eventRowId)

    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}
