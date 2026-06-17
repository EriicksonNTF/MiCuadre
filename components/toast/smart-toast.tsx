"use client"

import { useEffect, useState, useCallback } from "react"
import { AlertTriangle, CheckCircle2, Info, Sparkles, TrendingUp, X } from "lucide-react"
import { cn } from "@/lib/utils"

export type ToastData = {
  id: string
  title: string
  body?: string
  type?: "default" | "success" | "warning" | "error" | "info"
  duration?: number
}

type ToastItem = ToastData & {
  visible: boolean
  removing: boolean
}

const TOAST_DURATION_DEFAULT = 3500

const typeAccents: Record<
  NonNullable<ToastData["type"]>,
  { ring: string; iconWrap: string; glow: string; progress: string; badge: string }
> = {
  success: {
    ring: "ring-emerald-500/35",
    iconWrap: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    glow: "shadow-[0_18px_36px_-24px_rgba(16,185,129,0.7)]",
    progress: "from-emerald-500 to-emerald-400",
    badge: "OK",
  },
  warning: {
    ring: "ring-amber-500/35",
    iconWrap: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    glow: "shadow-[0_18px_36px_-24px_rgba(245,158,11,0.7)]",
    progress: "from-amber-500 to-orange-400",
    badge: "ALERTA",
  },
  error: {
    ring: "ring-red-500/35",
    iconWrap: "bg-red-500/15 text-red-700 dark:text-red-300",
    glow: "shadow-[0_18px_36px_-24px_rgba(239,68,68,0.75)]",
    progress: "from-red-500 to-rose-400",
    badge: "ERROR",
  },
  info: {
    ring: "ring-cyan-500/35",
    iconWrap: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
    glow: "shadow-[0_18px_36px_-24px_rgba(6,182,212,0.72)]",
    progress: "from-cyan-500 to-sky-400",
    badge: "MIA",
  },
  default: {
    ring: "ring-slate-500/30",
    iconWrap: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
    glow: "shadow-[0_18px_36px_-24px_rgba(51,65,85,0.65)]",
    progress: "from-slate-500 to-slate-400",
    badge: "TIP",
  },
}

const typeIcons: Record<NonNullable<ToastData["type"]>, typeof Sparkles> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertTriangle,
  info: TrendingUp,
  default: Info,
}

interface ToastState {
  items: ToastItem[]
  add: (toast: Omit<ToastData, "id">) => string
  remove: (id: string) => void
  clear: () => void
}

let toastEmitter: ((toast: Omit<ToastData, "id">) => string) | null = null

export function showToast(toast: Omit<ToastData, "id">): string {
  if (toastEmitter) {
    return toastEmitter(toast)
  }
  const fallbackId = `toast-${Date.now()}-${Math.random()}`
  console.warn("[SmartToast] Toast system not mounted. Toast queued:", toast)
  return fallbackId
}

export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([])

  const remove = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, removing: true } : item))
    )
    setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id))
    }, 300)
  }, [])

  const add = useCallback(
    (toast: Omit<ToastData, "id">): string => {
      const id = `toast-${Date.now()}-${Math.random()}`
      const duration = toast.duration ?? TOAST_DURATION_DEFAULT

      setItems((prev) => [...prev, { ...toast, id, visible: false, removing: false }])

      requestAnimationFrame(() => {
        setItems((prev) =>
          prev.map((item) => (item.id === id ? { ...item, visible: true } : item))
        )
      })

      setTimeout(() => {
        remove(id)
      }, duration)

      return id
    },
    [remove]
  )

  useEffect(() => {
    toastEmitter = add
    return () => {
      toastEmitter = null
    }
  }, [add])

  if (items.length === 0) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed left-0 right-0 top-0 z-[9999] flex flex-col items-center gap-3 px-4 pt-safe-areas"
    >
      {items.map((item) => {
        const accent = typeAccents[item.type ?? "default"]
        return (
          <div
            key={item.id}
            className={cn(
              "pointer-events-auto w-full max-w-sm",
              item.visible && !item.removing
                ? "translate-y-0 opacity-100"
                : "-translate-y-4 opacity-0",
              "transition-all duration-300"
            )}
          >
            <div
              className={cn(
                "relative overflow-hidden rounded-2xl border border-border/70 bg-card/95 ring-1 backdrop-blur",
                "dark:border-border/60 dark:bg-card/90",
                accent.ring,
                accent.glow
              )}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.35),transparent_45%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_45%)]" />
              <div className="relative flex items-start gap-3.5 p-4 pl-4">
                <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", accent.iconWrap)}>
                  {(() => {
                    const Icon = typeIcons[item.type ?? "default"]
                    return <Icon className="h-4.5 w-4.5" />
                  })()}
                </div>
                <div className="flex-1 min-w-0 pr-2">
                  <div className="mb-1 inline-flex rounded-full bg-background/70 px-2 py-0.5 text-xs font-semibold tracking-wide text-muted-foreground ring-1 ring-border/60">
                    {accent.badge}
                  </div>
                  <p className="text-[0.875rem] font-semibold leading-tight text-foreground tracking-tight">
                    {item.title}
                  </p>
                  {item.body && (
                    <p className="mt-1 text-[0.78125rem] leading-relaxed text-muted-foreground">
                      {item.body}
                    </p>
                  )}
                </div>
                <button type="button"
                  onClick={() => remove(item.id)}
                  className="shrink-0 rounded-lg p-1.5 transition-colors hover:bg-muted/80 active:scale-95"
                  aria-label="Cerrar"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/5 dark:bg-white/5">
                <div
                  className={cn("h-full bg-gradient-to-r", accent.progress, "animate-[toast-progress_linear_forwards]")}
                  style={{ animationDuration: `${item.duration ?? TOAST_DURATION_DEFAULT}ms` }}
                />
              </div>
            </div>
          </div>
        )
      })}
      <style jsx global>{`
        @keyframes toast-progress {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  )
}
