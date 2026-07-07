import "server-only"

import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { assertServerEnv } from "@/lib/env/server"

export async function GET(request: Request) {
  const env = assertServerEnv()
  const CRON_SECRET = process.env.CRON_SECRET

  const authHeader = request.headers.get("authorization")
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data: subscriptions, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("status", "active")

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  const { data: proProfiles } = await supabase
    .from("profiles")
    .select("id, plan_tier")
    .eq("plan_tier", "pro")

  const proUserIds = new Set((proProfiles || []).map((row) => row.id))

  let processed = 0
  let alerts = 0
  let skipped = 0

  for (const subscription of subscriptions || []) {
    if (!proUserIds.has(subscription.user_id)) {
      skipped += 1
      continue
    }

    const dueDate = String(subscription.next_payment_date || "")
    if (!dueDate) {
      skipped += 1
      continue
    }

    const dueMs = new Date(`${dueDate}T12:00:00`).getTime()
    const todayMs = new Date(`${today}T12:00:00`).getTime()
    const diffDays = Math.ceil((dueMs - todayMs) / (1000 * 60 * 60 * 24))

    if (diffDays === 1 && subscription.pre_alert_enabled) {
      const periodKey = `${subscription.id}:${dueDate}:pre-alert`
      if (subscription.last_alert_period !== periodKey) {
        await supabase.from("notifications").insert({
          user_id: subscription.user_id,
          title: "Recordatorio de suscripción",
          message: `Mañana se registrará ${subscription.name} por ${Number(subscription.amount || 0).toLocaleString("es-DO")} ${subscription.currency || "DOP"}.`,
          type: "subscription",
          read: false,
          action_url: "/settings/subscriptions",
          metadata: { kind: "subscription_pre_alert", period_key: periodKey, subscription_id: subscription.id },
        })

        await supabase
          .from("subscriptions")
          .update({ last_alert_period: periodKey })
          .eq("id", subscription.id)

        alerts += 1
      }
    }

    if (!subscription.auto_record_enabled || dueDate > today) {
      skipped += 1
      continue
    }

    const periodKey = `${subscription.id}:${dueDate}`
    if (subscription.last_processed_period === periodKey) {
      skipped += 1
      continue
    }

    const accountId = subscription.linked_account_id || subscription.account_id || subscription.linked_credit_card_id
    if (!accountId) {
      skipped += 1
      continue
    }

    const amount = Number(subscription.amount || 0)
    if (amount <= 0) {
      skipped += 1
      continue
    }

    const { data: account } = await supabase
      .from("accounts")
      .select("id,type,balance,currency,current_debt,current_debt_dop,current_debt_usd")
      .eq("id", accountId)
      .maybeSingle()

    if (!account) {
      skipped += 1
      continue
    }

    if (account.type !== "credit" && Number(account.balance || 0) < amount) {
      await supabase.from("notifications").insert({
        user_id: subscription.user_id,
        title: "No pudimos registrar una suscripción",
        message: `No pudimos registrar ${subscription.name} por fondos insuficientes.`,
        type: "subscription",
        read: false,
        action_url: "/settings/subscriptions",
        metadata: { kind: "subscription_auto_failed", period_key: periodKey, subscription_id: subscription.id },
      })
      skipped += 1
      continue
    }

    const txMetadata: Record<string, unknown> = {
      kind: "subscription_auto_charge",
      period_key: periodKey,
      subscription_id: subscription.id,
      auto_record: true,
    }

    const { error: txError } = await supabase.from("transactions").insert({
      user_id: subscription.user_id,
      account_id: account.id,
      category_id: subscription.category_id,
      type: "expense",
      amount,
      currency: subscription.currency || account.currency || "DOP",
      amount_base: amount,
      exchange_rate: 1,
      description: subscription.name,
      date: today,
      notes: "Registro automático de suscripción",
      is_recurring: true,
      metadata: txMetadata,
      subscription_id: subscription.id,
    })

    if (txError) {
      skipped += 1
      continue
    }

    if (account.type === "credit") {
      const nextDebt = Number(account.current_debt || 0) + amount
      await supabase
        .from("accounts")
        .update({
          current_debt: nextDebt,
          current_debt_dop: subscription.currency === "DOP" ? Number(account.current_debt_dop || 0) + amount : Number(account.current_debt_dop || 0),
          current_debt_usd: subscription.currency === "USD" ? Number(account.current_debt_usd || 0) + amount : Number(account.current_debt_usd || 0),
        })
        .eq("id", account.id)
    } else {
      await supabase
        .from("accounts")
        .update({ balance: Number(account.balance || 0) - amount })
        .eq("id", account.id)
    }

    const dueDateObj = new Date(`${dueDate}T12:00:00`)
    const nextDue = new Date(dueDateObj)
    nextDue.setMonth(nextDue.getMonth() + 1)
    const nextDueDate = nextDue.toISOString().slice(0, 10)

    await supabase
      .from("subscriptions")
      .update({
        next_payment_date: nextDueDate,
        last_processed_at: today,
        last_processed_period: periodKey,
      })
      .eq("id", subscription.id)

    await supabase.from("notifications").insert({
      user_id: subscription.user_id,
      title: "Suscripción registrada",
      message: `${subscription.name} se registró automáticamente en MiCuadre.`,
      type: "subscription",
      read: false,
      action_url: "/history",
      metadata: { kind: "subscription_auto_success", period_key: periodKey, subscription_id: subscription.id },
    })

    processed += 1
  }

  return NextResponse.json({ ok: true, processed, alerts, skipped })
}
