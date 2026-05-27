"use client"

import type { Notification } from "@/lib/types/database"
import { NotificationCard } from "@/components/notifications/notification-card"

type NotificationStackProps = {
  notifications: Notification[]
  onRead: (id: string) => void
}

export function NotificationStack({ notifications, onRead }: NotificationStackProps) {
  return (
    <div className="space-y-3">
      {notifications.map((notification) => (
        <div key={notification.id} className="animate-[notification-in_.26s_ease-out]">
          <NotificationCard notification={notification} onRead={onRead} />
        </div>
      ))}
    </div>
  )
}
