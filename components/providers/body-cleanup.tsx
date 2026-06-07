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

    let edgeSwipeStart: { x: number; y: number; active: boolean } | null = null
    let navInProgress = false
    const currentPageElement = () =>
      (document.querySelector("main.app-scroll, div.app-scroll") as HTMLElement | null) ||
      (document.querySelector("#__next main, [data-root='true']") as HTMLElement | null) ||
      document.body
    const setPageOffset = (offset: number, animated: boolean) => {
      const page = currentPageElement()
      if (!page) return
      page.style.willChange = "transform"
      page.style.transition = animated ? "transform 200ms cubic-bezier(0.22, 0.61, 0.36, 1)" : "none"
      page.style.transform = `translate3d(${Math.max(0, offset)}px, 0, 0)`
    }
    const clearPageTransform = (page: HTMLElement) => {
      page.style.transition = ""
      page.style.willChange = ""
      page.style.transform = ""
    }
    const resetPageOffset = (animated: boolean) => {
      const page = currentPageElement()
      if (!page) return
      setPageOffset(0, animated)
      if (animated) {
        window.setTimeout(() => clearPageTransform(page), 220)
      } else {
        clearPageTransform(page)
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

    const resolveFallbackRoute = (pathname: string) => {
      if (pathname.startsWith("/settings")) return "/settings"
      return "/dashboard"
    }

    const finishGesture = (animateBack: boolean) => {
      if (animateBack) resetPageOffset(true)
      else resetPageOffset(false)
      edgeSwipeStart = null
    }

    const onPointerDown = (event: PointerEvent) => {
      if (navInProgress) return
      if (event.pointerType && event.pointerType !== "touch") return
      const path = window.location.pathname
      const target = event.target as HTMLElement | null
      if (shouldIgnoreGestureTarget(target)) return
      if (event.clientX > 24) return
      if (path === "/" || path === "/dashboard") return
      edgeSwipeStart = { x: event.clientX, y: event.clientY, active: true }
      setPageOffset(0, false)
    }

    const onPointerMove = (event: PointerEvent) => {
      if (navInProgress) return
      if (!edgeSwipeStart?.active) return
      const dx = event.clientX - edgeSwipeStart.x
      const dy = event.clientY - edgeSwipeStart.y
      if (dx > 0 && Math.abs(dx) > Math.abs(dy)) {
        setPageOffset(Math.min(dx * 0.88, window.innerWidth * 0.3), false)
      }
      if (dx > Math.min(96, window.innerWidth * 0.25) && Math.abs(dx) > Math.abs(dy) * 1.2) {
        if (navInProgress) return
        navInProgress = true
        edgeSwipeStart = null
        setPageOffset(Math.min(window.innerWidth * 0.5, 260), true)
        window.setTimeout(() => {
          window.location.assign(resolveFallbackRoute(window.location.pathname))
        }, 220)

        window.setTimeout(() => {
          navInProgress = false
        }, 500)
      }
    }

    const onPointerEnd = () => {
      if (navInProgress) return
      finishGesture(Boolean(edgeSwipeStart?.active))
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
