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
      <div className="absolute inset-0 animate-in fade-in bg-foreground/18 backdrop-blur-[6px] duration-200 dark:bg-black/45" />
      
      {/* Modal Content */}
      <div
        className={cn(
          "relative flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-[2rem] border border-border/70 bg-card/96 shadow-[var(--shadow-float)] ring-1 ring-border/50 backdrop-blur-2xl sm:max-h-[80vh] sm:rounded-[1.6rem]",
          "animate-in slide-in-from-bottom-6 fade-in duration-500 ease-[var(--ease-sheet-ios)]",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-none flex items-center justify-between border-b border-border/55 bg-card/92 px-5 py-4 backdrop-blur">
          <h2 className="text-lg font-bold tracking-tight text-foreground">{title}</h2>
          <button type="button"
            onClick={onClose}
            className="tap-lift flex h-10 w-10 items-center justify-center rounded-full bg-muted/85 text-muted-foreground hover:bg-muted hover:text-foreground"
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
          <div className="flex-none border-t border-border/55 bg-card/92 px-5 py-4 pb-safe-areas backdrop-blur safe-area-bottom">
            <Button
              onClick={onConfirm}
              disabled={confirmDisabled || isLoading}
              className="h-12 w-full rounded-2xl text-base font-bold"
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
      <div className="absolute inset-0 animate-in fade-in bg-foreground/18 backdrop-blur-[6px] duration-200 dark:bg-black/45" />
      <div
        className={cn(
          "relative w-full max-w-md rounded-t-[2rem] border border-border/70 bg-card/96 p-6 pb-safe-areas shadow-[var(--shadow-float)] ring-1 ring-border/50 backdrop-blur-2xl",
          "animate-in slide-in-from-bottom-6 fade-in duration-500 ease-[var(--ease-sheet-ios)]",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
