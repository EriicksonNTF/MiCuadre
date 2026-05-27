"use client"

import useSWR from "swr"
import { DEFAULT_PLAN } from "@/lib/entitlements/entitlements"
import type { BillingSubscriptionStatus, PlanTier } from "@/types/billing"

type BillingStatusSummary = {
  planTier: PlanTier
  planStatus: BillingSubscriptionStatus | "active"
  billingStatus: BillingSubscriptionStatus | "active"
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  billingReady: boolean
  paypalAvailable?: boolean
  lastSyncedAt?: string | null
}

export function useBillingStatus() {
  return useSWR<BillingStatusSummary>("billing_status", async () => {
    const response = await fetch("/api/billing/status", { method: "GET" })
    if (response.status === 401) {
      return {
        planTier: DEFAULT_PLAN,
        planStatus: "active",
        billingStatus: "active",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        billingReady: false,
        paypalAvailable: false,
        lastSyncedAt: null,
      }
    }

    if (!response.ok) {
      throw new Error("No se pudo leer estado de facturacion")
    }

    return response.json()
  })
}
