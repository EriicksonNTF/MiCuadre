import "server-only"

/*
 * MIA chat route.
 *
 * LLM provider is OpenAI-compatible. Defaults to Groq (free tier).
 * To switch provider set ONLY these env vars (no code changes):
 *   - LLM_API_BASE  e.g. https://api.groq.com/openai/v1
 *                    https://openrouter.ai/api/v1
 *                    https://integrate.api.nvidia.com/v1
 *   - LLM_MODEL     e.g. llama-3.3-70b-versatile  (Groq)
 *                    meta-llama/llama-3.3-70b-instruct (OpenRouter)
 *                    meta/llama-3.3-70b-instruct       (NVIDIA)
 *   - LLM_API_KEY   server-only, never NEXT_PUBLIC_*
 *
 * If LLM_API_KEY is missing OR the call fails OR the response is not
 * valid JSON, the route falls back to buildCoachReply (lib/coach-ia.ts)
 * using the existing buildFinancialContext. The user is never left
 * without an answer.
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { coachRequestSchema } from "@/lib/mia/schemas"
import { formatCurrency } from "@/lib/data"
import { isCoachIAEnabledForEmail } from "@/lib/feature-flags"
import { buildFinancialContext } from "@/lib/mia/context-builder"
import { detectCardQuestion, resolveCardQuestion } from "@/lib/mia/card-questions"
import { buildCardSnapshot } from "@/lib/mia/card-snapshot"
import { buildCoachReply, type CoachContext } from "@/lib/coach-ia"

const LLM_API_BASE = process.env.LLM_API_BASE || "https://api.groq.com/openai/v1"
const LLM_MODEL = process.env.LLM_MODEL || "llama-3.3-70b-versatile"
const LLM_API_KEY = process.env.LLM_API_KEY || ""

type MiaActionType =
  | "create_transaction"
  | "create_goal"
  | "create_subscription"
  | "add_money_to_goal"

type MiaRequest = {
  message?: string
  screenContext?: string
  action?: "new_conversation" | "clear_history"
  conversationId?: string
  confirmAction?: {
    mutationType?: MiaActionType
    payload?: Record<string, unknown>
  }
}

type MiaAIResponse = {
  type: "answer" | "action_proposal" | "refusal"
  message: string
  action: null | {
    name: MiaActionType
    requires_confirmation: boolean
    arguments: Record<string, any>
  }
}

const SYSTEM_PROMPT = `Eres MIA, la asistente financiera inteligente de MiCuadre.
Tu objetivo es ayudar a los usuarios a entender sus finanzas personales basándote únicamente en sus datos reales de la aplicación.

LIMITACIÓN DE DOMINIO - REGLA DE ORO DE SEGURIDAD:
- Solo puedes hablar sobre temas financieros relacionados con MiCuadre: cuentas, transacciones, gastos, ingresos, planificacion de ahorro, tarjetas de crédito, presupuestos y salud financiera.
- Si el usuario te pregunta sobre cualquier otro tema ajeno (como recetas de cocina, política, noticias, escribir código de programación, consejos no financieros o temas generales de ChatGPT), debes negarte cortésmente usando el formato JSON con "type": "refusal" y explicar que solo puedes hablar sobre las finanzas del usuario dentro de MiCuadre.

NORMAS DE COMPORTAMIENTO:
1. Responde en español con un tono claro, amable, directo y financieramente responsable.
2. Nunca inventes datos financieros. Si no hay datos suficientes para responder una pregunta, dilo claramente.
3. No des asesoría de inversión, tributaria o legal como verdades absolutas. Añade advertencias suaves de que es educación financiera.
4. Para acciones que modifiquen o registren datos financieros, debes proponer una acción estructurada en tu JSON y solicitar la confirmación del usuario.

FORMATO DE RESPUESTA REQUERIDO:
Debes responder STRICTAMENTE con un objeto JSON válido con los siguientes campos:
{
  "type": "answer" | "action_proposal" | "refusal",
  "message": "Tu respuesta o mensaje en español aquí (soporta markdown básico)",
  "action": {
    "name": "create_transaction" | "create_goal" | "create_subscription" | "add_money_to_goal",
    "arguments": {
      // Para create_transaction (creación de gasto o ingreso):
      "amount": number,
      "category": "comida" | "gasolina" | "ocio" | etc (nombre sugerido),
      "type": "expense" | "income",
      "currency": "DOP" | "USD",
      "account": "efectivo" | "nómina" | etc (nombre sugerido, opcional)
      
      // Para create_goal (creación de presupuesto de ahorro):
      "name": "Fondo de emergencia" | "Viaje" | etc (nombre de la presupuesto),
      "targetAmount": number,
      "currency": "DOP" | "USD"
      
      // Para create_subscription (suscripciones de streaming u otros recurrentes):
      "name": "Netflix" | "Spotify" | etc (nombre de la suscripción),
      "amount": number,
      "currency": "DOP" | "USD",
      "billingDay": number (día del mes del 1 al 31)
      
      // Para add_money_to_goal (añadir dinero a una presupuesto):
      "goalName": string (nombre de la presupuesto),
      "amount": number
    },
    "requires_confirmation": true
  }
}
Si no estás proponiendo ninguna acción, el campo "action" debe ser null.`

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function stripJsonFences(value: string): string {
  const trimmed = value.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (fenced) return fenced[1].trim()
  return trimmed
}

function toCoachContext(ctx: Awaited<ReturnType<typeof buildFinancialContext>>): CoachContext {
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysRemaining = Math.max(0, daysInMonth - now.getDate())
  const finScore = Math.max(0, Math.min(100, ctx.health.savingsRate))
  const runway =
    ctx.health.monthlyExpenses > 0
      ? Math.max(0, Math.floor((ctx.health.monthlyIncome / ctx.health.monthlyExpenses) * daysInMonth))
      : 0

  return {
    totalIncomeMonth: ctx.health.monthlyIncome,
    totalExpenseMonth: ctx.health.monthlyExpenses,
    totalExpenseLastMonth: 0,
    topCategories: [],
    finScore,
    finScoreDrivers: [
      { key: "budget", score: ctx.health.savingsRate },
      { key: "debt", score: Math.max(0, 100 - ctx.health.debtToIncomeRatio) },
      { key: "savings", score: Math.max(0, Math.min(100, Math.round(ctx.health.emergencyFundMonths * 25))) },
      { key: "consistency", score: 50 },
    ],
    activeGoals: ctx.goals.map((g) => ({
      name: g.name,
      current: g.current,
      target: g.target,
    })),
    daysRemainingInMonth: daysRemaining,
    estimatedRunwayDays: runway,
  }
}

async function callOpenAIChatCompletion(params: {
  systemPrompt: string
  history: Array<{ role: "user" | "assistant"; content: string }>
}): Promise<string | null> {
  if (!LLM_API_KEY) return null

  const url = `${LLM_API_BASE.replace(/\/$/, "")}/chat/completions`
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [
        { role: "system", content: params.systemPrompt },
        ...params.history,
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 1000,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => "")
    console.error("[mia/llm] provider error", response.status, errorText)
    return null
  }

  const data = (await response.json().catch(() => null)) as
    | {
        choices?: Array<{ message?: { content?: string }; finish_reason?: string }>
        error?: { message?: string }
      }
    | null

  if (data?.error?.message) {
    console.error("[mia/llm] provider error in body", data.error.message)
    return null
  }

  const content = data?.choices?.[0]?.message?.content
  if (!content) {
    console.error("[mia/llm] empty response, finish_reason=", data?.choices?.[0]?.finish_reason)
    return null
  }

  return content
}

async function getOrCreateActiveConversation(supabase: any, userId: string) {
  const { data: conversations } = await supabase
    .from("mia_conversations")
    .select("id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)

  if (conversations && conversations.length > 0) {
    return conversations[0].id as string
  }

  const { data: newConv, error } = await supabase
    .from("mia_conversations")
    .insert({
      user_id: userId,
      title: `Conversación con MIA`,
    })
    .select("id")
    .single()

  if (error) throw error
  return newConv.id as string
}

async function resolveAccountAndCategory(
  supabase: any,
  userId: string,
  categoryName?: string,
  accountName?: string
) {
  let accountId: string | null = null
  let accountBalance = 0

  if (accountName) {
    const { data: accounts } = await supabase
      .from("accounts")
      .select("id, balance, name")
      .eq("user_id", userId)
      .eq("is_active", true)

    const matched = accounts?.find(
      (a: any) => a.name.toLowerCase().includes(accountName.toLowerCase())
    )
    if (matched) {
      accountId = matched.id
      accountBalance = Number(matched.balance || 0)
    }
  }

  if (!accountId) {
    const { data: defaultAccount } = await supabase
      .from("accounts")
      .select("id, balance")
      .eq("user_id", userId)
      .in("type", ["cash", "debit"])
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (defaultAccount) {
      accountId = defaultAccount.id
      accountBalance = Number(defaultAccount.balance || 0)
    }
  }

  let categoryId: string | null = null
  if (categoryName) {
    const { data: categories } = await supabase
      .from("categories")
      .select("id, name")
      .or(`user_id.eq.${userId},is_default.eq.true`)

    const matched = categories?.find(
      (c: any) => c.name.toLowerCase().includes(categoryName.toLowerCase())
    )
    if (matched) {
      categoryId = matched.id
    }
  }

  return { accountId, accountBalance, categoryId }
}

async function createTransactionFromDraft(
  supabase: any,
  userId: string,
  payload: Record<string, unknown>
) {
  const amount = Number(payload.amount ?? 0)
  const currency = payload.currency === "USD" ? "USD" : "DOP"
  const categoryName = typeof payload.category === "string" ? payload.category : undefined
  const accountName = typeof payload.account === "string" ? payload.account : undefined
  const type = payload.type === "income" ? "income" : "expense"

  if (amount <= 0) throw new Error("Monto inválido")

  const { accountId, accountBalance, categoryId } = await resolveAccountAndCategory(
    supabase,
    userId,
    categoryName,
    accountName
  )

  if (!accountId) throw new Error("No hay cuenta disponible para registrar este movimiento")
  if (type === "expense" && accountBalance < amount) throw new Error("Fondos insuficientes")

  const { data: tx, error: txError } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      account_id: accountId,
      category_id: categoryId,
      type,
      amount,
      currency,
      amount_base: amount,
      exchange_rate: 1,
      description: `MIA: ${categoryName || "Gasto"}`,
      date: new Date().toISOString().slice(0, 10),
      notes: "Registrado por MIA (confirmado por usuario)",
      is_recurring: false,
      parent_transaction_id: null,
      metadata: { source: "mia", category_hint: categoryName },
    })
    .select("id")
    .single()

  if (txError) throw txError

  const newBalance = type === "expense"
    ? accountBalance - amount
    : accountBalance + amount

  const { error: balanceError } = await supabase
    .from("accounts")
    .update({ balance: newBalance })
    .eq("id", accountId)

  if (balanceError) {
    await supabase.from("transactions").delete().eq("id", tx.id)
    throw balanceError
  }
}

async function createGoalFromDraft(
  supabase: any,
  userId: string,
  payload: Record<string, unknown>
) {
  const name = typeof payload.name === "string" ? payload.name.trim() : ""
  const targetAmount = Number(payload.targetAmount ?? 0)
  const currency = payload.currency === "USD" ? "USD" : "DOP"
  if (name.length < 2 || targetAmount <= 0) throw new Error("Datos de presupuesto inválidos")

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

async function createSubscriptionFromDraft(
  supabase: any,
  userId: string,
  payload: Record<string, unknown>
) {
  const name = typeof payload.name === "string" ? payload.name.trim() : ""
  const amount = Number(payload.amount ?? 0)
  const currency = payload.currency === "USD" ? "USD" : "DOP"
  const billingDay = Number(payload.billingDay ?? new Date().getDate())

  if (name.length < 2 || amount <= 0) throw new Error("Datos de suscripción inválidos")

  const { accountId, categoryId } = await resolveAccountAndCategory(
    supabase,
    userId,
    "Suscripciones",
    undefined
  )

  if (!accountId) throw new Error("No hay cuenta disponible para la suscripción")

  const now = new Date()
  let nextPayment = new Date(now.getFullYear(), now.getMonth(), billingDay)
  if (nextPayment <= now) {
    nextPayment = new Date(now.getFullYear(), now.getMonth() + 1, billingDay)
  }

  const { error } = await supabase.from("subscriptions").insert({
    user_id: userId,
    name,
    amount,
    currency,
    account_id: accountId,
    category_id: categoryId,
    billing_day: billingDay,
    next_payment_date: nextPayment.toISOString().slice(0, 10),
    status: "active",
  })

  if (error) throw error
}

async function addMoneyToGoalFromDraft(
  supabase: any,
  userId: string,
  payload: Record<string, unknown>
) {
  const goalName = typeof payload.goalName === "string" ? payload.goalName.trim() : ""
  const amount = Number(payload.amount ?? 0)
  if (goalName.length < 2 || amount <= 0) throw new Error("Datos de contribución inválidos")

  const { data: goals } = await supabase
    .from("goals")
    .select("id, name, current_amount")
    .eq("user_id", userId)
    .eq("is_completed", false)

  const matchedGoal = goals?.find(
    (g: any) => g.name.toLowerCase().includes(goalName.toLowerCase())
  )
  if (!matchedGoal) throw new Error("No se encontró la presupuesto de ahorro")

  const { accountId, accountBalance } = await resolveAccountAndCategory(
    supabase,
    userId,
    undefined,
    undefined
  )
  if (!accountId) throw new Error("No hay cuenta disponible para realizar el débito")
  if (accountBalance < amount) throw new Error("Fondos insuficientes en la cuenta")

  const { error: contribError } = await supabase.from("goal_contributions").insert({
    user_id: userId,
    goal_id: matchedGoal.id,
    account_id: accountId,
    amount,
    date: new Date().toISOString(),
    notes: "Contribución registrada por MIA",
  })
  if (contribError) throw contribError

  const newGoalAmount = Number(matchedGoal.current_amount || 0) + amount
  const { error: goalUpdateError } = await supabase
    .from("goals")
    .update({ current_amount: newGoalAmount })
    .eq("id", matchedGoal.id)

  if (goalUpdateError) throw goalUpdateError

  const newAccountBalance = accountBalance - amount
  const { error: accountUpdateError } = await supabase
    .from("accounts")
    .update({ balance: newAccountBalance })
    .eq("id", accountId)

  if (accountUpdateError) throw accountUpdateError
}

function mapAiToClientResponse(ai: MiaAIResponse) {
  const response = {
    answer: ai.message,
    uiBlocks: [] as any[],
    actions: [] as any[],
    disclaimer: "MIA ofrece información basada en los datos registrados en MiCuadre. No sustituye asesoría financiera profesional.",
  }

  if (ai.type === "refusal") {
    return response
  }

  if (ai.type === "action_proposal" && ai.action) {
    const actName = ai.action.name
    const args = ai.action.arguments || {}

    if (actName === "create_transaction") {
      const amountStr = formatCurrency(Number(args.amount || 0), args.currency === "USD" ? "USD" : "DOP")
      response.uiBlocks.push({
        type: "draft_tx",
        title: args.type === "income" ? "Borrador de ingreso" : "Borrador de gasto",
        amount: amountStr,
        category: String(args.category || "Sin categoría"),
      })
      response.actions.push({
        label: "Confirmar",
        href: "/coach-ia",
        actionType: "confirm_draft",
        mutationType: "create_transaction",
        payload: {
          amount: args.amount,
          category: args.category,
          type: args.type || "expense",
          currency: args.currency || "DOP",
          account: args.account,
        },
      })
    } else if (actName === "create_goal") {
      const amountStr = formatCurrency(Number(args.targetAmount || 0), args.currency === "USD" ? "USD" : "DOP")
      response.uiBlocks.push({
        type: "kpi_card",
        title: "Borrador de presupuesto",
        value: `${String(args.name || "Nueva presupuesto")} · ${amountStr}`,
        tone: "success",
      })
      response.actions.push({
        label: "Confirmar",
        href: "/coach-ia",
        actionType: "confirm_draft",
        mutationType: "create_goal",
        payload: {
          name: args.name,
          targetAmount: args.targetAmount,
          currency: args.currency || "DOP",
        },
      })
    } else if (actName === "create_subscription") {
      const amountStr = formatCurrency(Number(args.amount || 0), args.currency === "USD" ? "USD" : "DOP")
      response.uiBlocks.push({
        type: "kpi_card",
        title: "Borrador de suscripción",
        value: `${String(args.name || "Netflix")} · ${amountStr}/mes`,
        tone: "info",
      })
      response.actions.push({
        label: "Confirmar",
        href: "/coach-ia",
        actionType: "confirm_draft",
        mutationType: "create_subscription",
        payload: {
          name: args.name,
          amount: args.amount,
          currency: args.currency || "DOP",
          billingDay: args.billingDay || new Date().getDate(),
        },
      })
    } else if (actName === "add_money_to_goal") {
      const amountStr = formatCurrency(Number(args.amount || 0), "DOP")
      response.uiBlocks.push({
        type: "kpi_card",
        title: "Borrador de ahorro",
        value: `Ahorrar ${amountStr} en "${args.goalName || "presupuesto"}"`,
        tone: "success",
      })
      response.actions.push({
        label: "Confirmar",
        href: "/coach-ia",
        actionType: "confirm_draft",
        mutationType: "add_money_to_goal",
        payload: {
          goalName: args.goalName,
          amount: args.amount,
        },
      })
    }

    response.actions.push({
      label: "Cancelar",
      href: "/coach-ia",
      actionType: "navigate",
    })
  }

  return response
}

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

    // Entitlement check
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan_tier, email")
      .eq("id", user.id)
      .single()

    const planTier = profile?.plan_tier || "free"
    const userEmail = profile?.email || user.email
    const isWhitelisted = isCoachIAEnabledForEmail(userEmail)
    const isPro = planTier === "pro"

    if (!isPro && !isWhitelisted) {
      return NextResponse.json({
        error: "Forbidden",
        message: "MIA advanced requires Pro plan.",
        requiresUpgrade: true
      }, { status: 403 })
    }

    // Get active conversation
    const { data: conversations } = await supabase
      .from("mia_conversations")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })

    if (!conversations || conversations.length === 0) {
      return NextResponse.json({
        conversationId: null,
        messages: [],
        conversations: []
      })
    }

    const activeId = conversations[0].id

    // Fetch messages for active conversation
    const { data: messagesRaw } = await supabase
      .from("mia_messages")
      .select("*")
      .eq("conversation_id", activeId)
      .order("created_at", { ascending: true })

    const messages = (messagesRaw || []).map((m: any) => ({
      id: m.id,
      role: m.role,
      text: m.content,
      uiBlocks: m.metadata?.uiBlocks || [],
      actions: m.metadata?.actions || [],
      disclaimer: m.metadata?.disclaimer,
    }))

    return NextResponse.json({
      conversationId: activeId,
      messages,
      conversations: conversations.map((c: any) => ({
        id: c.id,
        title: c.title,
        updatedAt: c.updated_at
      }))
    })
  } catch (error) {
    console.error("GET MIA error:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as MiaRequest
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

    // Entitlement check
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan_tier, email")
      .eq("id", user.id)
      .single()

    const planTier = profile?.plan_tier || "free"
    const userEmail = profile?.email || user.email
    const isWhitelisted = isCoachIAEnabledForEmail(userEmail)
    const isPro = planTier === "pro"

    if (!isPro && !isWhitelisted) {
      return NextResponse.json({
        error: "Forbidden",
        message: "MIA advanced is a Pro-only feature.",
        requiresUpgrade: true
      }, { status: 403 })
    }

    // 1. Handle clear history
    if (body.action === "clear_history") {
      await supabase
        .from("mia_conversations")
        .delete()
        .eq("user_id", user.id)

      return NextResponse.json({ success: true })
    }

    // 2. Handle starting new conversation
    if (body.action === "new_conversation") {
      const { data: newConv, error } = await supabase
        .from("mia_conversations")
        .insert({
          user_id: user.id,
          title: `Conversación ${new Date().toLocaleDateString("es-ES")}`,
        })
        .select("*")
        .single()

      if (error) throw error

      return NextResponse.json({
        conversationId: newConv.id,
        messages: [],
      })
    }

    // 3. Handle confirmation of action
    if (body.confirmAction?.mutationType) {
      const mutationType = body.confirmAction.mutationType
      const payload = body.confirmAction.payload || {}
      const convId = body.conversationId || await getOrCreateActiveConversation(supabase, user.id)

      const { data: toolCall } = await supabase
        .from("mia_tool_calls")
        .insert({
          user_id: user.id,
          conversation_id: convId,
          tool_name: mutationType,
          arguments: payload,
          status: "pending",
        })
        .select("id")
        .single()

      let answer = ""
      let uiBlocks: any[] = []
      let actions: any[] = []

      try {
        if (mutationType === "create_transaction") {
          await createTransactionFromDraft(supabase, user.id, payload)
          answer = "Listo, registré el movimiento correctamente."
          uiBlocks = [{ type: "kpi_card", title: "Acción completada", value: "Transacción guardada", tone: "success" }]
          actions = [{ label: "Ver historial", href: "/history", actionType: "navigate" }]
        } else if (mutationType === "create_goal") {
          await createGoalFromDraft(supabase, user.id, payload)
          answer = "Perfecto, tu presupuesto fue creada exitosamente."
          uiBlocks = [{ type: "kpi_card", title: "Acción completada", value: "presupuesto creada", tone: "success" }]
          actions = [{ label: "Ver planificacion", href: "/planning", actionType: "navigate" }]
        } else if (mutationType === "create_subscription") {
          await createSubscriptionFromDraft(supabase, user.id, payload)
          answer = "He registrado la suscripción recurrente en tu cuenta."
          uiBlocks = [{ type: "kpi_card", title: "Acción completada", value: "Suscripción creada", tone: "success" }]
          actions = [{ label: "Ver suscripciones", href: "/subscriptions", actionType: "navigate" }]
        } else if (mutationType === "add_money_to_goal") {
          await addMoneyToGoalFromDraft(supabase, user.id, payload)
          answer = "Perfecto, agregué los fondos a tu presupuesto de ahorro."
          uiBlocks = [{ type: "kpi_card", title: "Acción completada", value: "Ahorro registrado", tone: "success" }]
          actions = [{ label: "Ver planificacion", href: "/planning", actionType: "navigate" }]
        } else {
          throw new Error("Tipo de acción inválido")
        }

        if (toolCall) {
          await supabase
            .from("mia_tool_calls")
            .update({ status: "success", result: { success: true } })
            .eq("id", toolCall.id)
        }

        await supabase.from("mia_messages").insert({
          conversation_id: convId,
          user_id: user.id,
          role: "assistant",
          content: answer,
          metadata: { uiBlocks, actions },
        })

        await supabase
          .from("mia_conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", convId)

        return NextResponse.json({
          answer,
          uiBlocks,
          actions,
        })
      } catch (err: any) {
        console.error("Action execution error:", err)
        if (toolCall) {
          await supabase
            .from("mia_tool_calls")
            .update({ status: "failed", result: { error: err.message || "Error desconocido" } })
            .eq("id", toolCall.id)
        }
        return NextResponse.json({
          answer: `No pude realizar esa acción: ${err.message || "Error desconocido"}`,
          uiBlocks: [{ type: "kpi_card", title: "Error", value: err.message || "Error al ejecutar", tone: "warning" }],
          actions: [{ label: "Continuar", href: "/coach-ia", actionType: "navigate" }],
        }, { status: 400 })
      }
    }

    // 4. Handle standard chat question
    const parsed = coachRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 })
    }

    const message = parsed.data.message?.trim()
    if (!message) return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 })

    const convId = body.conversationId || await getOrCreateActiveConversation(supabase, user.id)

    // Save user message
    await supabase.from("mia_messages").insert({
      conversation_id: convId,
      user_id: user.id,
      role: "user",
      content: message,
    })

    // Build context
    const ctx = await buildFinancialContext(supabase, user.id)
    const { rawContext } = ctx

    // --- CARD QUESTION DETECTION (controlled engine, no LLM) ---
    const cardIntent = detectCardQuestion(message)
    if (cardIntent && cardIntent.confidence >= 0.7) {
      const cardSnapshot = await buildCardSnapshot(supabase, user.id)
      if (cardSnapshot.hasCards) {
        const cardResponse = resolveCardQuestion(cardIntent, cardSnapshot, message)
        await supabase.from("mia_messages").insert({
          conversation_id: convId,
          user_id: user.id,
          role: "assistant",
          content: cardResponse.answer,
          metadata: {
            uiBlocks: cardResponse.uiBlocks,
            actions: cardResponse.actions,
            disclaimer: cardResponse.disclaimer,
          },
        })
        await supabase
          .from("mia_conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", convId)
        return NextResponse.json({ ...cardResponse, conversationId: convId })
      }
    }

    // Retrieve conversation history
    const { data: historyRows } = await supabase
      .from("mia_messages")
      .select("role, content")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })
      .limit(10)

    const historyList = (historyRows || [])
      .map((row: any) => ({
        role: (row.role === "user" ? "user" : "assistant") as "user" | "assistant",
        content: typeof row.content === "string" ? row.content : "",
      }))
      .filter((m: { content: string }) => m.content.length > 0)

    const systemPromptCombined = `${SYSTEM_PROMPT}

CONTEXTO FINANCIERO ACTUAL DEL USUARIO:
${rawContext}
`

    const rawResponse = await callOpenAIChatCompletion({
      systemPrompt: systemPromptCombined,
      history: historyList,
    })

    if (rawResponse) {
      const cleaned = stripJsonFences(rawResponse)
      const parsedAi = safeJsonParse<MiaAIResponse>(cleaned)

      if (parsedAi?.message) {
        const clientResponse = mapAiToClientResponse(parsedAi)
        await supabase.from("mia_messages").insert({
          conversation_id: convId,
          user_id: user.id,
          role: "assistant",
          content: clientResponse.answer,
          metadata: {
            uiBlocks: clientResponse.uiBlocks,
            actions: clientResponse.actions,
            disclaimer: clientResponse.disclaimer,
          },
        })
        await supabase
          .from("mia_conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", convId)
        return NextResponse.json({
          ...clientResponse,
          conversationId: convId,
        })
      }

      console.error("[mia/llm] response did not parse to a valid message", cleaned.slice(0, 200))
    }

    const coachContext = toCoachContext(ctx)
    const fallback = buildCoachReply(message, coachContext)

    await supabase.from("mia_messages").insert({
      conversation_id: convId,
      user_id: user.id,
      role: "assistant",
      content: fallback.answer,
      metadata: {
        uiBlocks: fallback.uiBlocks,
        actions: fallback.actions,
        disclaimer: fallback.disclaimer,
      },
    })
    await supabase
      .from("mia_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", convId)

    return NextResponse.json({
      answer: fallback.answer,
      uiBlocks: fallback.uiBlocks,
      actions: fallback.actions,
      disclaimer: fallback.disclaimer,
      conversationId: convId,
    })
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


