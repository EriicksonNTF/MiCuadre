"use client"

import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  confirmLabel?: string
  onConfirm?: () => void
  confirmDisabled?: boolean
  isLoading?: boolean
  className?: string
  hideFooter?: boolean
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  confirmLabel = "Continuar",
  onConfirm,
  confirmDisabled = false,
  isLoading = false,
  className = "",
  hideFooter = false,
}: ModalProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 animate-in fade-in duration-200" />
      
      {/* Modal Content */}
      <div
        className={cn(
          "relative w-full max-h-[85dvh] sm:max-h-[80vh] rounded-t-3xl sm:rounded-2xl bg-card overflow-hidden flex flex-col",
          "animate-in slide-in-from-bottom-4 fade-in duration-300",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-none flex items-center justify-between px-5 py-4 border-b border-border bg-card">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 overscroll-contain">
          {/* Extra padding for iOS safe areas */}
          <div className="pb-safe-areas" />
          {children}
        </div>

        {/* Sticky Footer Button */}
        {!hideFooter && onConfirm && (
          <div className="flex-none px-5 py-4 pb-safe-areas border-t border-border bg-card safe-area-bottom">
            <Button
              onClick={onConfirm}
              disabled={confirmDisabled || isLoading}
              className="h-12 w-full rounded-xl text-base font-semibold"
            >
              {isLoading ? "Cargando..." : confirmLabel}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

// Compact modal for quick actions (no header, just content)
interface QuickModalProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
}

export function QuickModal({
  isOpen,
  onClose,
  children,
  className = "",
}: QuickModalProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 animate-in fade-in duration-200" />
      <div
        className={cn(
          "relative w-full max-w-md rounded-t-3xl bg-card p-6 pb-safe-areas",
          "animate-in slide-in-from-bottom-4 fade-in duration-300",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}