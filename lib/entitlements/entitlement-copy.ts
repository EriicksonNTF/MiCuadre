import type { EntitlementBlockedResponse, FeatureKey } from "@/types/billing"

export type EntitlementCopyItem = {
  title: string
  shortDescription: string
  blockedMessage: string
  upgradeBenefit: string
  requiredPlanLabel: string
  icon: "wallet" | "target" | "bar-chart" | "sparkles" | "repeat" | "download" | "debt"
}

export const ENTITLEMENT_COPY: Record<FeatureKey, EntitlementCopyItem> = {
  max_accounts: {
    title: "Limite de cuentas alcanzado",
    shortDescription: "Tu plan Free tiene un tope de cuentas activas.",
    blockedMessage: "Llegaste al limite de cuentas del plan Free. Actualiza a Pro para crear cuentas ilimitadas.",
    upgradeBenefit: "Con Pro organizas todas tus cuentas sin limites y mantienes tu panorama financiero completo.",
    requiredPlanLabel: "MiCuadre Pro",
    icon: "wallet",
  },
  max_daily_transactions: {
    title: "Límite diario alcanzado",
    shortDescription: "Tu plan Free permite hasta 10 transacciones por día.",
    blockedMessage: "Llegaste al límite diario de transacciones del plan Free. Actualiza a Pro para transacciones ilimitadas.",
    upgradeBenefit: "Con Pro puedes registrar movimientos sin límite diario.",
    requiredPlanLabel: "MiCuadre Pro",
    icon: "wallet",
  },
  max_goals: {
    title: "Limite de presupuestos alcanzado",
    shortDescription: "Tu plan Free tiene un tope de presupuestos activos.",
    blockedMessage: "Llegaste al limite de presupuestos del plan Free. Actualiza a Pro para crear presupuestos ilimitados.",
    upgradeBenefit: "Con Pro puedes crear todos los presupuestos que necesites y controlar tu mes por categoria.",
    requiredPlanLabel: "MiCuadre Pro",
    icon: "target",
  },
  max_budgets: {
    title: "Limite de presupuestos alcanzado",
    shortDescription: "Tu plan Free tiene un tope de presupuestos activos.",
    blockedMessage: "Llegaste al limite de presupuestos del plan Free. Actualiza a Pro para crear presupuestos ilimitados.",
    upgradeBenefit: "Con Pro puedes crear todos los presupuestos que necesites y controlar tu mes por categoria.",
    requiredPlanLabel: "MiCuadre Pro",
    icon: "target",
  },
  max_active_debts: {
    title: "Limite de deudas activas alcanzado",
    shortDescription: "Tu plan Free tiene un tope de deudas activas.",
    blockedMessage: "Llegaste al limite de deudas activas del plan Free. Actualiza a Pro para administrar deudas ilimitadas.",
    upgradeBenefit: "Con Pro llevas control completo de todas tus deudas sin limite.",
    requiredPlanLabel: "MiCuadre Pro",
    icon: "debt",
  },
  planning_full: {
    title: "Planificación completa disponible en Pro",
    shortDescription: "Presupuestos, calendario y deudas avanzadas están en Pro.",
    blockedMessage: "La planificación completa requiere una cuenta Pro.",
    upgradeBenefit: "Con Pro desbloqueas presupuestos inteligentes, calendario financiero y deudas.",
    requiredPlanLabel: "MiCuadre Pro",
    icon: "bar-chart",
  },
  advanced_reports: {
    title: "Reportes avanzados disponibles en Pro",
    shortDescription: "Desbloquea analisis mas profundos, comparativas e insights financieros avanzados.",
    blockedMessage: "Analiza tus ingresos, gastos y habitos financieros con mayor detalle.",
    upgradeBenefit: "Con Pro accedes a analisis por cuenta, tendencias y vistas comparativas para decidir mejor.",
    requiredPlanLabel: "MiCuadre Pro",
    icon: "bar-chart",
  },
  mia_advanced: {
    title: "MIA avanzada esta disponible en Pro",
    shortDescription: "Obten recomendaciones mas inteligentes y analisis personalizados con tus datos reales.",
    blockedMessage: "Recibe analisis mas completos y recomendaciones financieras mas inteligentes.",
    upgradeBenefit: "Con Pro obtienes respuestas mas accionables y contexto financiero mas preciso en MIA.",
    requiredPlanLabel: "MiCuadre Pro",
    icon: "sparkles",
  },
  financial_subscriptions: {
    title: "Llegaste al limite de suscripciones del plan Free",
    shortDescription: "Gestiona suscripciones recurrentes con mayor control y seguimiento.",
    blockedMessage: "Con Pro puedes registrar suscripciones ilimitadas y controlar mejor tus pagos recurrentes.",
    upgradeBenefit: "Con Pro controlas tus cargos recurrentes sin limites y mantienes tu flujo mensual bajo control.",
    requiredPlanLabel: "MiCuadre Pro",
    icon: "repeat",
  },
  exports: {
    title: "Exportaciones disponibles en Pro",
    shortDescription: "Exporta tus datos para analisis y respaldo cuando lo necesites.",
    blockedMessage: "Exporta tus datos para analizarlos o guardarlos cuando lo necesites.",
    upgradeBenefit: "Con Pro puedes exportar tus movimientos y reportes para compartir o profundizar analisis.",
    requiredPlanLabel: "MiCuadre Pro",
    icon: "download",
  },
}

export const BILLING_COPY = {
  checkout: {
    starting: "Iniciando proceso de pago seguro...",
    error: "No pudimos iniciar el pago ahora mismo.",
    unavailable: "No pudimos iniciar el checkout para este plan ahora mismo.",
  },
  portal: {
    opening: "Abriendo portal de facturacion...",
    error: "No pudimos abrir el portal de facturacion. ¿Tienes una suscripcion activa?",
  },
  status: {
    pending: "Pago recibido. Estamos verificando tu plan con Stripe...",
    updated: "Tu plan se ha actualizado con exito.",
    error: "No pudimos verificar el estado de tu pago. Se actualizara automaticamente en breve.",
    manualCheck: "Verificando el estado de tu suscripcion...",
  },
  trust: {
    stripeBadge: "Pago seguro procesado por Stripe.",
    cancelAnytime: "Puedes cancelar en cualquier momento de forma simple.",
    noShare: "Tus datos financieros estan 100% protegidos y no se comparten con terceros.",
    delayNote: "La activacion de tu plan puede tardar unos segundos tras completar el pago.",
  },
  features: {
    genericLocked: "Esta funcion requiere una cuenta MiCuadre Pro.",
    accountLimitReached: "Llegaste al limite de cuentas del plan Free.",
    goalLimitReached: "Llegaste al limite de presupuestos del plan Free.",
  },
}

export function getEntitlementCopy(feature: FeatureKey) {
  return ENTITLEMENT_COPY[feature]
}

export function buildEntitlementBlockedMessage(feature: FeatureKey, limit?: number) {
  const base = getEntitlementCopy(feature).blockedMessage
  return typeof limit === "number" ? base.replace("{limit}", String(limit)) : base.replace("hasta {limit} ", "")
}

export function createBlockedResponse(
  feature: FeatureKey,
  input?: {
    currentUsage?: number
    limit?: number
    requiredPlan?: EntitlementBlockedResponse["requiredPlan"]
  }
): EntitlementBlockedResponse {
  return {
    allowed: false,
    feature,
    reason: buildEntitlementBlockedMessage(feature, input?.limit),
    currentUsage: input?.currentUsage,
    limit: input?.limit,
    requiredPlan: input?.requiredPlan ?? "pro",
  }
}
