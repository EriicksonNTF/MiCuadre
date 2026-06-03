"use client"
import React from "react"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"
import { useIsMobile } from "@/components/ui/use-mobile"
import { MobileFullscreenForm } from "@/components/ui/mobile-fullscreen-form"

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

  React.useEffect(() => {
    if (isMobile) return
    document.body.classList.add("modal-open")
    return () => {
      document.body.classList.remove("modal-open")
    }
  }, [isMobile])

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
    <>
      <div 
        data-app-modal="true"
        className="fixed inset-0 z-[90] bg-foreground/18 backdrop-blur-[6px] dark:bg-black/45"
        onClick={onClose}
      />
      <div data-app-modal="true" className="fixed inset-x-0 bottom-0 z-[100] mt-auto flex max-h-[85dvh] animate-in slide-in-from-bottom-8 duration-500 ease-[var(--ease-sheet-ios)] flex-col overflow-hidden rounded-t-[2rem] border border-border/70 bg-card/96 shadow-[var(--shadow-float)] ring-1 ring-border/50 backdrop-blur-2xl sm:inset-auto sm:top-1/2 sm:left-1/2 sm:max-h-[80dvh] sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[1.6rem]">
        {/* HEADER */}
        {title && (
          <div className="sticky top-0 z-10 flex flex-none items-center justify-between border-b border-border/55 bg-card/92 p-5 backdrop-blur">
            <h2 className="text-lg font-bold tracking-tight">{title}</h2>
            {onClose && (
              <button type="button" 
                onClick={onClose}
                className="tap-lift flex h-10 w-10 items-center justify-center rounded-full bg-muted/85 text-muted-foreground hover:bg-muted hover:text-foreground"
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
          <div className="sticky bottom-0 flex-none border-t border-border/55 bg-card/92 p-4 pb-[calc(16px+env(safe-area-inset-bottom))] backdrop-blur sm:rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </>
  )
}
