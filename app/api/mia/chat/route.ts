import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { coachRequestSchema } from "@/lib/mia/schemas"
import { formatCurrency } from "@/lib/data"
import type { Account, CreditCardCycle, FinancialSubscription, Goal, Transaction } from "@/lib/types/database"

type MiaActionType =
  | "create_transaction"
  | "create_goal"
  | "create_subscription"
  | "create_category"
  | "pay_credit_card"
  | "transfer_money"

type MiaRequest = {
  message?: string
  screenContext?: string
  confirmAction?: {
    mutationType?: MiaActionType
    payload?: Record<string, unknown>
  }
}

type MiaAIResponse = {
  message: string
  action: null | {
    type: MiaActionType
    requires_confirmation: boolean
    data: Record<string, unknown>
  }
}

const SYSTEM_PROMPT = `You are MIA, the intelligent financial copilot inside MiCuadre.

You help users understand their personal finances using their real app data.

You can explain:
- income
- expenses
- accounts
- credit cards
- subscriptions
- savings goals
- monthly trends
- financial health

You must answer in Spanish by default.

Your tone:
- clear
- friendly
- practical
- honest
- concise
- financially responsible

Rules:
- Never invent financial data.
- If data is missing, say it clearly.
- Use the user’s actual MiCuadre data when available.
- Give actionable recommendations.
- Do not give investment, tax or legal advice as absolute truth.
- For actions like creating transactions, goals or subscriptions, prepare a draft and ask the user to confirm.
- Never execute financial actions without confirmation.

Output strictly as JSON:
{
  "message": "string",
  "action": {
    "type": "create_transaction|create_goal|create_subscription|create_category|pay_credit_card|transfer_money",
    "requires_confirmation": true,
    "data": {}
  }
}
or
{
  "message": "string",
  "action": null
}`

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function toDate(value: string) {
  return new Date(`${value}T12:00:00`)
}

function getMonthBounds(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return { start, prevStart, next }
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

  const { data: account } = await supabase
    .from("accounts")
    .select("id, balance, type")
    .eq("user_id", userId)
    .in("type", ["cash", "debit"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!account) throw new Error("No hay cuenta disponible para registrar este movimiento")
  if (type === "expense" && Number(account.balance || 0) < amount) throw new Error("Fondos insuficientes")

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
      metadata: { source: "mia", category_hint: category },
    })
    .select("id")
    .single()

  if (txError) throw txError

  const newBalance = type === "expense"
    ? Number(account.balance || 0) - amount
    : Number(account.balance || 0) + amount

  const { error: balanceError } = await supabase
    .from("accounts")
    .update({ balance: newBalance })
    .eq("id", account.id)

  if (balanceError) {
    await supabase.from("transactions").delete().eq("id", tx.id)
    throw balanceError
  }
}

