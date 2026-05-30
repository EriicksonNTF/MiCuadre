"use client"

import React from "react"
import { X } from "lucide-react"

export function MobileFullscreenForm({
  title,
  children,
  footer,
  onClose,
  contentClassName,
}: {
  title?: string
  children: React.ReactNode
  footer?: React.ReactNode
  onClose?: () => void
  contentClassName?: string
}) {
  React.useEffect(() => {
    document.body.classList.add("modal-open", "mobile-form-open")
    return () => {
      document.body.classList.remove("modal-open", "mobile-form-open")
    }
  }, [])

  return (
    <div data-app-modal="true" className="fixed inset-0 z-[9999] flex h-[100dvh] w-screen flex-col overflow-hidden bg-background">
      <div className="shrink-0 border-b border-border bg-background px-5 py-4 pt-[calc(1rem+env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-4">
          <h2 className="min-w-0 truncate text-lg font-bold text-foreground">{title}</h2>
          {onClose && (
            <button
              onClick={onClose}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className={`min-h-0 flex-1 overflow-y-auto px-5 py-6 pb-8 ${contentClassName ?? ""}`}>
        {children}
      </div>

      {footer && (
        <div className="shrink-0 border-t border-border bg-card px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
          {footer}
        </div>
      )}
    </div>
  )
}
