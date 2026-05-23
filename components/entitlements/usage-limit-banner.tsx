"use client"

import { AlertTriangle } from "lucide-react"
import { buildEntitlementBlockedMessage } from "@/lib/entitlements/entitlement-copy"
import type { FeatureKey } from "@/types/billing"

export function UsageLimitBanner({
  feature,
  limit,
  currentUsage,
}: {
  feature: Extract<FeatureKey, "max_accounts" | "max_goals">
  limit?: number
  currentUsage?: number
}) {
  const message = buildEntitlementBlockedMessage(feature, limit)

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p className="text-xs font-medium">
          {message}
          {typeof currentUsage === "number" && typeof limit === "number" ? ` (${currentUsage}/${limit})` : ""}
        </p>
      </div>
    </div>
  )
}
