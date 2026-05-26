"use client"

import { useMemo, useState } from "react"
import { Bell, BellOff, CheckCircle2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { notify } from "@/lib/notifications"

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

function isIos() {
  if (typeof navigator === "undefined") return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isStandalonePwa() {
  if (typeof window === "undefined") return false
  return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function PushNotificationCard() {
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<NotificationPermission | "unsupported">(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission
  )
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

  const supportMessage = useMemo(() => {
    if (typeof window === "undefined") return null
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      return "Tu dispositivo no admite notificaciones push."
    }
    if (isIos() && !isStandalonePwa()) {
      return "En iPhone, agrega MiCuadre a la pantalla de inicio para activar notificaciones."
    }
    if (!vapidPublicKey) return "Falta configurar la clave pública VAPID."
    return null
  }, [vapidPublicKey])

  const activate = async () => {
    if (supportMessage || !vapidPublicKey) {
      notify({ title: "Notificaciones", message: supportMessage || "No se pudo activar en este dispositivo." })
      return
    }
    setIsLoading(true)
    try {
      const supabase = createClient()
      const { data: authData } = await supabase.auth.getUser()
      const user = authData.user
      if (!user) {
        notify({ title: "Sesión requerida", message: "Inicia sesión para activar notificaciones." })
        return
      }

      const permission = await Notification.requestPermission()
      setStatus(permission)
      if (permission !== "granted") {
        notify({ title: "Notificaciones", message: "No activaste los permisos de notificación." })
        return
      }

      const registration = await navigator.serviceWorker.register("/service-worker.js")
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      })
      const json = subscription.toJSON()
      const p256dh = json.keys?.p256dh
      const auth = json.keys?.auth
      if (!json.endpoint || !p256dh || !auth) throw new Error("Suscripción incompleta")

      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          endpoint: json.endpoint,
          p256dh,
          auth,
          user_agent: navigator.userAgent,
          platform: isIos() ? "ios-pwa" : "web",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" }
      )
      if (error) throw error
      notify({ title: "Notificaciones activadas", message: "Recibirás avisos de pagos y vencimientos." })
    } catch (error) {
      notify({ title: "No se pudieron activar", message: error instanceof Error ? error.message : "Intenta de nuevo más tarde." })
    } finally {
      setIsLoading(false)
    }
  }

  const enabled = status === "granted"

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
          {enabled ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Bell className="h-5 w-5 text-foreground" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">Activa las notificaciones</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {supportMessage || "Recibe avisos de pagos, vencimientos y movimientos importantes."}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={activate}
              disabled={isLoading || enabled || Boolean(supportMessage)}
              className="h-10 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition active:scale-[0.99] disabled:opacity-60"
            >
              {enabled ? "Notificaciones activadas" : isLoading ? "Activando..." : "Activar notificaciones"}
            </button>
            {!enabled && (
              <button type="button" className="h-10 rounded-xl bg-muted px-4 text-sm font-bold text-muted-foreground">
                Ahora no
              </button>
            )}
          </div>
        </div>
        {!enabled && <BellOff className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </div>
    </div>
  )
}
