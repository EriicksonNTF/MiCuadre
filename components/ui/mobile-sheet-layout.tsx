"use client"

import type { ReactNode } from "react"
import { X } from "lucide-react"

type MobileSheetLayoutProps = {
  title: string
  children: ReactNode
  footer: ReactNode
  onClose?: () => void
}

export function MobileSheetLayout({ title, children, footer, onClose }: MobileSheetLayoutProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-foreground/18 backdrop-blur-[6px] dark:bg-black/45">
      <section className="flex max-h-[88vh] w-full animate-in slide-in-from-bottom-8 duration-500 ease-[var(--ease-sheet-ios)] flex-col rounded-t-[2rem] border border-border/70 bg-card/96 text-card-foreground shadow-[var(--shadow-float)] ring-1 ring-border/50 backdrop-blur-2xl">
        <div className="flex shrink-0 justify-center pt-3">
          <div className="h-1.5 w-14 rounded-full bg-muted-foreground/20" />
        </div>

        <header className="relative shrink-0 border-b border-border/55 px-5 py-5 text-center">
          <h2 className="text-xl font-bold tracking-tight text-foreground">{title}</h2>
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
  )
}
