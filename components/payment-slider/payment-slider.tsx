"use client"
import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { Check, ChevronsRight, Loader2 } from "lucide-react"

interface PaymentSliderProps {
  amount: number
  currency?: string
  recipientName: string
  onConfirm: () => Promise<void> | void
  disabled?: boolean
  loading?: boolean
  label?: string
  className?: string
}

export function PaymentSlider({ 
  amount, 
  currency = "RD$", 
  recipientName, 
  onConfirm, 
  disabled, 
  loading = false,
  label = "Desliza para confirmar",
  className 
}: PaymentSliderProps) {
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [isConfirmed, setIsConfirmed] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const pointerIdRef = useRef<number | null>(null)
  const dragXRef = useRef(0)

  const getMaxDrag = () => {
    if (!containerRef.current) return 0
    const rect = containerRef.current.getBoundingClientRect()
    const thumbWidth = 48
    const padding = 6
    return Math.max(0, rect.width - thumbWidth - padding * 2)
  }

  const setPosition = (nextX: number) => {
    dragXRef.current = nextX
    setDragX(nextX)
  }

  const startDrag = (pointerId: number, target: HTMLElement) => {
    if (disabled || loading || isConfirmed) return
    pointerIdRef.current = pointerId
    target.setPointerCapture?.(pointerId)
    setDragging(true)
  }

  const onDrag = (clientX: number) => {
    if (!dragging || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const thumbWidth = 48
    const padding = 6
    const maxDrag = getMaxDrag()
    const x = Math.min(maxDrag, Math.max(0, clientX - rect.left - thumbWidth / 2 - padding))
    setPosition(x)
  }

  const endDrag = async () => {
    if (!dragging || !containerRef.current || loading) return
    const maxDrag = getMaxDrag()
    
    if (dragXRef.current >= maxDrag * 0.78) {
      setPosition(maxDrag)
      setIsConfirmed(true)
      try {
        await onConfirm()
      } catch (error) {
        setIsConfirmed(false)
        setPosition(0)
      }
    } else {
      setPosition(0)
    }
    setDragging(false)
    pointerIdRef.current = null
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    startDrag(e.pointerId, e.currentTarget)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== e.pointerId) return
    e.preventDefault()
    onDrag(e.clientX)
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== e.pointerId) return
    e.preventDefault()
    endDrag()
  }

  useEffect(() => {
    if (!loading && !isConfirmed) setPosition(0)
  }, [loading, isConfirmed])

  const displayCurrency = currency === "USD" || currency === "US$" ? "US$" : "RD$"
  const displayAmount = `${displayCurrency} ${amount.toLocaleString("en-US", { minimumFractionDigits: amount % 1 ? 2 : 0, maximumFractionDigits: 2 })}`
  const processing = loading || isConfirmed

  return (
    <div className={cn("rounded-2xl bg-card p-2", className)}>
      <p className="mb-3 text-center text-sm font-medium text-muted-foreground">
        {label}
      </p>
      
      <div
        ref={containerRef}
        className={cn(
          "relative h-[60px] select-none overflow-hidden rounded-[30px] bg-foreground/5",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className={cn(
            "text-base font-semibold text-foreground/40 transition-opacity duration-300",
            processing ? "opacity-0" : "opacity-100"
          )}>
            {displayAmount} · {recipientName}
          </span>
        </div>

        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={cn(
            "absolute left-[6px] top-[6px] z-10 flex h-12 w-12 touch-none items-center justify-center rounded-[30px] shadow-md will-change-transform cursor-grab active:cursor-grabbing",
            dragging ? "scale-105 transition-none" : "transition-transform duration-200 ease-out",
            processing
              ? "bg-emerald-500 text-white" 
              : "bg-primary text-primary-foreground"
          )}
          style={{ transform: `translateX(${dragX}px)` }}
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : isConfirmed ? (
            <Check className="h-6 w-6 animate-in zoom-in duration-300" />
          ) : (
            <ChevronsRight className="h-6 w-6" />
          )}
        </div>
      </div>

      {processing && (
        <p className="mt-2 text-center text-sm font-semibold text-emerald-600 animate-in fade-in">
          {loading ? "Procesando..." : "Confirmado"}
        </p>
      )}
    </div>
  )
}
