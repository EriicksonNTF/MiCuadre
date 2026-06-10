import "server-only"
import { NextResponse } from "next/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { sendPushToUserIfHasSubscription } from "@/lib/notifications/push-dispatcher"

export async function POST(request: Request) {
  const CRON_SECRET = process.env.CRON_SECRET
  const authHeader = request.headers.get("authorization")
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  let body: { user_id?: string; title?: string; body?: string; tag?: string; action_url?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
  }

  const { user_id, title, body: pushBody, tag, action_url } = body

  if (!user_id || !title || !pushBody) {
    return NextResponse.json({ ok: false, error: "Missing required fields: user_id, title, body" }, { status: 400 })
  }

  const result = await sendPushToUserIfHasSubscription(user_id, {
    title,
    body: pushBody,
    tag,
    action_url,
  })

  return NextResponse.json({ ok: true, ...result })
}