import { toast } from "@/components/ui/use-toast"

export const NOTIFICATIONS_DEBUG = true

export function notify({ title, message }: { title: string; message: string }) {
  if (NOTIFICATIONS_DEBUG) {
    console.log("🔔", title, message)
  }

  toast({
    title,
    description: message,
    duration: 2000,
  })
}
