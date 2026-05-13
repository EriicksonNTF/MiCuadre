"use client"

import { useEffect } from "react"

export function BodyCleanup() {
  useEffect(() => {
    document.body.classList.remove("modal-open", "mobile-form-open")

    const clearStaleLocks = () => {
      const hasModal = document.querySelector('[data-app-modal="true"]')
      if (!hasModal) {
        document.body.classList.remove("modal-open", "mobile-form-open")
      }
    }

    window.addEventListener("pageshow", clearStaleLocks)

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        clearStaleLocks()
      }
    })

    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(clearStaleLocks, { timeout: 1200 })
    } else {
      setTimeout(clearStaleLocks, 300)
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/service-worker.js")
        .then((reg) => {
          reg.update()
          console.log("SW registered:", reg.scope)
        })
        .catch((err) => console.log("SW registration failed:", err))
    }

    return () => {
      window.removeEventListener("pageshow", clearStaleLocks)
    }
  }, [])

  return null
}