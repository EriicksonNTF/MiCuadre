"use client"

import { useState } from "react"
import { notify } from "@/lib/notifications"
import { getEntitlementCopy } from "@/lib/entitlements/entitlement-copy"
import type { EntitlementBlockedResponse } from "@/types/billing"

function isEntitlementBlockedResponse(value: unknown): value is EntitlementBlockedResponse {
  if (!value || typeof value !== "object") return false
  const candidate = value as Record<string, unknown>
  return candidate.allowed === false && typeof candidate.feature === "string" && typeof candidate.reason === "string"
}

function formatBlockedMessage(blocked: EntitlementBlockedResponse) {
  const copy = getEntitlementCopy(blocked.feature)
  const fallback = copy.blockedMessage.replace("{limit}", String(blocked.limit ?? ""))

  if (typeof blocked.currentUsage === "number" && typeof blocked.limit === "number") {
    return `${fallback} (${blocked.currentUsage}/${blocked.limit})`
  }
  return blocked.reason || fallback
}

export function useEntitlementBlocked() {
  const [blocked, setBlocked] = useState<EntitlementBlockedResponse | null>(null)
  const [isUpsellOpen, setIsUpsellOpen] = useState(false)

  const handleEntitlementBlocked = (response: unknown) => {
    if (!isEntitlementBlockedResponse(response)) return false

    setBlocked(response)
    setIsUpsellOpen(true)
    const copy = getEntitlementCopy(response.feature)
    notify({
      title: copy.title,
      message: formatBlockedMessage(response),
    })
    return true
  }

  const closeUpsell = () => setIsUpsellOpen(false)

  return {
    blocked,
    isUpsellOpen,
    handleEntitlementBlocked,
    closeUpsell,
  }
}
