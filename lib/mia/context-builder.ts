import type { SupabaseClient } from "@supabase/supabase-js"
import { formatCurrency } from "@/lib/data"
import {
  getFinancialHealthScore,
  getRecurringExpenseSummary,
  getCreditCardDebtSummary,
  getGoalProgressSummary,
} from "./financial-insights"

export async function buildFinancialContext(supabase: SupabaseClient, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_currency, plan_tier, created_at, first_name")
    .eq("id", userId)
    .single()

  const currency = profile?.preferred_currency || "DOP"
  const plan = profile?.plan_tier || "free"
  const userName = profile?.first_name || "Usuario"

  const { data: accountsRaw } = await supabase
    .from("accounts")
    .select("name, balance, type, currency")
    .eq("user_id", userId)
    .eq("is_active", true)

  const accounts = accountsRaw || []
  const cashAccounts = accounts.filter((a) => a.type === "cash" || a.type === "debit")

  const [health, recurring, ccSummary, goals] = await Promise.all([
    getFinancialHealthScore(supabase, userId),
    getRecurringExpenseSummary(supabase, userId),
    getCreditCardDebtSummary(supabase, userId),
    getGoalProgressSummary(supabase, userId),
  ])

  const { data: recentTxsRaw } = await supabase
    .from("transactions")
    .select("amount, type, date, description, category:categories(name)")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(15)

  const recentTxs = (recentTxsRaw || []) as any[]

  const { data: memoryRows } = await supabase
    .from("mia_memory")
    .select("key, value")
    .eq("user_id", userId)

  const memory = (memoryRows || []).reduce((acc, row) => {
    acc[row.key] = row.value
    return acc
  }, {} as Record<string, any>)

  const { data: debtsRaw } = await supabase
    .from("debts")
    .select("name,current_balance,fixed_payment_amount,currency,payment_day")
    .eq("user_id", userId)
    .eq("is_active", true)

  const debts = (debtsRaw || []) as any[]
  const totalDebtPending = debts.reduce((sum, debt) => sum + Number(debt.current_balance || 0), 0)

  let ctxStr = `PERFIL DEL USUARIO:
- Nombre: ${userName}
- Moneda principal: ${currency}
- Plan actual: ${plan}
- Preferencias de memoria guardadas: ${JSON.stringify(memory)}

RESUMEN FINANCIERO DEL MES (MES ACTUAL):
- Balance total en efectivo/debito: ${formatCurrency(cashAccounts.reduce((sum, a) => sum + Number(a.balance || 0), 0), currency)}
- Ingresos de este mes: ${formatCurrency(health.monthlyIncome, currency)}
- Gastos de este mes: ${formatCurrency(health.monthlyExpenses, currency)}
- Tasa de ahorro actual: ${health.savingsRate}%
- Tasa de endeudamiento/ingreso: ${health.debtToIncomeRatio}%
- Capacidad de fondo de emergencia: ${health.emergencyFundMonths} meses de gastos
- Mayor categoria de gasto: ${health.topSpendingCategory}

CUENTAS DE EFECTIVO Y DEBITO ACTIVAS:
${cashAccounts.length > 0 ? cashAccounts.map((a) => `  - ${a.name}: ${formatCurrency(Number(a.balance), a.currency)}`).join("\n") : "  - Ninguna"}

TARJETAS DE CREDITO ACTIVAS Y DEUDAS:
- Deuda total en tarjetas de credito: ${formatCurrency(ccSummary.totalDebt, currency)}
${ccSummary.cards.length > 0 ? ccSummary.cards.map((c) => `  - ${c.name}: Balance actual ${formatCurrency(c.balance, c.currency)} | Al corte ${formatCurrency(c.statementBalance, c.currency)} | Pago minimo ${formatCurrency(c.pendingAmount, c.currency)}`).join("\n") : "  - Ninguna"}

METAS DE AHORRO ACTIVAS:
${goals.length > 0 ? goals.map((g) => `  - ${g.name}: ${g.progress}% completado (${formatCurrency(g.current, g.currency)} de ${formatCurrency(g.target, g.currency)})`).join("\n") : "  - Ninguna"}

SUSCRIPCIONES RECURRENTES ACTIVAS (Gastos fijos):
- Total en suscripciones al mes: ${formatCurrency(recurring.total, currency)}
${recurring.subscriptions.length > 0 ? recurring.subscriptions.map((s) => `  - ${s.name}: ${formatCurrency(s.amount, s.currency)}/mes (Proximo cobro: ${s.nextPaymentDate || "No definida"})`).join("\n") : "  - Ninguna"}

DEUDAS ACTIVAS:
- Total pendiente en deudas: ${formatCurrency(totalDebtPending, currency)}
${debts.length > 0 ? debts.map((d) => `  - ${d.name}: Pendiente ${formatCurrency(Number(d.current_balance || 0), d.currency || currency)}${d.fixed_payment_amount ? ` | Cuota ${formatCurrency(Number(d.fixed_payment_amount), d.currency || currency)}` : ""}${d.payment_day ? ` | Dia de pago: ${d.payment_day}` : ""}`).join("\n") : "  - Ninguna"}

SENALES DE SALUD FINANCIERA:
${health.positiveSignals.length > 0 ? health.positiveSignals.map((s) => `  [POSITIVO] ${s}`).join("\n") : "  No se detectan senales positivas destacadas todavia."}
${health.riskFlags.length > 0 ? health.riskFlags.map((f) => `  [Riesgo/Alerta] ${f}`).join("\n") : "  No se detectan banderas de riesgo en este momento."}

ULTIMOS 15 MOVIMIENTOS REGISTRADOS:
${recentTxs.length > 0 ? recentTxs.map((t) => {
  const catName = Array.isArray(t.category)
    ? t.category[0]?.name
    : t.category?.name
  return `  - [${t.date}] ${t.type === "income" ? "+" : "-"}${formatCurrency(t.amount, currency)} | ${t.description || "Sin descripcion"} (${catName || "Sin categoria"})`
}).join("\n") : "  - Ninguno"}
`

  return {
    rawContext: ctxStr,
    health,
    goals,
    ccSummary,
    recurring,
    currency,
    userName,
    plan,
    memory,
  }
}
