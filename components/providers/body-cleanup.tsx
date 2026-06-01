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
      if (process.env.NODE_ENV === "development") {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister().then((success) => {
              if (success) {
                console.log("SW unregistered successfully in development mode.")
              }
            })
          }
        }).catch((err) => console.log("Failed to get SW registrations:", err))
      } else {
        navigator.serviceWorker.register("/service-worker.js")
          .then((reg) => {
            reg.update()
            console.log("SW registered:", reg.scope)
          })
          .catch((err) => console.log("SW registration failed:", err))
      }
    }

    const PRIMARY_ROUTES = new Set(["/", "/dashboard", "/accounts", "/history", "/planning"])
    let edgeSwipeStart: { x: number; y: number; active: boolean } | null = null
    const currentPageElement = () => document.querySelector("main.app-scroll, div.app-scroll") as HTMLElement | null
    const setPageOffset = (offset: number, animated: boolean) => {
      const page = currentPageElement()
      if (!page) return
      page.style.willChange = "transform"
      page.style.transition = animated ? "transform 200ms cubic-bezier(0.22, 0.61, 0.36, 1)" : "none"
      page.style.transform = `translate3d(${Math.max(0, offset)}px, 0, 0)`
    }
    const resetPageOffset = (animated: boolean) => {
      const page = currentPageElement()
      if (!page) return
      setPageOffset(0, animated)
      if (animated) {
        window.setTimeout(() => {
          const latest = currentPageElement()
          if (!latest) return
          latest.style.transition = ""
          latest.style.willChange = ""
          latest.style.transform = ""
        }, 220)
      }
    }

    const shouldIgnoreGestureTarget = (target: HTMLElement | null) => {
      if (!target) return true
      if (target.closest("[data-no-edge-back='true']")) return true
      if (target.closest("input, textarea, select, button, [role='button'], [contenteditable='true']")) return true
      if (target.closest("[data-app-modal='true']")) return true
      if (target.closest("[data-swipe-confirm='true']")) return true
      const scrollHost = target.closest("[data-horizontal-scroll='true']") as HTMLElement | null
      if (scrollHost && scrollHost.scrollWidth > scrollHost.clientWidth) return true
      return false
    }

    const onPointerDown = (event: PointerEvent) => {
      const path = window.location.pathname
      if (PRIMARY_ROUTES.has(path)) return
      const target = event.target as HTMLElement | null
      if (shouldIgnoreGestureTarget(target)) return
      if (event.clientX > 24) return
      edgeSwipeStart = { x: event.clientX, y: event.clientY, active: true }
      setPageOffset(0, false)
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!edgeSwipeStart?.active) return
      const dx = event.clientX - edgeSwipeStart.x
      const dy = event.clientY - edgeSwipeStart.y
      if (dx > 0 && Math.abs(dx) > Math.abs(dy)) {
        setPageOffset(Math.min(dx * 0.88, window.innerWidth * 0.3), false)
      }
      if (dx > Math.min(96, window.innerWidth * 0.25) && Math.abs(dx) > Math.abs(dy) * 1.2) {
        edgeSwipeStart = null
        setPageOffset(Math.min(window.innerWidth * 0.34, 140), true)
        if (window.history.length > 1) {
          window.setTimeout(() => window.history.back(), 90)
        } else {
          window.setTimeout(() => window.location.assign("/dashboard"), 90)
        }
      }
    }

    const onPointerEnd = () => {
      if (edgeSwipeStart?.active) {
        resetPageOffset(true)
      }
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
