import type { Notification } from "@/lib/types/database"

export type NotificationFilterKey = "all" | "movement" | "subscription" | "planning" | "system"

export type NotificationVisualType = "movement" | "subscription" | "planning" | "system" | "card"

export function getNotificationVisualType(notification: Notification): NotificationVisualType {
  const type = notification.type
  if (type === "transaction" || type === "transfer") return "movement"
  if (type === "subscription") return "subscription"
  if (type === "goal") return "planning"
  if (type === "credit") return "card"
  return "system"
}

export function matchesNotificationFilter(notification: Notification, filter: NotificationFilterKey) {
  if (filter === "all") return true

  const visual = getNotificationVisualType(notification)
  if (filter === "movement") return visual === "movement"
  if (filter === "subscription") return visual === "subscription"
  if (filter === "planning") return visual === "planning" || visual === "card"
  if (filter === "system") return visual === "system"

  return true
}
