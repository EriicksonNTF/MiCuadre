"use client"

import { cn } from "@/lib/utils"
import type { PlanTier } from "@/types/billing"

const labels: Record<PlanTier, string> = {
  free: "Free",
  pro: "Pro",
  plus: "Plus",
}

export function PlanBadge({ plan, className }: { plan: PlanTier; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
        plan === "free" && "bg-muted text-muted-foreground",
        plan === "pro" && "bg-primary/15 text-primary",
        plan === "plus" && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
        className
      )}
    >
      {labels[plan]}
    </span>
  )
}
