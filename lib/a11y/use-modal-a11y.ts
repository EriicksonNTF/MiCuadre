"use client"

import { useEffect, useRef } from "react"

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",")

function getFocusable(container: HTMLElement | null): HTMLElement[] {
  if (!container) return []
  const nodes = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
  return nodes.filter(
    (node) => !node.hasAttribute("aria-hidden") && node.offsetParent !== null
  )
}

export function useModalA11y({
  containerRef,
  onClose,
  enabled = true,
  trapFocus = true,
}: {
  containerRef: React.RefObject<HTMLElement | null>
  onClose?: () => void
  enabled?: boolean
  trapFocus?: boolean
}) {
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!enabled) return
    if (typeof document === "undefined") return

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null

    const container = containerRef.current
    const focusables = getFocusable(container)
    if (focusables.length > 0) {
      focusables[0].focus()
    } else if (container) {
      container.setAttribute("tabindex", "-1")
      container.focus()
    }

    return () => {
      const previous = previouslyFocusedRef.current
      if (previous && typeof previous.focus === "function") {
        previous.focus()
      }
    }
  }, [containerRef, enabled])

  useEffect(() => {
    if (!enabled) return
    if (typeof document === "undefined") return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (onClose) {
          event.stopPropagation()
          onClose()
        }
        return
      }

      if (!trapFocus || event.key !== "Tab") return
      const container = containerRef.current
      if (!container) return

      const focusables = getFocusable(container)
      if (focusables.length === 0) {
        event.preventDefault()
        return
      }

      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement as HTMLElement | null

      if (event.shiftKey) {
        if (active === first || !container.contains(active)) {
          event.preventDefault()
          last.focus()
        }
        return
      }

      if (active === last || !container.contains(active)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [containerRef, enabled, onClose, trapFocus])
}
