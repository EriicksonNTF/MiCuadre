import "server-only"

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { API_RATE_LIMIT } from "@/lib/rate-limit"
import { runMiaPhase1Agent } from "@/lib/mia/agent"
import { isCoachIAEnabledForEmail } from "@/lib/feature-flags"
import { coachRequestSchema } from "@/lib/mia/schemas"
import type { Account, Goal, Transaction } from "@/lib/types/database"

type CoachRequest = {
  message?: string
  confirmAction?: {
    mutationType?: "create_transaction" | "create_goal"
    payload?: Record<string, unknown>
  }
}

async function createTransactionFromDraft(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  payload: Record<string, unknown>
) {
  const amount = Number(payload.amount ?? 0)
  const currency = payload.currency === "USD" ? "USD" : "DOP"
  const category = typeof payload.category === "string" ? payload.category : "Sin categoria"
  const type = payload.type === "income" ? "income" : "expense"

  if (amount <= 0) throw new Error("Monto invalido")

  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("id, balance, type, currency")
    .eq("user_id", userId)
    .in("type", ["cash", "debit"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (accountError) throw accountError
  if (!account) throw new Error("No hay cuenta cash/debit para guardar el movimiento")

  if (type === "expense" && Number(account.balance || 0) < amount) {
    throw new Error("Fondos insuficientes en la cuenta principal")
  }

  const { data: tx, error: txError } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      account_id: account.id,
      category_id: null,
      type,
      amount,
      currency,
      amount_base: amount,
      exchange_rate: 1,
      description: `MIA: ${category}`,
      date: new Date().toISOString().slice(0, 10),
      notes: "Registrado por MIA (confirmado por usuario)",
      is_recurring: false,
      parent_transaction_id: null,
      metadata: { source: "mia_phase3", category_hint: category },
    })
    .select("id")
    .single()

  if (txError) throw txError

  const newBalance = type === "expense"
    ? Number(account.balance || 0) - amount
    : Number(account.balance || 0) + amount

  const { error: accountUpdateError } = await supabase
    .from("accounts")
    .update({ balance: newBalance })
    .eq("id", account.id)

  if (accountUpdateError) {
    await supabase.from("transactions").delete().eq("id", tx.id)
    throw accountUpdateError
  }

  return { txId: tx.id, accountId: account.id }
}

async function createGoalFromDraft(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  payload: Record<string, unknown>
) {
  const name = typeof payload.name === "string" ? payload.name.trim() : ""
  const targetAmount = Number(payload.targetAmount ?? 0)
  const currency = payload.currency === "USD" ? "USD" : "DOP"

  if (name.length < 2 || targetAmount <= 0) throw new Error("Datos de presupuesto invalidos")

  const { data, error } = await supabase
    .from("goals")
    .insert({
      user_id: userId,
      name,
      target_amount: targetAmount,
      current_amount: 0,
      currency,
      target_date: null,
      color: "#14B8A6",
      icon: "target",
      is_completed: false,
    })
    .select("id")
    .single()

  if (error) throw error
  return { goalId: data.id }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const rateCheck = API_RATE_LIMIT.coach(user.id)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Intenta de nuevo en un momento." },
        { status: 429, headers: { "Retry-After": String(rateCheck.retryAfterSeconds) } }
      )
    }

    const body = (await request.json()) as CoachRequest
    const parsed = coachRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Mensaje vacio" }, { status: 400 })
    }
    const message = parsed.data.message?.trim()?.replace(/<[^>]*>/g, "") || ""

    const toolTrace: string[] = []

    if (!isCoachIAEnabledForEmail(user.email)) {
      return NextResponse.json({ error: "Coach IA no habilitado" }, { status: 403 })
    }

    if (body.confirmAction?.mutationType) {
      if (body.confirmAction.mutationType === "create_transaction") {
        await createTransactionFromDraft(supabase, user.id, body.confirmAction.payload || {})
        return NextResponse.json({
          answer: "Listo, registre tu transaccion correctamente.",
          uiBlocks: [{ type: "kpi_card", title: "Accion completada", value: "Transaccion guardada", tone: "success" }],
          actions: [{ label: "Ver historial", href: "/history", actionType: "navigate" }],
        })
      }

      if (body.confirmAction.mutationType === "create_goal") {
        await createGoalFromDraft(supabase, user.id, body.confirmAction.payload || {})
        return NextResponse.json({
          answer: "Perfecto, tu presupuesto fue creada exitosamente.",
          uiBlocks: [{ type: "kpi_card", title: "Accion completada", value: "presupuesto creada", tone: "success" }],
          actions: [{ label: "Ver planificacion", href: "/planning", actionType: "navigate" }],
        })
      }
    }

    if (!message) {
      return NextResponse.json({ error: "Mensaje vacio" }, { status: 400 })
    }

    const [{ data: accountsRaw }, { data: goalsRaw }, { data: transactionsRaw }] = await Promise.all([
      supabase.from("accounts").select("*").eq("user_id", user.id),
      supabase.from("goals").select("*").eq("user_id", user.id),
      supabase
        .from("transactions")
        .select("*, category:categories(name)")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(220),
    ])

    const accounts = (accountsRaw || []) as Account[]
    const goals = (goalsRaw || []) as Goal[]
    const transactions = (transactionsRaw || []) as Transaction[]

    const response = runMiaPhase1Agent(message, {
      accounts,
      goals,
      transactions,
    })

    if (/tarjeta|credito|corte|pago/i.test(message)) toolTrace.push("getCreditCards")
    if (/presupuesto/i.test(message)) toolTrace.push("getGoalProgress")
    if (/mes pasado|compar/i.test(message)) toolTrace.push("getExpenseComparison")
    if (/gasto|categoria|dinero/i.test(message)) toolTrace.push("getTopCategories")
    if (toolTrace.length === 0) toolTrace.push("getMonthSummary")

    console.info("[MIA_PHASE2]", {
      userId: user.id,
      message,
      tools: toolTrace,
      actions: response.actions.map((a) => a.label),
    })

    return NextResponse.json(response)
  } catch (error) {
    console.error("Coach IA error:", error)
    return NextResponse.json(
      {
        answer: "Se me complico leer tus datos ahora mismo. Intenta de nuevo en unos segundos.",
        uiBlocks: [],
        actions: [{ label: "Reintentar", href: "/coach-ia", actionType: "navigate" }],
      },
      { status: 500 }
    )
  }
}


