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
  const titleId = React.useId()

  React.useEffect(() => {
    document.body.classList.add("modal-open", "mobile-form-open")
    return () => {
      document.body.classList.remove("modal-open", "mobile-form-open")
    }
  }, [])

  return (
    <div
      data-app-modal="true"
      className="fixed inset-0 z-[9999] flex h-[100dvh] w-screen animate-in fade-in-0 slide-in-from-bottom-5 duration-500 ease-[var(--ease-sheet-ios)] flex-col overflow-hidden bg-background"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
    >
      <div className="shrink-0 border-b border-border/55 bg-background/92 px-5 py-4 pt-[calc(1rem+env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-4">
          <h2 id={titleId} className="min-w-0 truncate text-lg font-bold text-foreground">{title}</h2>
          {onClose && (
            <button type="button"
              onClick={onClose}
              className="tap-lift flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted/85 text-muted-foreground hover:bg-muted hover:text-foreground"
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
        <div className="shrink-0 border-t border-border/55 bg-card/92 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-[0_-18px_45px_-34px_rgba(0,0,0,0.38)] backdrop-blur-xl">
          {footer}
        </div>
      )}
    </div>
  )
}
