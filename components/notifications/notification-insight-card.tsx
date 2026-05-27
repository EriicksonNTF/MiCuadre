"use client"

import { Lightbulb } from "lucide-react"
import { NotificationBadge } from "@/components/notifications/notification-badge"

type NotificationInsightCardProps = {
  title: string
  description: string
}

export function NotificationInsightCard({ title, description }: NotificationInsightCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-cyan-200/70 bg-gradient-to-br from-cyan-50 via-white to-emerald-50 p-4 shadow-[0_8px_28px_-18px_rgba(6,182,212,0.55)] dark:border-cyan-900/50 dark:from-cyan-950/40 dark:via-card dark:to-emerald-950/30">
      <div className="absolute -right-8 -top-10 h-24 w-24 rounded-full bg-cyan-300/20 blur-2xl" />
      <div className="relative flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-500/15 text-cyan-700 dark:text-cyan-300">
          <Lightbulb className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <NotificationBadge label="Recomendación MIA" tone="insight" />
          </div>
          <p className="mt-2 text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  )
}
