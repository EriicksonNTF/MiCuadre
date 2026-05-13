"use client"

import { useEffect, useState, useCallback } from "react"
import { X } from "lucide-react"
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

const typeAccents: Record<NonNullable<ToastData["type"]>, { border: string; dot: string }> = {
  success: { border: "border-l-[3px] border-l-emerald-500", dot: "bg-emerald-500" },
  warning: { border: "border-l-[3px] border-l-amber-500", dot: "bg-amber-500" },
  error: { border: "border-l-[3px] border-l-red-500", dot: "bg-red-500" },
  info: { border: "border-l-[3px] border-l-sky-500", dot: "bg-sky-500" },
  default: { border: "border-l-[3px] border-l-primary", dot: "bg-primary" },
}

const typeIcons: Record<NonNullable<ToastData["type"]>, string> = {
  success: "✨",
  warning: "⚠️",
  error: "❌",
  info: "📊",
  default: "💡",
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
                "relative overflow-hidden rounded-2xl border border-border bg-card",
                "shadow-[0_8px_24px_-4px_rgba(0,0,0,0.15),0_2px_8px_-2px_rgba(0,0,0,0.1),0_0_0_1px_rgba(0,0,0,0.05)]",
                "dark:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.4),0_2px_8px_-2px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)]",
                accent.border
              )}
            >
              <div
                className="absolute inset-0 opacity-[0.03]"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.8) 0%, transparent 60%)",
                }}
              />
              <div className="relative flex items-start gap-3.5 p-4 pl-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted/60 shadow-inner">
                  <span className="text-sm" role="img">
                    {typeIcons[item.type ?? "default"]}
                  </span>
                </div>
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-sm font-bold leading-tight text-foreground tracking-tight">
                    {item.title}
                  </p>
                  {item.body && (
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {item.body}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => remove(item.id)}
                  className="shrink-0 rounded-lg p-1.5 transition-colors hover:bg-muted/80 active:scale-95"
                  aria-label="Cerrar"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
              <div className="absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-foreground/5 to-transparent" />
            </div>
          </div>
        )
      })}
    </div>
  )
}