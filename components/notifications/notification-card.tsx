"use client"

import { memo } from "react"
import { CreditCard, PiggyBank, Repeat, Settings, TrendingDown } from "lucide-react"
import type { Notification } from "@/lib/types/database"
import { formatNotificationTime } from "@/lib/notifications/format-notification-date"
import { getNotificationVisualType } from "@/lib/notifications/notification-type-map"

type NotificationCardProps = {
  notification: Notification
  onRead: (id: string) => void
}

function cleanMoneyText(input: string) {
  return input
    .replace(/\bDOP\s*/g, "RD$")
    .replace(/\bUSD\s*/g, "US$")
    .replace(/\s{2,}/g, " ")
    .trim()
}

function getStyle(notification: Notification) {
  const visual = getNotificationVisualType(notification)

  if (visual === "movement") {
    return {
      label: "MOVIMIENTO",
      icon: TrendingDown,
      iconClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
      badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    }
  }
  if (visual === "subscription") {
    return {
      label: "SUSCRIPCIÓN",
      icon: Repeat,
      iconClass: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
      badgeClass: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    }
  }
  if (visual === "planning") {
    return {
      label: "PLANIFICACIÓN",
      icon: PiggyBank,
      iconClass: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
      badgeClass: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
    }
  }
  if (visual === "card") {
    return {
      label: "TARJETA",
      icon: CreditCard,
      iconClass: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
      badgeClass: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
    }
  }

  return {
    label: "SISTEMA",
    icon: Settings,
    iconClass: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
    badgeClass: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  }
}

export const NotificationCard = memo(function NotificationCard({ notification, onRead }: NotificationCardProps) {
  const style = getStyle(notification)
  const Icon = style.icon
  const isUnread = !notification.read
  const message = cleanMoneyText(notification.message || "")

  return (
    <article
      className="relative rounded-2xl border border-border bg-card p-3 shadow-sm"
      role="button"
      tabIndex={0}
      onClick={() => {
        if (isUnread) onRead(notification.id)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          if (isUnread) onRead(notification.id)
        }
      }}
    >
      <div className="flex gap-3">
        <div className="relative shrink-0">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${style.iconClass}`}>
            <Icon className="h-5 w-5" />
          </div>
          {isUnread ? <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-card" /> : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${style.badgeClass}`}>
                {style.label}
              </span>
              <time className="shrink-0 text-xs text-muted-foreground">{formatNotificationTime(notification.created_at)}</time>
            </div>
          </div>

          <h3 className="mt-1 text-sm font-semibold leading-tight text-foreground">{notification.title}</h3>

          {message ? (
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground line-clamp-2">{message}</p>
          ) : null}
        </div>
      </div>
    </article>
  )
})
