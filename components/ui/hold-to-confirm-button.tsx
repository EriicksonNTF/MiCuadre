"use client"

import { useRef, useState } from "react"
import { cn } from "@/lib/utils"

type HoldToConfirmButtonProps = {
  onConfirm: () => Promise<void> | void
  disabled?: boolean
  loading?: boolean
  className?: string
  label?: string
  loadingLabel?: string
}

export function HoldToConfirmButton({
  onConfirm,
  disabled,
  loading,
  className,
  label = "Mantén presionado para eliminar",
  loadingLabel = "Eliminando...",
}: HoldToConfirmButtonProps) {
  const [holding, setHolding] = useState(false)
  const timerRef = useRef<number | null>(null)
  const completedRef = useRef(false)

  const clearHold = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = null
    if (!completedRef.current) setHolding(false)
  }

  const startHold = () => {
    if (disabled || loading) return
    completedRef.current = false
    setHolding(true)
    timerRef.current = window.setTimeout(async () => {
      completedRef.current = true
      await onConfirm()
      setHolding(false)
    }, 1200)
  }

  return (
    <button
      type="button"
      onPointerDown={startHold}
      onPointerUp={clearHold}
      onPointerCancel={clearHold}
      onPointerLeave={clearHold}
      disabled={disabled || loading}
      className={cn(
        "relative h-12 overflow-hidden rounded-2xl bg-red-600 px-4 text-sm font-black text-white transition active:scale-[0.99] disabled:opacity-60",
        className
      )}
    >
      <span
        className={cn(
          "absolute inset-y-0 left-0 bg-red-400/55",
          holding ? "w-full transition-[width] duration-[1200ms] ease-linear" : "w-0 transition-none"
        )}
      />
      <span className="relative z-10">{loading ? loadingLabel : label}</span>
    </button>
  )
}
