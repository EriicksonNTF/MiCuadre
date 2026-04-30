"use client"
import React from "react"
import { X } from "lucide-react"

export function BaseModalForm({
  title,
  children,
  footer,
  onClose,
}: {
  title?: string
  children: React.ReactNode
  footer?: React.ReactNode
  onClose?: () => void
}) {
  return (
    <>
      <div 
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-x-0 bottom-0 z-50 mt-auto sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 flex flex-col rounded-t-3xl sm:rounded-2xl bg-card shadow-lg sm:w-full sm:max-w-md max-h-[90vh]">
        {/* HEADER */}
        {title && (
          <div className="flex-none p-5 border-b border-border flex items-center justify-between">
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
        <div className="flex-1 overflow-y-auto p-5 space-y-5 overscroll-contain">
          {children}
        </div>

        {/* FOOTER (BOTÓN SIEMPRE VISIBLE) */}
        {footer && (
          <div className="flex-none p-5 border-t border-border bg-card pb-safe-areas sm:rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </>
  )
}
