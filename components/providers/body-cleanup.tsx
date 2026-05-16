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

    const PRIMARY_ROUTES = new Set(["/", "/dashboard", "/accounts", "/history", "/goals"])
    let edgeSwipeStart: { x: number; y: number; active: boolean } | null = null

    const onPointerDown = (event: PointerEvent) => {
      const path = window.location.pathname
      if (PRIMARY_ROUTES.has(path)) return
      const target = event.target as HTMLElement | null
      if (target?.closest("[data-no-edge-back='true']")) return
      if (event.clientX > 24) return
      edgeSwipeStart = { x: event.clientX, y: event.clientY, active: true }
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!edgeSwipeStart?.active) return
      const dx = event.clientX - edgeSwipeStart.x
      const dy = event.clientY - edgeSwipeStart.y
      if (dx > 64 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        edgeSwipeStart = null
        if (window.history.length > 1) window.history.back()
      }
    }

    const onPointerEnd = () => {
      edgeSwipeStart = null
    }

    window.addEventListener("pointerdown", onPointerDown, { passive: true })
    window.addEventListener("pointermove", onPointerMove, { passive: true })
    window.addEventListener("pointerup", onPointerEnd, { passive: true })
    window.addEventListener("pointercancel", onPointerEnd, { passive: true })

    return () => {
      window.removeEventListener("pageshow", clearStaleLocks)
      window.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", onPointerEnd)
      window.removeEventListener("pointercancel", onPointerEnd)
    }
  }, [])

  return null
}
