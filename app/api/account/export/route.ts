import "server-only"

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { normalizePlanTier } from "@/lib/billing/plans"
import { isTestFullAccessEmail } from "@/lib/entitlements/test-user"

const CSV_HEADERS = [
  "id",
  "date",
  "type",
  "amount",
  "currency",
  "amount_base",
  "exchange_rate",
  "account_id",
  "category_id",
  "description",
  "notes",
  "is_recurring",
  "created_at",
] as const

function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return ""
  const str = String(value)
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function toCsvRow(values: unknown[]): string {
  return values.map(escapeCsvField).join(",")
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

    if (!isTestFullAccessEmail(user.email)) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("plan_tier")
        .eq("id", user.id)
        .maybeSingle()

      const plan = normalizePlanTier((profile as { plan_tier?: string | null } | null)?.plan_tier)
      if (plan !== "pro") {
        return NextResponse.json(
          { error: "La exportación CSV está disponible en MiCuadre Pro." },
          { status: 403 }
        )
      }
    }

    const { data, error } = await supabase
      .from("transactions")
      .select(
        "id, date, type, amount, currency, amount_base, exchange_rate, account_id, category_id, description, notes, is_recurring, created_at"
      )
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: "No se pudieron leer las transacciones" }, { status: 500 })
    }

    const rows = data || []
    const lines: string[] = [toCsvRow([...CSV_HEADERS])]
    for (const row of rows) {
      lines.push(
        toCsvRow([
          (row as { id: string }).id,
          (row as { date: string }).date,
          (row as { type: string }).type,
          (row as { amount: number }).amount,
          (row as { currency: string }).currency,
          (row as { amount_base: number | null }).amount_base ?? "",
          (row as { exchange_rate: number | null }).exchange_rate ?? "",
          (row as { account_id: string }).account_id,
          (row as { category_id: string | null }).category_id ?? "",
          (row as { description: string | null }).description ?? "",
          (row as { notes: string | null }).notes ?? "",
          (row as { is_recurring: boolean | null }).is_recurring ?? "",
          (row as { created_at: string }).created_at,
        ])
      )
    }

    const csv = lines.join("\r\n")
    const fileNameDate = new Date().toISOString().slice(0, 10)
    const fileName = `micuadre-transacciones-${fileNameDate}.csv`

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("[account-export][GET] failed", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
