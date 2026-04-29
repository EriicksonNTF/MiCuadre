"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ChevronLeft,
  TrendingUp,
  TrendingDown,
  Target,
  CreditCard,
  Bell,
  Check,
  Trash2,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

type NotificationType = "transaction" | "goal" | "credit" | "system"

type Notification = {
  id: string
  title: string
  message: string
  type: NotificationType
  read: boolean
  createdAt: string
  relatedId?: string
}

const mockNotifications: Notification[] = [
  {
    id: "1",
    title: "Gasto registrado",
    message: "Se registró un gasto de RD$2,850 en Comida",
    type: "transaction",
    read: false,
    createdAt: "Hace 5 min",
  },
  {
    id: "2",
    title: "Meta alcanzada al 80%",
    message: "Tu meta 'Viaje a Punta Cana' está casi completa",
    type: "goal",
    read: false,
    createdAt: "Hace 1 hora",
  },
  {
    id: "3",
    title: "Fecha de corte próxima",
    message: "Tu tarjeta Visa Platinum corta en 3 días",
    type: "credit",
    read: false,
    createdAt: "Hace 2 horas",
  },
  {
    id: "4",
    title: "Ingreso registrado",
    message: "Se registró un ingreso de RD$85,000",
    type: "transaction",
    read: true,
    createdAt: "Ayer",
  },
  {
    id: "5",
    title: "Pago realizado",
    message: "Pagaste RD$15,000 a tu tarjeta de crédito",
    type: "credit",
    read: true,
    createdAt: "Ayer",
  },
  {
    id: "6",
    title: "Nueva meta creada",
    message: "Creaste la meta 'Fondo de emergencia'",
    type: "goal",
    read: true,
    createdAt: "25 Abr",
  },
]

const typeIcons: Record<NotificationType, typeof Bell> = {
  transaction: TrendingDown,
  goal: Target,
  credit: CreditCard,
  system: Bell,
}

const typeColors: Record<NotificationType, string> = {
  transaction: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  goal: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
  credit: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
  system: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
}

type FilterType = "all" | NotificationType

export function NotificationsScreen() {
  const [notifications, setNotifications] = useState(mockNotifications)
  const [filter, setFilter] = useState<FilterType>("all")
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const filteredNotifications =
    filter === "all"
      ? notifications
      : notifications.filter((n) => n.type === filter)

  const unreadCount = notifications.filter((n) => !n.read).length

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
  }

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const deleteNotification = (id: string) => {
    setDeletingId(id)
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id))
      setDeletingId(null)
    }, 300)
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-xl">
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
                <h1 className="text-lg font-semibold text-foreground">
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
                className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-foreground"
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
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setFilter(tab.value as FilterType)}
                className={cn(
                  "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  filter === tab.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
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
        {filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Bell className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm font-medium text-foreground">
              No hay notificaciones
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Te avisaremos cuando ocurra algo
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredNotifications.map((notification) => {
              const Icon = typeIcons[notification.type]
              return (
                <div
                  key={notification.id}
                  className={cn(
                    "relative flex gap-4 rounded-2xl p-4 transition-all",
                    notification.read
                      ? "bg-card"
                      : "bg-card ring-2 ring-accent/20",
                    deletingId === notification.id &&
                      "translate-x-full opacity-0"
                  )}
                  onClick={() => !notification.read && markAsRead(notification.id)}
                >
                  {/* Unread indicator */}
                  {!notification.read && (
                    <div className="absolute left-2 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-accent" />
                  )}

                  {/* Icon */}
                  <div
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
                      typeColors[notification.type]
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={cn(
                          "font-medium",
                          notification.read
                            ? "text-foreground"
                            : "text-foreground"
                        )}
                      >
                        {notification.title}
                      </p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteNotification(notification.id)
                        }}
                        className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {notification.message}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {notification.createdAt}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
