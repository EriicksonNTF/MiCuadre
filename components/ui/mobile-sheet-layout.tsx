"use client"

import type { ReactNode } from "react"

type MobileSheetLayoutProps = {
  title: string
  children: ReactNode
  footer: ReactNode
  onClose?: () => void
}

export function MobileSheetLayout({ title, children, footer, onClose }: MobileSheetLayoutProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40">
      <section className="flex max-h-[88vh] w-full flex-col rounded-t-2xl border border-border bg-card text-card-foreground shadow-2xl ring-1 ring-border">
        <div className="flex shrink-0 justify-center pt-3">
          <div className="h-1.5 w-14 rounded-full bg-muted" />
        </div>

        <header className="relative shrink-0 border-b border-border px-5 py-5 text-center">
          <h2 className="text-xl font-bold tracking-tight text-foreground">{title}</h2>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="absolute right-5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-foreground transition hover:bg-muted"
              aria-label="Cerrar"
            >
              x
            </button>
          ) : null}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>

        <footer className="shrink-0 border-t border-border bg-card px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {footer}
        </footer>
      </section>
    </div>
  )
}
