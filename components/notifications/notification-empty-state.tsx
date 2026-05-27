"use client"

import { Bell } from "lucide-react"

export function NotificationEmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-[28px] border border-border bg-card p-8 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
        <Bell className="h-6 w-6 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-bold text-foreground">No tienes notificaciones</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{message}</p>
    </div>
  )
}
