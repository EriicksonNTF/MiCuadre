"use client"

import Link from "next/link"
import { CalendarDays, ChevronRight, CreditCard, MoreHorizontal, PiggyBank, Repeat, Settings, TrendingDown } from "lucide-react"
import type { Notification } from "@/lib/types/database"
import { formatNotificationDateTime, formatNotificationTime } from "@/lib/notifications/format-notification-date"
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

export function NotificationCard({ notification, onRead }: NotificationCardProps) {
  const style = getStyle(notification)
  const Icon = style.icon
  const isUnread = !notification.read
  const message = cleanMoneyText(notification.message || "")
  const hasDetail = Boolean(notification.action_url)

  return (
    <article
      className="relative rounded-[28px] border border-border bg-card p-5 shadow-sm"
      role="button"
      tabIndex={isUnread ? 0 : undefined}
      onClick={() => {
        if (isUnread) onRead(notification.id)
      }}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && isUnread) {
          e.preventDefault()
          onRead(notification.id)
        }
      }}
    >
      <div className="grid grid-cols-[56px_1fr] gap-4">
        <div className="relative">
          <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${style.iconClass}`}>
            <Icon className="h-6 w-6" />
          </div>

          {isUnread ? <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-primary ring-4 ring-card" /> : null}
        </div>

        <div className="min-w-0">
          <div className="mb-3 flex items-start justify-between gap-3">
            <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${style.badgeClass}`}>
              {style.label}
            </span>

            <div className="flex shrink-0 items-center gap-3">
              <time className="text-sm font-medium text-muted-foreground">{formatNotificationTime(notification.created_at)}</time>
              <button type="button" className="rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Opciones">
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </div>
          </div>

          <h3 className="text-[19px] font-bold leading-tight text-foreground">{notification.title}</h3>

          <div className="mt-2 space-y-1">
            <p className="text-[15px] leading-relaxed text-muted-foreground">{message}</p>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4 shrink-0" />
              <span className="truncate">{formatNotificationDateTime(notification.created_at)}</span>
            </div>

            {hasDetail ? (
              <Link href={notification.action_url!} className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-sm font-semibold text-foreground transition hover:bg-muted">
                Ver detalle
                <ChevronRight className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  )
}
