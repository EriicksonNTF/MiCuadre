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
    description: "Bueno para empezar",
    audience: "Organización financiera básica sin costo.",
    price: {
      monthly: 0,
      yearly: 0,
      yearlyMonthlyEquivalent: 0,
    },
    benefits: [
      "Hasta 3 cuentas",
      "Hasta 2 metas",
      "Hasta 3 suscripciones",
      "Reportes básicos",
    ],
    limits: ENTITLEMENTS_BY_PLAN.free,
    cta: "Seguir con Free",
  },
  pro: {
    id: "pro",
    label: "Pro",
    shortLabel: "Pro",
    description: "Control completo",
    audience: "Acceso completo a MiCuadre, sin límites y con herramientas avanzadas.",
    badge: "Recomendado",
    price: {
      monthly: 2.99,
      yearly: 28.7,
      yearlyMonthlyEquivalent: 2.39,
    },
    benefits: [
      "Cuentas, metas y suscripciones ilimitadas",
      "Reportes avanzados",
      "MIA avanzada",
      "Exportaciones CSV/Excel",
      "Acceso completo a MiCuadre",
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
  return interval === "monthly" ? "/mes" : "/año"
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