async function createGoalFromDraft(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  payload: Record<string, unknown>
) {
  const name = typeof payload.name === "string" ? payload.name.trim() : ""
  const targetAmount = Number(payload.targetAmount ?? 0)
  const currency = payload.currency === "USD" ? "USD" : "DOP"
  if (name.length < 2 || targetAmount <= 0) throw new Error("Datos de meta invalidos")

  const { error } = await supabase.from("goals").insert({
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
  if (error) throw error
}

function buildSummary(data: {
  accounts: Account[]
  transactions: Transaction[]
  goals: Goal[]
  financialSubscriptions: FinancialSubscription[]
  cycles: CreditCardCycle[]
}) {
  const { start, prevStart, next } = getMonthBounds(new Date())
  const thisMonth = data.transactions.filter((tx) => {
    const d = toDate(tx.date)
    return d >= start && d < next && !(tx.metadata?.kind === "transfer" && tx.metadata?.transfer_type === "internal") && tx.metadata?.kind !== "credit_payment"
  })
  const prevMonth = data.transactions.filter((tx) => {
    const d = toDate(tx.date)
    return d >= prevStart && d < start && !(tx.metadata?.kind === "transfer" && tx.metadata?.transfer_type === "internal") && tx.metadata?.kind !== "credit_payment"
  })

  const totalBalance = data.accounts.reduce((sum, a) => sum + Number(a.balance || 0), 0)
  const totalIncomeMonth = thisMonth.filter((tx) => tx.type === "income").reduce((sum, tx) => sum + Number(tx.amount || 0), 0)
  const totalExpenseMonth = thisMonth.filter((tx) => tx.type === "expense").reduce((sum, tx) => sum + Number(tx.amount || 0), 0)
  const totalExpensePrevMonth = prevMonth.filter((tx) => tx.type === "expense").reduce((sum, tx) => sum + Number(tx.amount || 0), 0)

  const catMap = new Map<string, number>()
  for (const tx of thisMonth) {
    if (tx.type !== "expense") continue
    const key = tx.category?.name || "Sin categoria"
    catMap.set(key, (catMap.get(key) || 0) + Number(tx.amount || 0))
  }
  const topCategories = Array.from(catMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4)

  const biggestExpenses = thisMonth
    .filter((tx) => tx.type === "expense")
    .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
    .slice(0, 3)
    .map((tx) => ({ description: tx.description || "Sin descripcion", amount: Number(tx.amount || 0), date: tx.date }))

  const cards = data.accounts.filter((a) => a.type === "credit")
  const cardDebt = cards.reduce((sum, card) => sum + Number(card.statement_balance || 0), 0)
  const upcomingPayments = cards
    .filter((card) => Boolean(card.statement_due_date))
    .map((card) => ({ name: card.name, dueDate: card.statement_due_date, pending: Number(card.pending_amount || 0) }))

  const subscriptionTotal = data.financialSubscriptions
    .filter((sub) => sub.status === "active")
    .reduce((sum, sub) => sum + Number(sub.amount || 0), 0)

  const goals = data.goals
    .filter((g) => !g.is_completed)
    .map((g) => {
      const current = Number(g.current_amount || 0)
      const target = Number(g.target_amount || 0)
      return {
        name: g.name,
        current,
        target,
        progress: target > 0 ? Math.round((current / target) * 100) : 0,
      }
    })

  return {
    totalBalance,
    totalIncomeMonth,
    totalExpenseMonth,
    netCashflowMonth: totalIncomeMonth - totalExpenseMonth,
    expenseDeltaVsPrevMonth: totalExpenseMonth - totalExpensePrevMonth,
    topCategories,
    biggestExpenses,
    cardDebt,
    upcomingPayments,
    activeSubscriptions: data.financialSubscriptions.filter((s) => s.status === "active").map((s) => ({ name: s.name, amount: Number(s.amount), nextPaymentDate: s.next_payment_date })),
    subscriptionTotal,
    goals,
    recentCardCycles: data.cycles.slice(0, 5).map((c) => ({
      accountId: c.account_id,
      dueDate: c.due_date,
      status: c.status,
      statementBalanceDOP: Number(c.statement_balance_dop || 0),
      statementBalanceUSD: Number(c.statement_balance_usd || 0),
    })),
  }
}

function mapAiToClientResponse(ai: MiaAIResponse) {
  const response = {
    answer: ai.message,
    uiBlocks: [] as Array<{ type: "kpi_card" | "warning_bar" | "category_list" | "draft_tx"; title: string; value?: string; tone?: "info" | "warning" | "success"; items?: Array<{ label: string; value: string }>; amount?: string; category?: string }>,
    actions: [] as Array<{ label: string; href: string; actionType: "navigate" | "confirm_draft"; mutationType?: MiaActionType; payload?: Record<string, unknown> }>,
    disclaimer: "Analisis educativo: no constituye asesoria financiera certificada.",
  }

  if (!ai.action) return response

  if (ai.action.type === "create_transaction") {
    response.uiBlocks.push({
      type: "draft_tx",
      title: "Borrador de transaccion",
      amount: formatCurrency(Number(ai.action.data.amount || 0), ai.action.data.currency === "USD" ? "USD" : "DOP"),
      category: String(ai.action.data.category || "Sin categoria"),
    })
  } else if (ai.action.type === "create_goal") {
    response.uiBlocks.push({
      type: "kpi_card",
      title: "Borrador de meta",
      value: `${String(ai.action.data.name || "Nueva meta")} · ${formatCurrency(Number(ai.action.data.targetAmount || 0), ai.action.data.currency === "USD" ? "USD" : "DOP")}`,
      tone: "success",
    })
  }

  response.actions.push(
    {
      label: "Confirmar",
      href: "/coach-ia",
      actionType: "confirm_draft",
      mutationType: ai.action.type,
      payload: ai.action.data,
    },
    { label: "Cancelar", href: "/coach-ia", actionType: "navigate" }
  )

  return response
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as MiaRequest
    const parsed = coachRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Mensaje vacio" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

    if (body.confirmAction?.mutationType) {
      if (body.confirmAction.mutationType === "create_transaction") {
        await createTransactionFromDraft(supabase, user.id, body.confirmAction.payload || {})
        return NextResponse.json({
          answer: "Listo, registre el movimiento correctamente.",
          uiBlocks: [{ type: "kpi_card", title: "Accion completada", value: "Transaccion guardada", tone: "success" }],
          actions: [{ label: "Ver historial", href: "/history", actionType: "navigate" }],
        })
      }
      if (body.confirmAction.mutationType === "create_goal") {
        await createGoalFromDraft(supabase, user.id, body.confirmAction.payload || {})
        return NextResponse.json({
          answer: "Perfecto, tu meta fue creada exitosamente.",
          uiBlocks: [{ type: "kpi_card", title: "Accion completada", value: "Meta creada", tone: "success" }],
          actions: [{ label: "Ver metas", href: "/goals", actionType: "navigate" }],
        })
      }
      return NextResponse.json({
        answer: "Ese tipo de accion aun no esta habilitado para ejecucion directa.",
        uiBlocks: [{ type: "kpi_card", title: "Pendiente", value: "Accion no disponible", tone: "warning" }],
        actions: [{ label: "Continuar", href: "/coach-ia", actionType: "navigate" }],
      })
    }

    const message = parsed.data.message?.trim()
    if (!message) return NextResponse.json({ error: "Mensaje vacio" }, { status: 400 })

    const [{ data: accountsRaw }, { data: txRaw }, { data: categoriesRaw }, { data: goalsRaw }, { data: financialSubscriptionsRaw }, { data: cyclesRaw }, { data: notificationsRaw }] = await Promise.all([
      supabase.from("accounts").select("*").eq("user_id", user.id),
      supabase.from("transactions").select("*, category:categories(name)").eq("user_id", user.id).order("date", { ascending: false }).limit(300),
      supabase.from("categories").select("id,name,type").eq("user_id", user.id),
      supabase.from("goals").select("*").eq("user_id", user.id),
      supabase.from("subscriptions").select("*").eq("user_id", user.id),
      supabase.from("credit_card_cycles").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
      supabase.from("notifications").select("id,type,title,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
    ])

    if (!accountsRaw || !txRaw || !goalsRaw || !financialSubscriptionsRaw || !cyclesRaw) {
      return NextResponse.json({ answer: "No pude cargar tus datos financieros en este momento.", uiBlocks: [], actions: [{ label: "Reintentar", href: "/coach-ia", actionType: "navigate" }] }, { status: 500 })
    }

    const summary = buildSummary({
      accounts: accountsRaw as Account[],
      transactions: txRaw as Transaction[],
      goals: goalsRaw as Goal[],
      financialSubscriptions: financialSubscriptionsRaw as FinancialSubscription[],
      cycles: cyclesRaw as CreditCardCycle[],
    })

    const userPrompt = {
      screenContext: parsed.data.screenContext || "unknown",
      question: message,
      summary,
      helpers: {
        categories: (categoriesRaw || []).map((c: any) => c.name),
        recentNotifications: (notificationsRaw || []).slice(0, 5),
      },
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        answer: "MIA no esta configurada en el servidor todavia. Falta GEMINI_API_KEY.",
        uiBlocks: [{ type: "kpi_card", title: "Configuracion", value: "GEMINI_API_KEY no definida", tone: "warning" }],
        actions: [{ label: "Continuar", href: "/coach-ia", actionType: "navigate" }],
      })
    }

    const model = process.env.GEMINI_MODEL || "gemini-1.5-flash-001"
    const fullPrompt = `${SYSTEM_PROMPT}

Contexto financiero del usuario:
- Balance total: ${formatCurrency(summary.totalBalance)} DOP
- Ingresos este mes: ${formatCurrency(summary.totalIncomeMonth)} DOP
- Gastos este mes: ${formatCurrency(summary.totalExpenseMonth)} DOP
- Flujo neto: ${formatCurrency(summary.netCashflowMonth)} DOP
- Comparación vs mes anterior: ${summary.expenseDeltaVsPrevMonth >= 0 ? "+" : ""}${formatCurrency(summary.expenseDeltaVsPrevMonth)} DOP
${summary.topCategories.length > 0 ? `- Top categorías: ${summary.topCategories.map(([name, total]) => `${name}: ${formatCurrency(total)}`).join(", ")}` : ""}
${summary.cardDebt > 0 ? `- Deuda en tarjetas: ${formatCurrency(summary.cardDebt)} DOP` : ""}
${summary.activeSubscriptions.length > 0 ? `- Suscripciones activas (${summary.subscriptionTotal}/mes): ${summary.activeSubscriptions.map(s => s.name).join(", ")}` : ""}
${summary.goals.length > 0 ? `- Metas activas: ${summary.goals.map(g => `${g.name}: ${g.progress}%`).join(", ")}` : ""}

Pregunta del usuario: ${message}

Responde en español. Si quieres proponer una acción (crear transacción, meta, etc), responde STRICTAMENTE en este formato JSON:
{"message": "...", "action": {"type": "create_transaction|create_goal|create_subscription|create_category|pay_credit_card|transfer_money", "requires_confirmation": true, "data": {"campo1": "valor1"}}}
Si no hay acción, responde: {"message": "...", "action": null}`

    const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: fullPrompt },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 800,
          temperature: 0.2,
        },
      }),
    })

    if (!aiRes.ok) {
      const errorText = await aiRes.text()
      console.error("Gemini API error:", aiRes.status, errorText)
      return NextResponse.json({ answer: "MIA no pudo responder ahora mismo. Intenta nuevamente.", uiBlocks: [], actions: [{ label: "Reintentar", href: "/coach-ia", actionType: "navigate" }] }, { status: 502 })
    }

    const aiJson = await aiRes.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
      error?: { message?: string }
    }
    
    if (aiJson.error) {
      console.error("Gemini error:", aiJson.error)
      return NextResponse.json({ answer: "MIA no pudo responder ahora mismo. Intenta nuevamente.", uiBlocks: [], actions: [{ label: "Reintentar", href: "/coach-ia", actionType: "navigate" }] }, { status: 500 })
    }
    
    const responseText = aiJson.candidates?.[0]?.content?.parts?.[0]?.text || ""
    
    if (!responseText) {
      console.error("Gemini empty response")
      return NextResponse.json({ answer: "MIA no pudo responder ahora mismo. Intenta nuevamente.", uiBlocks: [], actions: [{ label: "Reintentar", href: "/coach-ia", actionType: "navigate" }] }, { status: 500 })
    }
    
    // Try to extract JSON from response (in case model adds markdown)
    let jsonStr = responseText.trim()
    if (jsonStr.startsWith("```json")) jsonStr = jsonStr.slice(7)
    if (jsonStr.startsWith("```")) jsonStr = jsonStr.slice(3)
    if (jsonStr.endsWith("```")) jsonStr = jsonStr.slice(0, -3)
    
    const parsedAi = safeJsonParse<MiaAIResponse>(jsonStr.trim())

    if (!parsedAi?.message) {
      return NextResponse.json({ answer: "MIA no pudo responder ahora mismo. Intenta nuevamente.", uiBlocks: [], actions: [{ label: "Reintentar", href: "/coach-ia", actionType: "navigate" }] }, { status: 500 })
    }

    return NextResponse.json(mapAiToClientResponse(parsedAi))
  } catch (error) {
    console.error("MIA chat error:", error)
    return NextResponse.json(
      {
        answer: "MIA no pudo responder ahora mismo. Intenta nuevamente.",
        uiBlocks: [],
        actions: [{ label: "Reintentar", href: "/coach-ia", actionType: "navigate" }],
      },
      { status: 500 }
    )
  }
}
