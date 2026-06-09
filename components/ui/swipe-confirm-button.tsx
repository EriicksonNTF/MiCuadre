"use client"

import { useEffect, useRef, useState } from "react"
import { Check, ChevronsRight, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { triggerHaptic } from "@/lib/haptics"

type SwipeConfirmButtonProps = {
  label?: string
  completedLabel?: string
  loadingLabel?: string
  disabled?: boolean
  loading?: boolean
  onConfirm: () => Promise<void> | void
  className?: string
  icon?: React.ReactNode
  resetKey?: string | number
}

export function SwipeConfirmButton({
  label = "Desliza para transferir",
  completedLabel = "Confirmado",
  loadingLabel = "Procesando...",
  disabled,
  loading,
  onConfirm,
  className,
  icon,
  resetKey,
}: SwipeConfirmButtonProps) {
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [animatingBack, setAnimatingBack] = useState(false)
  const [isConfirmed, setIsConfirmed] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)
  const pointerIdRef = useRef<number | null>(null)
  const dragXRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const isSubmittingRef = useRef(false)
  const thresholdHapticRef = useRef(false)

  const getMaxDrag = () => {
    const track = trackRef.current
    const thumb = thumbRef.current
    if (!track || !thumb) return 0
    return Math.max(0, track.clientWidth - thumb.clientWidth - 12)
  }

  const applyFrictionCurve = (rawX: number, maxDrag: number) => {
    if (maxDrag <= 0) return 0
    const progress = Math.min(1, Math.max(0, rawX / maxDrag))
    const eased = 1 - Math.pow(1 - progress, 2.1)
    return eased * maxDrag
  }

  const paint = (nextX: number) => {
    dragXRef.current = nextX
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => setDragX(nextX))
  }

  const onDrag = (clientX: number) => {
    if (!dragging || !trackRef.current || !thumbRef.current) return
    const rect = trackRef.current.getBoundingClientRect()
    const maxDrag = getMaxDrag()
    const rawX = Math.min(maxDrag, Math.max(0, clientX - rect.left - thumbRef.current.clientWidth / 2 - 6))
    const curvedX = applyFrictionCurve(rawX, maxDrag)

    if (!thresholdHapticRef.current && rawX >= maxDrag * 0.8) {
      thresholdHapticRef.current = true
      void triggerHaptic("light")
    } else if (thresholdHapticRef.current && rawX < maxDrag * 0.74) {
      thresholdHapticRef.current = false
    }

    paint(curvedX)
  }

  const reset = () => {
    setDragging(false)
    setAnimatingBack(false)
    setIsConfirmed(false)
    paint(0)
    pointerIdRef.current = null
    isSubmittingRef.current = false
    thresholdHapticRef.current = false
  }

  const endDrag = async () => {
    if (!dragging || loading || isSubmittingRef.current) return
    const maxDrag = getMaxDrag()
    const progress = maxDrag > 0 ? dragXRef.current / maxDrag : 0
    if (progress >= 0.8) {
      paint(maxDrag)
      setIsConfirmed(true)
      isSubmittingRef.current = true
      try {
        void triggerHaptic("medium")
        await onConfirm()
      } catch {
        reset()
        return
      }
    } else {
      setAnimatingBack(true)
      paint(0)
    }
    setDragging(false)
    pointerIdRef.current = null
  }

  const prevLoading = useRef(loading)
  if (prevLoading.current !== loading) {
    prevLoading.current = loading
    if (!loading && !isConfirmed) paint(0)
  }

  const prevResetKey = useRef(resetKey)
  if (resetKey !== prevResetKey.current) {
    prevResetKey.current = resetKey
    reset()
  }

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const processing = Boolean(loading || isConfirmed)

  return (
    <div className={cn("rounded-2xl bg-card p-2", className)} data-no-edge-back="true" data-swipe-confirm="true">
      <p className="mb-3 text-center text-sm font-medium text-muted-foreground">{label}</p>
      <div ref={trackRef} className={cn("relative h-[60px] select-none overflow-hidden rounded-[30px] bg-muted", disabled && "cursor-not-allowed opacity-50")}>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className={cn("text-base font-semibold text-muted-foreground transition-opacity duration-300", processing ? "opacity-0" : "opacity-100")}>{label}</span>
        </div>
        <div
          ref={thumbRef}
          role="button"
          tabIndex={disabled ? -1 : 0}
          onPointerDown={(e) => {
            if (disabled || loading || isConfirmed || isSubmittingRef.current) return
            pointerIdRef.current = e.pointerId
            e.currentTarget.setPointerCapture?.(e.pointerId)
            setDragging(true)
          }}
          onPointerMove={(e) => {
            if (pointerIdRef.current !== e.pointerId) return
            onDrag(e.clientX)
          }}
          onPointerUp={(e) => {
            if (pointerIdRef.current !== e.pointerId) return
            endDrag()
          }}
          onPointerCancel={() => reset()}
          onTransitionEnd={() => {
            if (!dragging && dragX === 0) setAnimatingBack(false)
          }}
          className={cn(
            "absolute left-[6px] top-[6px] z-10 flex h-12 w-12 touch-none items-center justify-center rounded-[30px] shadow-md will-change-transform",
            dragging ? "scale-105" : animatingBack ? "transition-transform duration-180 ease-out" : "transition-transform duration-200 ease-out",
            processing ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground"
          )}
          style={{ transform: `translate3d(${dragX}px,0,0)` }}
          aria-label={label}
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : isConfirmed ? <Check className="h-6 w-6" /> : icon || <ChevronsRight className="h-6 w-6" />}
        </div>
      </div>
      {processing ? <p className="mt-2 text-center text-sm font-semibold text-foreground">{loading ? loadingLabel : completedLabel}</p> : null}
    </div>
  )
}
