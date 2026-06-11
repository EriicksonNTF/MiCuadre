"use client"

import { useState } from "react"
import { Sparkles } from "lucide-react"
import { PlanBadge } from "@/components/entitlements/plan-badge"
import { PlanSelectorSheet } from "@/components/billing/plan-selector-sheet"
import { getEntitlementCopy } from "@/lib/entitlements/entitlement-copy"
import type { FeatureKey } from "@/types/billing"

export function UpgradePrompt({
  feature = "advanced_reports",
  title,
  description,
}: {
  title?: string
  description?: string
  feature?: FeatureKey
}) {
  const [isOpen, setIsOpen] = useState(false)
  const copy = getEntitlementCopy(feature)
  const resolvedTitle = title || copy.title
  const resolvedDescription = description || copy.shortDescription

  return (
    <>
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 rounded-xl bg-gradient-to-br from-primary/10 to-emerald-500/10 p-3 dark:to-emerald-900/20">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2 text-primary"><Sparkles className="h-4 w-4" /></div>
              <p className="text-sm font-semibold text-foreground">{resolvedTitle}</p>
            </div>
            <PlanBadge plan="pro" />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{resolvedDescription}</p>
        </div>

        <div className="flex items-center gap-2">
          <button type="button"
            onClick={() => setIsOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition active:scale-[0.98]"
          >
            Actualizar a Pro
          </button>
          <button type="button"
            onClick={() => setIsOpen(true)}
            className="inline-flex rounded-lg bg-muted px-3 py-1.5 text-xs font-semibold text-foreground"
          >
            Ver planes
          </button>
        </div>
      </div>

      <PlanSelectorSheet
        open={isOpen}
        onOpenChange={setIsOpen}
        reasonTitle={copy.title}
        reasonBody={copy.blockedMessage}
      />
    </>
  )
}
