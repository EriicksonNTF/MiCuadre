"use client"
import React from "react"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"
import { useIsMobile } from "@/components/ui/use-mobile"
import { MobileFullscreenForm } from "@/components/ui/mobile-fullscreen-form"
import { ModalOverlay } from "@/components/ui/modal-overlay"
import { useModalA11y } from "@/lib/a11y/use-modal-a11y"

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
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <MobileFullscreenForm
        title={title}
        onClose={onClose}
        footer={footer}
        contentClassName={contentClassName}
      >
        {children}
      </MobileFullscreenForm>
    )
  }

  return (
    <DesktopModal title={title} onClose={onClose} contentClassName={contentClassName}>
      {children}
      {footer}
    </DesktopModal>
  )
}

function DesktopModal({
  title,
  children,
  onClose,
  contentClassName,
}: {
  title?: string
  children: React.ReactNode
  onClose?: () => void
  contentClassName?: string
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const titleId = React.useId()
  useModalA11y({ containerRef, onClose, enabled: true, trapFocus: true })

  return (
    <ModalOverlay open={true} onClose={onClose} className="bg-foreground/80 dark:bg-black/80">
      <div
        ref={containerRef}
        data-app-modal="true"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className="fixed inset-x-0 bottom-0 mt-auto flex max-h-[85dvh] animate-in slide-in-from-bottom-8 duration-500 ease-[var(--ease-sheet-ios)] flex-col overflow-hidden rounded-t-[2rem] border border-border/70 bg-card/96 shadow-[var(--shadow-float)] ring-1 ring-border/50 backdrop-blur-2xl sm:inset-auto sm:top-1/2 sm:left-1/2 sm:max-h-[80dvh] sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[1.6rem]"
      >
        {title && (
          <div className="sticky top-0 z-10 flex flex-none items-center justify-between border-b border-border/55 bg-card/92 p-5 backdrop-blur">
            <h2 id={titleId} className="text-lg font-bold tracking-tight">{title}</h2>
            {onClose && (
              <button type="button"
                onClick={onClose}
                className="tap-lift flex h-10 w-10 items-center justify-center rounded-full bg-muted/85 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        <div className={cn("flex-1 overflow-y-auto p-5 overscroll-contain", contentClassName)}>
          {children}
        </div>
      </div>
    </ModalOverlay>
  )
}
