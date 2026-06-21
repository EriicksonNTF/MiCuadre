"use client"

import { useEffect } from "react"
import { showToast } from "@/components/toast/smart-toast"
import { syncPendingOperations } from "@/lib/offline/sync-engine"

const SW_URL = "/sw.js"

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator)) return

    if (process.env.NODE_ENV === "development") {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => {
          for (const registration of registrations) {
            registration.unregister().catch(() => null)
          }
        })
        .catch(() => null)
      return
    }

    let refreshing = false

    const onControllerChange = () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    }

    // Handle messages from Service Worker (e.g., background sync trigger)
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "BACKGROUND_SYNC_TRIGGER") {
        syncPendingOperations()
      }
    }

    navigator.serviceWorker.addEventListener("message", onMessage)
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange)

    navigator.serviceWorker
      .register(SW_URL, { scope: "/" })
      .then((registration) => {
        registration.update().catch(() => null)

        if (registration.waiting) {
          registration.waiting.postMessage("SKIP_WAITING")
        }

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing
          if (!newWorker) return
          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "activated" &&
              navigator.serviceWorker.controller
            ) {
              showToast({
                type: "info",
                title: "MiCuadre actualizado",
                body: "Tenemos una nueva versión lista.",
                duration: 3500,
              })
            }
          })
        })
      })
      .catch(() => null)

    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage)
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange
      )
    }
  }, [])

  return null
}
