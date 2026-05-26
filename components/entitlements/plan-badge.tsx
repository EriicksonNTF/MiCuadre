"use client"

import { cn } from "@/lib/utils"
import type { PlanTier } from "@/types/billing"

const labels: Record<PlanTier, string> = {
  free: "Free",
  pro: "Pro",
}

export function PlanBadge({ plan, className }: { plan: PlanTier; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
        plan === "free" && "bg-muted text-muted-foreground",
        plan === "pro" && "bg-primary/15 text-primary",
        className
      )}
    >
      {labels[plan]}
    </span>
  )
}
