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

const typeStyles: Record<NonNullable<ToastData["type"]>, string> = {
  default: "bg-card border-border text-foreground",
  success: "bg-card border-primary/40 text-foreground",
  warning: "bg-card border-primary/40 text-foreground",
  error: "bg-card border-primary/40 text-foreground",
  info: "bg-card border-border text-foreground",
}

const typeIcons: Record<NonNullable<ToastData["type"]>, string> = {
  default: "💡",
  success: "✨",
  warning: "⚠️",
  error: "❌",
  info: "📊",
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
      className="pointer-events-none fixed left-0 right-0 top-0 z-[9999] flex flex-col items-center gap-2 px-4 pt-safe-areas"
    >
      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            "pointer-events-auto w-full max-w-md overflow-hidden rounded-2xl border bg-card p-4 shadow-xl transition-all duration-300",
            typeStyles[item.type ?? "default"],
            item.visible && !item.removing
              ? "translate-y-0 opacity-100"
              : "-translate-y-4 opacity-0"
          )}
        >
          <div className="flex items-start gap-3">
            {item.type && (
              <span className="mt-0.5 shrink-0 text-base" role="img">
                {typeIcons[item.type]}
              </span>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight">{item.title}</p>
              {item.body && (
                <p className="mt-0.5 text-xs leading-relaxed opacity-90">
                  {item.body}
                </p>
              )}
            </div>
            <button
              onClick={() => remove(item.id)}
              className="shrink-0 rounded-lg p-1 transition-colors hover:bg-black/10"
              aria-label="Cerrar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
