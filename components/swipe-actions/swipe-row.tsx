"use client"

import { useRef } from "react"
import { cn } from "@/lib/utils"
import { Trash2, Edit3, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface SwipeAction {
  label: string
  icon: React.ReactNode
  bgColor: string
  textColor: string
  onClick: () => void
  destructive?: boolean
}

interface SwipeRowProps {
  children: React.ReactNode
  leftActions?: SwipeAction[]
  rightActions?: SwipeAction[]
  threshold?: number
  onSwipeOpen?: (open: boolean) => void
  className?: string
}

export function SwipeRow({
  children,
  leftActions = [],
  rightActions = [],
  threshold = 80,
  onSwipeOpen,
  className,
}: SwipeRowProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const startXRef = useRef(0)
  const currentXRef = useRef(0)
  const isDraggingRef = useRef(false)
  const openRef = useRef<"left" | "right" | null>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX
    currentXRef.current = startXRef.current
    isDraggingRef.current = true
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current || openRef.current) return
    const x = e.touches[0].clientX
    const diff = x - startXRef.current
    const track = trackRef.current
    if (!track) return
    if (diff > 0 && leftActions.length) {
      const maxOffset = leftActions.length * 80
      const offset = Math.min(Math.max(0, diff), maxOffset)
      track.style.transform = `translateX(${offset}px)`
    } else if (diff < 0 && rightActions.length) {
      const maxOffset = rightActions.length * 80
      const offset = Math.min(Math.max(0, Math.abs(diff)), maxOffset)
      track.style.transform = `translateX(-${offset}px)`
    }
  }

  const handleTouchEnd = () => {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false
    const track = trackRef.current
    if (!track) return
    const transform = track.style.transform
    const match = transform.match(/translateX\(-?(\d+)px\)/)
    const offset = match ? parseInt(match[1]) : 0
    if (offset > threshold) {
      const isLeft = transform.includes("translateX(") && !transform.includes("-")
      openRef.current = isLeft ? "left" : "right"
      onSwipeOpen?.(true)
    } else {
      track.style.transform = "translateX(0)"
      openRef.current = null
      onSwipeOpen?.(false)
    }
  }

  const close = () => {
    const track = trackRef.current
    if (!track) return
    track.style.transform = "translateX(0)"
    openRef.current = null
    onSwipeOpen?.(false)
  }

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div className="absolute inset-0 flex">
        {leftActions.length > 0 && (
          <div className="flex h-full" data-swipe="left">
            {leftActions.map((action, i) => (
              <button
                key={i}
                onClick={() => { action.onClick(); close() }}
                className={cn(
                  "flex h-full flex-1 flex-col items-center justify-center gap-1 transition-colors",
                  action.bgColor,
                  action.textColor
                )}
                style={{ width: 80 }}
              >
                {action.icon}
                <span className="text-xs font-medium">{action.label}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex-1" />
        {rightActions.length > 0 && (
          <div className="flex h-full" data-swipe="right">
            {rightActions.map((action, i) => (
              <button
                key={i}
                onClick={() => { action.onClick(); close() }}
                className={cn(
                  "flex h-full flex-1 flex-col items-center justify-center gap-1 transition-colors",
                  action.bgColor,
                  action.textColor
                )}
                style={{ width: 80 }}
              >
                {action.icon}
                <span className="text-xs font-medium">{action.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div
        ref={trackRef}
        className="relative bg-transparent transition-transform duration-200 ease-out"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  )
}

export interface TransactionSwipeRowProps {
  id: string
  children: React.ReactNode
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
  onView?: (id: string) => void
  className?: string
}

export function TransactionSwipeRow({
  id,
  children,
  onEdit,
  onDelete,
  onView,
  className,
}: TransactionSwipeRowProps) {
  const leftActions = onView ? [
    { label: "Ver", icon: <Eye className="h-5 w-5" />, bgColor: "bg-muted", textColor: "text-foreground", onClick: () => onView?.(id) }
  ] : []
  const rightActions = [
    ...(onEdit ? [{ label: "Editar", icon: <Edit3 className="h-5 w-5" />, bgColor: "bg-blue-500", textColor: "text-white", onClick: () => onEdit?.(id) }] : []),
    ...(onDelete ? [{ label: "Eliminar", icon: <Trash2 className="h-5 w-5" />, bgColor: "bg-red-500", textColor: "text-white", onClick: () => onDelete?.(id), destructive: true }] : [])
  ]
  return (
    <SwipeRow leftActions={leftActions} rightActions={rightActions} className={className}>
      {children}
    </SwipeRow>
  )
}