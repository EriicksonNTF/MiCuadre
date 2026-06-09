import "server-only"

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { notificationPreferencesSchema } from "@/lib/validations/notifications"

const ALLOWED_KEYS = ["transactions", "budgets", "creditAlerts", "marketing"] as const
type NotificationKey = (typeof ALLOWED_KEYS)[number]

type NotificationPreferences = Record<NotificationKey, boolean>

const DEFAULTS: NotificationPreferences = {
  transactions: true,
  budgets: true,
  creditAlerts: true,
  marketing: false,
}

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const { data, error } = await supabase
      .from("notification_preferences")
      .select("key, value")
      .eq("user_id", user.id)

    if (error) {
      return NextResponse.json({ error: "No se pudieron leer las preferencias" }, { status: 500 })
    }

    const stored = (data || []) as { key: NotificationKey; value: boolean }[]
    const preferences: NotificationPreferences = { ...DEFAULTS }
    for (const row of stored) {
      if (ALLOWED_KEYS.includes(row.key)) {
        preferences[row.key] = Boolean(row.value)
      }
    }

    return NextResponse.json(preferences, { status: 200 })
  } catch (error) {
    console.error("[notification-preferences][GET] failed", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const raw = await request.json().catch(() => null)
    const parsed = notificationPreferencesSchema.safeParse(raw)
    if (!parsed.success) {
      const firstError = parsed.error.errors[0]?.message || "Sin cambios válidos"
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const updates = parsed.data
    const keys = Object.keys(updates) as NotificationKey[]

    if (keys.length === 0) {
      return NextResponse.json({ error: "Sin cambios válidos" }, { status: 400 })
    }

    const rows = keys.map((key) => ({
      user_id: user.id,
      key,
      value: updates[key] as boolean,
    }))

    const { error } = await supabase
      .from("notification_preferences")
      .upsert(rows, { onConflict: "user_id,key" })

    if (error) {
      return NextResponse.json({ error: "No se pudieron guardar las preferencias" }, { status: 500 })
    }

    const next: NotificationPreferences = { ...DEFAULTS, ...updates }
    return NextResponse.json(next, { status: 200 })
  } catch (error) {
    console.error("[notification-preferences][PUT] failed", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
