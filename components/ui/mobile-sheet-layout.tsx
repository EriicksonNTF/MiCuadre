"use client"

import { useId, useRef } from "react"
import type { ReactNode } from "react"
import { X } from "lucide-react"
import { ModalOverlay } from "@/components/ui/modal-overlay"
import { useModalA11y } from "@/lib/a11y/use-modal-a11y"

type MobileSheetLayoutProps = {
  title: string
  children: ReactNode
  footer: ReactNode
  onClose?: () => void
}

export function MobileSheetLayout({ title, children, footer, onClose }: MobileSheetLayoutProps) {
  const titleId = useId()
  const containerRef = useRef<HTMLElement | null>(null)
  useModalA11y({ containerRef, onClose, enabled: true, trapFocus: true })

  return (
    <ModalOverlay open={true} onClose={onClose} className="bg-foreground/80 dark:bg-black/80">
      <div data-app-modal="true" className="flex min-h-full items-end">
      <section
        ref={containerRef}
        className="flex max-h-[88vh] w-full animate-in slide-in-from-bottom-8 duration-500 ease-[var(--ease-sheet-ios)] flex-col rounded-t-[2rem] border border-border/70 bg-card/96 text-card-foreground shadow-[var(--shadow-float)] ring-1 ring-border/50 backdrop-blur-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="flex shrink-0 justify-center pt-3">
          <div className="h-1.5 w-14 rounded-full bg-muted-foreground/20" />
        </div>

        <header className="relative shrink-0 border-b border-border/55 px-5 py-5 text-center">
          <h2 id={titleId} className="text-xl font-bold tracking-tight text-foreground">{title}</h2>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="tap-lift absolute right-5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-muted/80 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>

        <footer className="shrink-0 border-t border-border/55 bg-card/92 px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur">
          {footer}
        </footer>
      </section>
    </div>
    </ModalOverlay>
  )
}
