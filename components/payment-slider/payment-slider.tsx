"use client"
import { useState, useRef } from "react"
import { cn } from "@/lib/utils"
import { Check, ChevronsRight } from "lucide-react"

interface PaymentSliderProps {
  amount: number
  currency?: string
  recipientName: string
  onConfirm: () => Promise<void> | void
  disabled?: boolean
  className?: string
}

export function PaymentSlider({ 
  amount, 
  currency = "RD$", 
  recipientName, 
  onConfirm, 
  disabled, 
  className 
}: PaymentSliderProps) {
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [isConfirmed, setIsConfirmed] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const startDrag = () => {
    if (disabled || isConfirmed) return
    setDragging(true)
  }

  const onDrag = (clientX: number) => {
    if (!dragging || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const thumbWidth = 48
    const padding = 8
    const maxDrag = rect.width - thumbWidth - padding * 2
    let x = clientX - rect.left - thumbWidth - padding
    if (x < 0) x = 0
    if (x > maxDrag) x = maxDrag
    setDragX(x)
  }

  const endDrag = async () => {
    if (!dragging || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const thumbWidth = 48
    const padding = 8
    const maxDrag = rect.width - thumbWidth - padding * 2
    
    if (dragX >= maxDrag * 0.8) {
      setDragX(maxDrag)
      setIsConfirmed(true)
      try {
        await onConfirm()
      } catch (error) {
        console.error("Payment error:", error)
        setIsConfirmed(false)
        setDragX(0)
      }
    } else {
      setDragX(0)
    }
    setDragging(false)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault()
    startDrag()
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault()
    onDrag(e.touches[0].clientX)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault()
    endDrag()
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    startDrag()
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    onDrag(e.clientX)
  }

  const handleMouseUp = (e: React.MouseEvent) => {
    e.preventDefault()
    endDrag()
  }

  const handleMouseLeave = () => {
    if (dragging) endDrag()
  }

  const displayAmount = currency === "RD$" 
    ? `${currency} ${amount.toLocaleString()}` 
    : `US$ ${amount.toFixed(2)}`

  return (
    <div className={cn("rounded-2xl bg-card p-2", className)}>
      {/* Label above slider */}
      <p className="mb-3 text-center text-sm font-medium text-muted-foreground">
        Desliza para confirmar
      </p>
      
      {/* Slider Track */}
      <div
        ref={containerRef}
        onMouseMove={dragging ? handleMouseMove : undefined}
        onMouseUp={dragging ? handleMouseUp : undefined}
        onMouseLeave={handleMouseLeave}
        className={cn(
          "relative h-[60px] overflow-hidden rounded-[30px] bg-foreground/5 select-none",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        {/* Centered text inside track */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className={cn(
            "text-base font-semibold text-foreground/40 transition-opacity duration-300",
            isConfirmed ? "opacity-0" : "opacity-100"
          )}>
            Pagar {displayAmount} a {recipientName}
          </span>
        </div>

        {/* Draggable thumb */}
        <div
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={cn(
            "absolute top-[6px] left-[6px] z-10 flex h-12 w-12 touch-none items-center justify-center rounded-[30px] shadow-md transition-transform duration-150 cursor-grab active:cursor-grabbing",
            dragging && "scale-105",
            isConfirmed 
              ? "bg-emerald-500 text-white" 
              : "bg-primary text-primary-foreground"
          )}
          style={{ transform: `translateX(${dragX}px)` }}
        >
          {isConfirmed ? (
            <Check className="h-6 w-6 animate-in zoom-in duration-300" />
          ) : (
            <ChevronsRight className="h-6 w-6" />
          )}
        </div>
      </div>

      {isConfirmed && (
        <p className="mt-2 text-center text-sm font-semibold text-emerald-600 animate-in fade-in">
          ¡Confirmado!
        </p>
      )}
    </div>
  )
}
