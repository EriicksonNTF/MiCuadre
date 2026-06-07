import "server-only"

import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

const ALLOWED_KEYS = ["transactions", "budgets", "creditAlerts", "marketing"] as const
type NotificationKey = (typeof ALLOWED_KEYS)[number]

type NotificationPreferences = Record<NotificationKey, boolean>

const DEFAULTS: NotificationPreferences = {
  transactions: true,
  budgets: true,
  creditAlerts: true,
  marketing: false,
}

async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}

function sanitizePreferences(input: unknown): Partial<NotificationPreferences> {
  if (!input || typeof input !== "object") return {}
  const result: Partial<NotificationPreferences> = {}
  for (const key of ALLOWED_KEYS) {
    const value = (input as Record<string, unknown>)[key]
    if (typeof value === "boolean") {
      result[key] = value
    }
  }
  return result
}

export async function GET() {
  try {
    const supabase = await getSupabase()
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
    const supabase = await getSupabase()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const updates = sanitizePreferences(body)
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
