"use client"

import { ArrowDown, CheckCircle2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PullStatus } from "@/hooks/use-pull-to-refresh"

interface PullToRefreshIndicatorProps {
  distance: number
  status: PullStatus
  threshold?: number
}

export function PullToRefreshIndicator({
  distance,
  status,
  threshold = 70,
}: PullToRefreshIndicatorProps) {
  const isDragging = status === "pulling" || status === "threshold"
  const progress = threshold > 0 ? Math.min(distance / threshold, 1) : 0

  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden",
        isDragging ? "" : "transition-[height] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
      )}
      style={{ height: `${distance}px` }}
      aria-live="polite"
      role="status"
    >
      <div className="flex flex-col items-center gap-1">
        {status === "refreshing" && (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
        )}
        {status === "success" && (
          <CheckCircle2
            className="h-5 w-5 text-emerald-500 dark:text-emerald-400"
            aria-hidden="true"
          />
        )}
        {(status === "pulling" || status === "threshold") && (
          <ArrowDown
            className="h-5 w-5 text-muted-foreground transition-transform"
            style={{ transform: `rotate(${progress * 180}deg)` }}
            aria-hidden="true"
          />
        )}
        {status === "idle" && distance === 0 && null}
        <span className="text-xs font-medium text-muted-foreground">
          {status === "pulling" && "Desliza para actualizar"}
          {status === "threshold" && "Suelta para refrescar"}
          {status === "refreshing" && "Actualizando..."}
          {status === "success" && "Actualizado"}
        </span>
      </div>
    </div>
  )
}
