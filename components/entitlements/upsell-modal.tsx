"use client"

import { PlanSelectorSheet } from "@/components/billing/plan-selector-sheet"
import { getEntitlementCopy } from "@/lib/entitlements/entitlement-copy"
import type { EntitlementBlockedResponse } from "@/types/billing"

function formatReason(blocked: EntitlementBlockedResponse) {
  const copy = getEntitlementCopy(blocked.feature)
  if (blocked.reason) return blocked.reason
  return copy.blockedMessage.replace("{limit}", String(blocked.limit ?? ""))
}

export function UpsellModal({
  open,
  onClose,
  blocked,
}: {
  open: boolean
  onClose: () => void
  blocked: EntitlementBlockedResponse | null
}) {
  const copy = blocked ? getEntitlementCopy(blocked.feature) : null

  return (
    <PlanSelectorSheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose()
      }}
      reasonTitle={copy?.title}
      reasonBody={blocked ? formatReason(blocked) : undefined}
    />
  )
}
