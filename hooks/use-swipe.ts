"use client"

import { useCallback, useEffect, useRef } from "react"

interface UseSwipeOptions {
  threshold?: number
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onDrag?: (dx: number) => void
  onRelease?: () => void
}

export function useSwipe(
  elementRef: React.RefObject<HTMLElement | null>,
  { threshold = 60, onSwipeLeft, onSwipeRight, onDrag, onRelease }: UseSwipeOptions = {},
) {
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const isDragging = useRef(false)

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!(e.target instanceof HTMLElement)) return
    if (e.target.closest('button, a, input, select, textarea, [role="button"], [role="link"]')) return
    touchStart.current = { x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY }
    isDragging.current = false
  }, [])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!touchStart.current) return
    const dx = e.targetTouches[0].clientX - touchStart.current.x
    const dy = e.targetTouches[0].clientY - touchStart.current.y
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
      e.preventDefault()
      isDragging.current = true
      onDrag?.(dx)
    }
  }, [onDrag])

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!touchStart.current && !isDragging.current) {
      onRelease?.()
      return
    }
    const dx = touchStart.current
      ? e.changedTouches[0].clientX - touchStart.current.x
      : 0
    const dy = touchStart.current
      ? e.changedTouches[0].clientY - touchStart.current.y
      : 0
    touchStart.current = null
    if (Math.abs(dx) >= threshold && Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) onSwipeRight?.()
      else onSwipeLeft?.()
    }
    isDragging.current = false
    onRelease?.()
  }, [threshold, onSwipeLeft, onSwipeRight, onRelease])

  useEffect(() => {
    const el = elementRef.current
    if (!el) return
    el.addEventListener("touchstart", handleTouchStart, { passive: true })
    el.addEventListener("touchmove", handleTouchMove, { passive: false })
    el.addEventListener("touchend", handleTouchEnd, { passive: true })
    return () => {
      el.removeEventListener("touchstart", handleTouchStart)
      el.removeEventListener("touchmove", handleTouchMove)
      el.removeEventListener("touchend", handleTouchEnd)
    }
  }, [elementRef, handleTouchStart, handleTouchMove, handleTouchEnd])
}
