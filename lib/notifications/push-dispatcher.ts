import "server-only"
import webpush from "web-push"
import { createAdminClient } from "@/lib/supabase/admin"

export interface PushPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
  data?: Record<string, unknown>
  action_url?: string
}

function configureWebPush() {
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
  const vapidSubject = process.env.VAPID_SUBJECT || "mailto:soporte@micuadre.app"

  if (!vapidPrivateKey) {
    throw new Error("VAPID_PRIVATE_KEY is not configured")
  }

  webpush.setVapidDetails(vapidSubject, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, vapidPrivateKey)
}

export async function sendPushNotification(userId: string, payload: PushPayload): Promise<boolean> {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY

  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn("[push] VAPID keys not configured, skipping push notification")
    return false
  }

  try {
    configureWebPush()
  } catch {
    return false
  }

  const supabase = createAdminClient()

  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth, platform")
    .eq("user_id", userId)

  if (error || !subscriptions || subscriptions.length === 0) {
    return false
  }

  const pushPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || "/icons/icon-192x192.png",
    badge: payload.badge || "/icons/badge-72x72.png",
    tag: payload.tag || "micuadre-notification",
    data: {
      url: payload.action_url || "/notifications",
      ...payload.data,
    },
  })

  let successCount = 0
  let failCount = 0

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        pushPayload
      )
      successCount += 1
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)

      // Remove invalid subscriptions (e.g., expired or revoked)
      if (message.includes("410") || message.includes("unsubscribed") || message.includes("expired")) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint)
      }

      failCount += 1
    }
  }

  return successCount > 0
}

export async function sendPushToUserIfHasSubscription(
  userId: string,
  payload: PushPayload
): Promise<{ sent: boolean; reason?: string }> {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY

  if (!vapidPublicKey || !vapidPrivateKey) {
    return { sent: false, reason: "VAPID not configured" }
  }

  const sent = await sendPushNotification(userId, payload)
  return { sent, reason: sent ? undefined : "No subscriptions found or all failed" }
}