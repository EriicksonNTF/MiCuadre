"use client"

import { cn } from "@/lib/utils"

type NotificationBadgeProps = {
  label: string
  tone?: "neutral" | "success" | "warning" | "insight"
}

const toneStyles: Record<NonNullable<NotificationBadgeProps["tone"]>, string> = {
  neutral: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  warning: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  insight: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
}

export function NotificationBadge({ label, tone = "neutral" }: NotificationBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[0.625rem] font-semibold uppercase tracking-wide",
        toneStyles[tone]
      )}
    >
      {label}
    </span>
  )
}
