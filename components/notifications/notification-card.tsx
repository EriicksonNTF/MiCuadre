"use client"

import { useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Bell, CreditCard, Target, TrendingDown, TrendingUp, X } from "lucide-react"
import type { Notification } from "@/lib/types/database"
import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/data"
import { NotificationBadge } from "@/components/notifications/notification-badge"

type ExtendedType = "transaction" | "goal" | "credit" | "system" | "transfer" | "subscription"

type NotificationCardProps = {
  notification: Notification
  onRead: (id: string) => void
  onDismiss: (id: string) => void
}

const typeMeta: Record<ExtendedType, { icon: typeof Bell; glow: string; surface: string; badge: string; tone: "neutral" | "success" | "warning" | "insight" }> = {
  transaction: {
    icon: TrendingDown,
    glow: "shadow-[0_14px_34px_-22px_rgba(15,118,110,0.55)]",
    surface: "from-emerald-500/18 to-emerald-400/5",
    badge: "Movimiento",
    tone: "success",
  },
  goal: {
    icon: Target,
    glow: "shadow-[0_14px_34px_-22px_rgba(5,150,105,0.55)]",
    surface: "from-emerald-500/16 to-emerald-300/0",
    badge: "Meta",
    tone: "success",
  },
  credit: {
    icon: CreditCard,
    glow: "shadow-[0_14px_34px_-22px_rgba(234,88,12,0.5)]",
    surface: "from-orange-500/20 to-orange-300/0",
    badge: "Tarjeta",
    tone: "warning",
  },
  system: {
    icon: Bell,
    glow: "shadow-[0_14px_34px_-22px_rgba(8,145,178,0.48)]",
    surface: "from-cyan-500/18 to-cyan-300/0",
    badge: "Sistema",
    tone: "insight",
  },
  transfer: {
    icon: TrendingUp,
    glow: "shadow-[0_14px_34px_-22px_rgba(30,64,175,0.45)]",
    surface: "from-blue-500/18 to-cyan-300/0",
    badge: "Transferencia",
    tone: "insight",
  },
  subscription: {
    icon: CreditCard,
    glow: "shadow-[0_14px_34px_-22px_rgba(217,119,6,0.48)]",
    surface: "from-amber-500/18 to-amber-300/0",
    badge: "Suscripcion",
    tone: "warning",
  },
}

function emphasizeMoney(text: string) {
  const tokens = text.split(/((?:RD\$|US\$|\$)\s?\d[\d,.]*)/g)
  return tokens.map((token, index) => {
    if (/^(?:RD\$|US\$|\$)\s?\d[\d,.]*$/.test(token)) {
      return (
        <span key={`${token}-${index}`} className="font-semibold text-foreground">
          {token}
        </span>
      )
    }
    return <span key={`${token}-${index}`}>{token}</span>
  })
}

export function NotificationCard({ notification, onRead, onDismiss }: NotificationCardProps) {
  const kind = (notification.type as ExtendedType) || "system"
  const meta = typeMeta[kind]
  const Icon = meta.icon
  const [offset, setOffset] = useState(0)
  const pointerRef = useRef<{ x: number; y: number; active: boolean } | null>(null)

  const isUnread = !notification.read
  const hasAiInsight = useMemo(() => {
    const message = `${notification.title} ${notification.message}`.toLowerCase()
    return message.includes("mia") || message.includes("podrias") || message.includes("detecto")
  }, [notification.message, notification.title])

  return (
    <div className="relative overflow-hidden rounded-3xl" data-notification-row="true">
      <button
        onClick={() => onDismiss(notification.id)}
        className="absolute inset-y-0 right-0 z-0 flex w-14 items-center justify-center rounded-r-3xl bg-red-500 text-white"
        aria-label="Descartar"
      >
        <X className="h-4 w-4" />
      </button>

      <article
        className={cn(
          "group relative z-10 rounded-3xl border border-border/70 bg-card/95 p-4 backdrop-blur transition-all duration-300",
          meta.glow,
          isUnread && "ring-1 ring-emerald-400/35",
          offset !== 0 && "duration-150"
        )}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={(event) => {
          pointerRef.current = { x: event.clientX, y: event.clientY, active: true }
        }}
        onPointerMove={(event) => {
          const pointer = pointerRef.current
          if (!pointer || !pointer.active) return
          const dx = event.clientX - pointer.x
          const dy = event.clientY - pointer.y
          if (Math.abs(dx) <= Math.abs(dy) || dx > 0) return
          setOffset(Math.max(-58, dx))
        }}
        onPointerUp={() => {
          if (offset < -46) {
            onDismiss(notification.id)
          }
          setOffset(0)
          pointerRef.current = null
        }}
        onPointerCancel={() => {
          setOffset(0)
          pointerRef.current = null
        }}
        onClick={() => {
          if (isUnread) onRead(notification.id)
        }}
      >
        <div className={cn("pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br", meta.surface)} />

        <div className="relative flex items-start gap-3.5">
          <div className="relative shrink-0">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/70 text-foreground shadow-sm ring-1 ring-black/5 dark:bg-black/20">
              <Icon className="h-5 w-5" />
            </div>
            {isUnread && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-background" />}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <NotificationBadge label={meta.badge} tone={meta.tone} />
                {hasAiInsight && <NotificationBadge label="AI" tone="insight" />}
              </div>
              <p className="text-[11px] text-muted-foreground">{formatDate(notification.created_at)}</p>
            </div>

            <h3 className="mt-2 text-[15px] font-semibold leading-snug text-foreground">{notification.title}</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{emphasizeMoney(notification.message)}</p>

            {notification.action_url && (
              <div className="mt-3">
                <Link
                  href={notification.action_url}
                  className="inline-flex items-center rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-xs font-semibold text-foreground transition hover:-translate-y-0.5"
                >
                  Ver detalle
                </Link>
              </div>
            )}
          </div>
        </div>
      </article>
    </div>
  )
}
