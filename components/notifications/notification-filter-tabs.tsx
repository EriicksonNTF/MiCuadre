"use client"

import { cn } from "@/lib/utils"
import type { NotificationFilterKey } from "@/lib/notifications/notification-type-map"

const filters: Array<{ key: NotificationFilterKey; label: string }> = [
  { key: "all", label: "Todas" },
  { key: "movement", label: "Movimientos" },
  { key: "subscription", label: "Suscripciones" },
  { key: "planning", label: "Planificación" },
  { key: "system", label: "Sistema" },
]

export function NotificationFilterTabs({ value, onChange }: { value: NotificationFilterKey; onChange: (next: NotificationFilterKey) => void }) {
  return (
    <div className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {filters.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={cn(
            "shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
            value === tab.key
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
