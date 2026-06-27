"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export type PullStatus = "idle" | "pulling" | "threshold" | "refreshing" | "success"

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>
  threshold?: number
  maxPull?: number
  enabled?: boolean
}

export function usePullToRefresh(
  scrollRef: React.RefObject<HTMLElement | null>,
  { onRefresh, threshold = 70, maxPull = 100, enabled = true }: UsePullToRefreshOptions,
) {
  const touchStart = useRef<{ y: number; x: number } | null>(null)
  const pullDistance = useRef(0)
  const isRefreshing = useRef(false)
  const isDragging = useRef(false)
  const pullDirectionDetermined = useRef(false)

  const [distance, setDistance] = useState(0)
  const [status, setStatus] = useState<PullStatus>("idle")

  const rubberband = useCallback(
    (dy: number) => {
      if (dy <= 0) return 0
      if (dy >= maxPull) return maxPull
      return dy * (1 - dy / (maxPull * 3))
    },
    [maxPull],
  )

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!enabled || isRefreshing.current) return
      if (!(e.target instanceof HTMLElement)) return
      if (
        e.target.closest('button, a, input, select, textarea, [role="button"], [role="link"]')
      )
        return

      const el = scrollRef.current
      if (!el || el.scrollTop > 0) return

      touchStart.current = {
        y: e.targetTouches[0].clientY,
        x: e.targetTouches[0].clientX,
      }
      isDragging.current = false
      pullDirectionDetermined.current = false
      pullDistance.current = 0
    },
    [enabled, scrollRef],
  )

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!touchStart.current || isRefreshing.current) return

      const dy = e.targetTouches[0].clientY - touchStart.current.y
      const dx = e.targetTouches[0].clientX - touchStart.current.x

      if (!pullDirectionDetermined.current) {
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
          return
        }
        pullDirectionDetermined.current = dy > 0
        if (!pullDirectionDetermined.current) return
      }

      if (dy <= 0) return

      e.preventDefault()
      isDragging.current = true
      const banded = rubberband(dy)
      pullDistance.current = banded
      setDistance(banded)
      setStatus(banded >= threshold ? "threshold" : "pulling")
    },
    [rubberband, scrollRef, threshold],
  )

  const handleTouchEnd = useCallback(
    async (e: TouchEvent) => {
      if (!touchStart.current) return
      touchStart.current = null

      if (!isDragging.current) return
      isDragging.current = false

      const dist = pullDistance.current
      pullDistance.current = 0

      if (dist >= threshold) {
        setDistance(threshold)
        setStatus("refreshing")
        isRefreshing.current = true
        try {
          await onRefresh()
          setStatus("success")
          await new Promise((r) => setTimeout(r, 500))
        } catch {
        } finally {
          setDistance(0)
          setStatus("idle")
          isRefreshing.current = false
        }
      } else {
        setDistance(0)
        setStatus("idle")
      }
    },
    [threshold, onRefresh],
  )

  useEffect(() => {
    const el = scrollRef.current
    if (!el || !enabled) return

    el.addEventListener("touchstart", handleTouchStart, { passive: true })
    el.addEventListener("touchmove", handleTouchMove, { passive: false })
    el.addEventListener("touchend", handleTouchEnd, { passive: true })

    return () => {
      el.removeEventListener("touchstart", handleTouchStart)
      el.removeEventListener("touchmove", handleTouchMove)
      el.removeEventListener("touchend", handleTouchEnd)
    }
  }, [scrollRef, enabled, handleTouchStart, handleTouchMove, handleTouchEnd])

  return { distance, status }
}
