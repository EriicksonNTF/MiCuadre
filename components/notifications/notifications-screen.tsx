"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  ChevronLeft,
  Bell,
  Check,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useNotifications, markNotificationAsRead, markAllNotificationsAsRead } from "@/hooks/use-data"
import { NotificationStack } from "@/components/notifications/notification-stack"
import { NotificationInsightCard } from "@/components/notifications/notification-insight-card"

type NotificationType = "transaction" | "goal" | "credit" | "system" | "transfer" | "subscription"

type FilterType = "all" | NotificationType

export function NotificationsScreen() {
  const { data: notifications = [] } = useNotifications()
  const [filter, setFilter] = useState<FilterType>("all")
  const [dismissedIds, setDismissedIds] = useState<string[]>([])

  const liveNotifications = useMemo(
    () => notifications.filter((item) => !dismissedIds.includes(item.id)),
    [dismissedIds, notifications]
  )

  const filteredNotifications = useMemo(() =>
    filter === "all"
      ? liveNotifications
      : liveNotifications.filter((n) => n.type === filter)
  , [filter, liveNotifications])

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

  const dismissNotification = (id: string) => {
    setDismissedIds((prev) => [...prev, id])
  }

  const smartInsight = useMemo(() => {
    if (filteredNotifications.length === 0) return null
    const unread = filteredNotifications.filter((n) => !n.read)
    const latest = unread[0] || filteredNotifications[0]
    return {
      title: latest.title,
      description: latest.message,
    }
  }, [filteredNotifications])

  return (
    <div className="app-scroll min-h-[100dvh] overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(15,118,110,0.12),_transparent_45%),linear-gradient(180deg,#f8f6f0_0%,#f7f5ef_42%,#f3f2ee_100%)] pb-nav-safe dark:bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.2),_transparent_30%),linear-gradient(180deg,#070b12_0%,#0a1018_100%)]">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto max-w-md px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"
              >
                <ChevronLeft className="h-5 w-5 text-foreground" />
              </Link>
                <div>
                <h1 className="text-xl font-semibold tracking-tight text-foreground">
                  Notificaciones
                </h1>
                {unreadCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {unreadCount} sin leer
                  </p>
                )}
              </div>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-1.5 rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-xs font-medium text-foreground"
              >
                <Check className="h-3.5 w-3.5" />
                Marcar todo
              </button>
            )}
          </div>

          {/* Filter tabs */}
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {[
              { value: "all", label: "Todas" },
              { value: "transaction", label: "Transacciones" },
              { value: "goal", label: "Metas" },
              { value: "credit", label: "Tarjetas" },
              { value: "subscription", label: "Suscripciones" },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setFilter(tab.value as FilterType)}
                className={cn(
                  "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  filter === tab.value
                    ? "bg-foreground text-background"
                    : "bg-background/70 text-muted-foreground ring-1 ring-border/70"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="mx-auto max-w-md px-6 pt-4">
        {smartInsight && (
          <div className="mb-4">
            <NotificationInsightCard title={smartInsight.title} description={smartInsight.description} />
          </div>
        )}

        {filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-card/80 shadow-sm ring-1 ring-border/60">
              <Bell className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm font-medium text-foreground">
              No hay notificaciones
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Te avisaremos cuando ocurra algo importante
            </p>
          </div>
        ) : (
          <NotificationStack
            notifications={filteredNotifications}
            onRead={markAsRead}
            onDismiss={dismissNotification}
          />
        )}
      </div>

      <style jsx global>{`
        @keyframes notification-in {
          0% { opacity: 0; transform: translateY(8px) scale(0.985); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}
