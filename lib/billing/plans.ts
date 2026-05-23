import { ENTITLEMENTS_BY_PLAN } from "@/lib/entitlements/entitlements"
import type { BillingInterval, PaidPlanTier, PlanTier } from "@/types/billing"

export const BILLING_INTERVALS: BillingInterval[] = ["monthly", "yearly"]

export const PLAN_ORDER: PlanTier[] = ["free", "pro", "plus"]

export const PAID_PLAN_ORDER: PaidPlanTier[] = ["pro", "plus"]

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
      "Reportes básicos",
      "MIA básica",
    ],
    limits: ENTITLEMENTS_BY_PLAN.free,
    cta: "Seguir con Free",
  },
  pro: {
    id: "pro",
    label: "Pro",
    shortLabel: "Pro",
    description: "Para tener más control",
    audience: "Ideal si quieres más capacidad, mejores reportes y MIA avanzada.",
    badge: "Recomendado",
    price: {
      monthly: 1.99,
      yearly: 19.1,
      yearlyMonthlyEquivalent: 1.59,
    },
    benefits: [
      "Cuentas y metas ilimitadas",
      "Reportes avanzados",
      "MIA avanzada",
      "Hasta 10 suscripciones financieras",
      "Exportaciones CSV/Excel",
    ],
    limits: ENTITLEMENTS_BY_PLAN.pro,
    cta: "Actualizar a Pro",
  },
  plus: {
    id: "plus",
    label: "Plus",
    shortLabel: "Plus",
    description: "El plan más completo",
    audience: "Para control avanzado, más capacidad y funciones premium.",
    badge: "Más completo",
    price: {
      monthly: 3.99,
      yearly: 38.3,
      yearlyMonthlyEquivalent: 3.19,
    },
    benefits: [
      "Todo lo incluido en Pro",
      "Suscripciones financieras ilimitadas",
      "Más capacidad para control avanzado",
      "Insights premium listos para futuras funciones",
      "Prioridad en mejoras premium",
    ],
    limits: ENTITLEMENTS_BY_PLAN.plus,
    cta: "Actualizar a Plus",
  },
}

export function isPaidPlan(plan: PlanTier): plan is PaidPlanTier {
  return plan === "pro" || plan === "plus"
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
  if (plan === "pro" || plan === "plus" || plan === "free") return plan
  if (plan === "business") return "plus"
  return "free"
}
