import { ENTITLEMENTS_BY_PLAN } from "@/lib/entitlements/entitlements"
import type { BillingInterval, PaidPlanTier, PlanTier } from "@/types/billing"

export const BILLING_INTERVALS: BillingInterval[] = ["monthly", "yearly"]
export const PLAN_ORDER: PlanTier[] = ["free", "pro"]
export const PAID_PLAN_ORDER: PaidPlanTier[] = ["pro"]
export const ANNUAL_DISCOUNT_PERCENT = 20

type PlanPrice = {
  monthly: number
  yearly: number
  yearlyMonthlyEquivalent: number
}

export type PublicPlanConfig = {
  id: PlanTier
  label: string
  shortLabel: string
  description: string
  audience: string
  badge?: string
  price: PlanPrice
  benefits: string[]
  limits: (typeof ENTITLEMENTS_BY_PLAN)[PlanTier]
  cta: string
}

export const PLAN_CONFIG: Record<PlanTier, PublicPlanConfig> = {
  free: {
    id: "free",
    label: "Free",
    shortLabel: "Free",
    description: "Para empezar a organizar tus finanzas.",
    audience: "Para empezar a organizar tus finanzas.",
    price: {
      monthly: 0,
      yearly: 0,
      yearlyMonthlyEquivalent: 0,
    },
    benefits: [
      "3 cuentas",
      "10 transacciones por día",
      "Historial básico",
      "1 suscripción financiera",
      "Sin módulos avanzados de planificación",
    ],
    limits: ENTITLEMENTS_BY_PLAN.free,
    cta: "Seguir con Free",
  },
  pro: {
    id: "pro",
    label: "Pro",
    shortLabel: "Pro",
    description: "Para controlar tu dinero sin limites.",
    audience: "Para controlar tu dinero sin limites.",
    badge: "Recomendado",
    price: {
      monthly: 2.99,
      yearly: 28.7,
      yearlyMonthlyEquivalent: 2.39,
    },
    benefits: [
      "Cuentas ilimitadas",
      "Transacciones ilimitadas",
      "Historial completo",
      "Presupuestos ilimitados",
      "Suscripciones financieras ilimitadas",
      "Deudas ilimitadas",
      "Calendario financiero completo",
      "Automatización de suscripciones",
      "Alertas previas de pagos",
      "Reportes avanzados",
      "MIA avanzada",
      "Exportaciones CSV/Excel",
    ],
    limits: ENTITLEMENTS_BY_PLAN.pro,
    cta: "Actualizar a Pro",
  },
}

export function isPaidPlan(plan: PlanTier): plan is PaidPlanTier {
  return plan === "pro"
}

export function formatPlanPrice(plan: PlanTier, interval: BillingInterval) {
  const amount = PLAN_CONFIG[plan].price[interval]
  if (amount === 0) return "$0"
  return `$${amount.toFixed(2)}`
}

export function getBillingIntervalSuffix(interval: BillingInterval) {
  return interval === "monthly" ? "/mes" : "/ano"
}

export function getFinancialSubscriptionLimitLabel(plan: PlanTier) {
  const limit = ENTITLEMENTS_BY_PLAN[plan].financial_subscriptions
  if (limit === "unlimited") return "Ilimitadas"
  if (limit === 0) return "No incluido"
  return `Hasta ${limit}`
}

export function normalizePlanTier(plan: string | null | undefined): PlanTier {
  if (plan === "pro" || plan === "free") return plan
  if (plan === "plus" || plan === "business") return "pro"
  return "free"
}
