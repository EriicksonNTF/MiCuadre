"use client"
import React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

export function BaseModalForm({
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
    document.body.classList.add("modal-open")
    return () => {
      document.body.classList.remove("modal-open")
    }
  }, [])

  return (
    <>
      <div 
        className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-x-0 bottom-0 z-[100] mt-auto flex max-h-[85dvh] flex-col overflow-hidden rounded-t-3xl bg-card shadow-lg sm:inset-auto sm:top-1/2 sm:left-1/2 sm:max-h-[80dvh] sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
        {/* HEADER */}
        {title && (
          <div className="sticky top-0 z-10 flex flex-none items-center justify-between border-b border-border bg-card p-5">
            <h2 className="text-lg font-semibold">{title}</h2>
            {onClose && (
              <button 
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* CONTENT */}
        <div className={cn("flex-1 overflow-y-auto p-5 overscroll-contain", contentClassName)}>
          {children}
        </div>

        {/* FOOTER (BOTÓN SIEMPRE VISIBLE) */}
        {footer && (
          <div className="sticky bottom-0 flex-none border-t border-border bg-card p-4 pb-[calc(16px+env(safe-area-inset-bottom))] sm:rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </>
  )
}
