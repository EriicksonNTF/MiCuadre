import type { EntitlementBlockedResponse, FeatureKey } from "@/types/billing"

export type EntitlementCopyItem = {
  title: string
  shortDescription: string
  blockedMessage: string
  upgradeBenefit: string
  requiredPlanLabel: string
  icon: "wallet" | "target" | "bar-chart" | "sparkles" | "repeat" | "download"
}

export const ENTITLEMENT_COPY: Record<FeatureKey, EntitlementCopyItem> = {
  max_accounts: {
    title: "Límite de cuentas alcanzado",
    shortDescription: "Tu plan Free tiene un tope de cuentas activas.",
    blockedMessage: "Llegaste al límite de cuentas del plan Free. Actualiza a Pro para crear cuentas ilimitadas.",
    upgradeBenefit: "Con Pro organizas todas tus cuentas sin límites y mantienes tu panorama financiero completo.",
    requiredPlanLabel: "MiCuadre Pro",
    icon: "wallet",
  },
  max_goals: {
    title: "Límite de metas alcanzado",
    shortDescription: "Tu plan Free tiene un tope de metas de ahorro.",
    blockedMessage: "Llegaste al límite de metas del plan Free. Actualiza a Pro para crear metas ilimitadas.",
    upgradeBenefit: "Con Pro puedes crear todas las metas que necesites y seguir cada objetivo con claridad.",
    requiredPlanLabel: "MiCuadre Pro",
    icon: "target",
  },
  advanced_reports: {
    title: "Reportes avanzados disponibles en Pro",
    shortDescription: "Desbloquea análisis más profundos, comparativas e insights financieros avanzados.",
    blockedMessage: "Analiza tus ingresos, gastos y hábitos financieros con mayor detalle.",
    upgradeBenefit: "Con Pro accedes a análisis por cuenta, tendencias y vistas comparativas para decidir mejor.",
    requiredPlanLabel: "MiCuadre Pro",
    icon: "bar-chart",
  },
  mia_advanced: {
    title: "MIA avanzada está disponible en Pro",
    shortDescription: "Obtén recomendaciones más inteligentes y análisis personalizados con tus datos reales.",
    blockedMessage: "Recibe análisis más completos y recomendaciones financieras más inteligentes.",
    upgradeBenefit: "Con Pro obtienes respuestas más accionables y contexto financiero más preciso en MIA.",
    requiredPlanLabel: "MiCuadre Pro",
    icon: "sparkles",
  },
  financial_subscriptions: {
    title: "Llegaste al límite de suscripciones del plan Free",
    shortDescription: "Gestiona suscripciones recurrentes con mayor control y seguimiento.",
    blockedMessage: "Con Pro puedes registrar suscripciones ilimitadas y controlar mejor tus pagos recurrentes.",
    upgradeBenefit: "Con Pro controlas tus cargos recurrentes sin límites y mantienes tu flujo mensual bajo control.",
    requiredPlanLabel: "MiCuadre Pro",
    icon: "repeat",
  },
  exports: {
    title: "Exportaciones disponibles en Pro",
    shortDescription: "Exporta tus datos para análisis y respaldo cuando lo necesites.",
    blockedMessage: "Exporta tus datos para analizarlos o guardarlos cuando lo necesites.",
    upgradeBenefit: "Con Pro puedes exportar tus movimientos y reportes para compartir o profundizar análisis.",
    requiredPlanLabel: "MiCuadre Pro",
    icon: "download",
  },
}

export const BILLING_COPY = {
  checkout: {
    starting: "Iniciando proceso de pago seguro...",
    error: "No pudimos iniciar el pago. Por favor, intenta de nuevo en unos segundos.",
    unavailable: "No pudimos iniciar el checkout para este plan ahora mismo.",
  },
  portal: {
    opening: "Abriendo portal de facturación...",
    error: "No pudimos abrir el portal de facturación. ¿Tienes una suscripción activa?",
  },
  status: {
    pending: "Pago recibido. Estamos verificando tu plan con Stripe...",
    updated: "¡Tu plan se ha actualizado con éxito!",
    error: "No pudimos verificar el estado de tu pago. Se actualizará automáticamente en breve.",
    manualCheck: "Verificando el estado de tu suscripción...",
  },
  trust: {
    stripeBadge: "Pago seguro procesado por Stripe.",
    cancelAnytime: "Puedes cancelar en cualquier momento de forma simple.",
    noShare: "Tus datos financieros están 100% protegidos y no se comparten con terceros.",
    delayNote: "La activación de tu plan puede tardar unos segundos tras completar el pago.",
  },
  features: {
    genericLocked: "Esta función requiere una cuenta MiCuadre Pro.",
    accountLimitReached: "Llegaste al límite de cuentas del plan Free.",
    goalLimitReached: "Llegaste al límite de metas del plan Free.",
  }
}

export function getEntitlementCopy(feature: FeatureKey) {
  return ENTITLEMENT_COPY[feature]
}

export function buildEntitlementBlockedMessage(feature: FeatureKey, limit?: number) {
  const base = getEntitlementCopy(feature).blockedMessage
  return typeof limit === "number" ? base.replace("{limit}", String(limit)) : base.replace("hasta {limit} ", "")
}

export function createBlockedResponse(feature: FeatureKey, input?: {
  currentUsage?: number
  limit?: number
  requiredPlan?: EntitlementBlockedResponse["requiredPlan"]
}): EntitlementBlockedResponse {
  return {
    allowed: false,
    feature,
    reason: buildEntitlementBlockedMessage(feature, input?.limit),
    currentUsage: input?.currentUsage,
    limit: input?.limit,
    requiredPlan: input?.requiredPlan ?? "pro",
  }
}
