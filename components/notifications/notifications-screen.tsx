"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Check } from "lucide-react"
import { useNotifications, markNotificationAsRead, markAllNotificationsAsRead } from "@/hooks/use-data"
import { NotificationStack } from "@/components/notifications/notification-stack"
import { NotificationFilterTabs } from "@/components/notifications/notification-filter-tabs"
import { NotificationEmptyState } from "@/components/notifications/notification-empty-state"
import { matchesNotificationFilter, type NotificationFilterKey } from "@/lib/notifications/notification-type-map"

function emptyMessageByFilter(filter: NotificationFilterKey) {
  if (filter === "movement") return "No hay movimientos recientes para este filtro."
  if (filter === "subscription") return "No hay suscripciones recientes para este filtro."
  if (filter === "planning") return "No hay alertas de planificación en este momento."
  if (filter === "system") return "No hay notificaciones del sistema en este momento."
  return "Cuando registres movimientos, pagos o alertas importantes, aparecerán aquí."
}

export function NotificationsScreen() {
  const { data: notifications = [] } = useNotifications()
  const [filter, setFilter] = useState<NotificationFilterKey>("all")

  const filteredNotifications = useMemo(() => notifications.filter((item) => matchesNotificationFilter(item, filter)), [notifications, filter])
  const unreadCount = notifications.filter((n) => !n.read).length

  const markAsRead = async (id: string) => {
    try {
      await markNotificationAsRead(id)
    } catch {
      // noop
    }
  }

  const markAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead()
    } catch {
      // noop
    }
  }

  return (
    <main className="min-h-screen bg-background pb-nav-safe text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-5 pb-4 pt-4 backdrop-blur">
        <div className="mx-auto max-w-xl">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <Link href="/dashboard" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted text-foreground transition hover:bg-accent" aria-label="Volver">
                <ArrowLeft className="h-6 w-6" />
              </Link>

              <div className="min-w-0">
                <h1 className="text-3xl font-bold tracking-tight text-foreground">Notificaciones</h1>
                <p className="text-sm text-muted-foreground">{unreadCount} sin leer</p>
              </div>
            </div>

            <button type="button" onClick={markAllAsRead} className="inline-flex h-12 shrink-0 items-center gap-2 rounded-full border border-border bg-card px-5 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted">
              <Check className="h-4 w-4" />
              Marcar todo
            </button>
          </div>

          <NotificationFilterTabs value={filter} onChange={setFilter} />
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-xl flex-col gap-4 px-5 pt-5">
        {filteredNotifications.length > 0 ? (
          <NotificationStack notifications={filteredNotifications} onRead={markAsRead} />
        ) : (
          <NotificationEmptyState message={emptyMessageByFilter(filter)} />
        )}
      </section>
    </main>
  )
}
