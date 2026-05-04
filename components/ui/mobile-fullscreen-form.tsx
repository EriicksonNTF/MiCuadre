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
    <div data-app-modal="true" className="fixed inset-0 z-[9999] flex h-[100dvh] w-screen flex-col bg-background">
      <div className="shrink-0 border-b px-6 py-4 pt-[calc(1rem+env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          {onClose && (
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className={`flex-1 min-h-0 overflow-y-auto px-6 py-6 pb-32 ${contentClassName ?? ""}`}>
        {children}
      </div>

      {footer && (
        <div className="shrink-0 border-t bg-background px-6 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
          {footer}
        </div>
      )}
    </div>
  )
}
