import { toast } from "sonner"

export const NOTIFICATIONS_DEBUG = true

export function notify({ title, message }: { title: string; message?: string }) {
  if (NOTIFICATIONS_DEBUG) {
    console.log("🔔", title, message)
  }

  toast.success(title, {
    description: message,
    duration: 3000,
  })
}
