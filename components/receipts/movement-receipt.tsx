"use client"

import { ReactNode, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { CheckCircle2, X } from "lucide-react"
import { cn } from "@/lib/utils"

type ReceiptLine = {
  label: string
  value?: ReactNode
}

type ReceiptSection = {
  title: string
  lines: ReceiptLine[]
}

type MovementReceiptProps = {
  open: boolean
  title: string
  amount: string
  sections: ReceiptSection[]
  primaryActionLabel: string
  secondaryActionLabel: string
  onPrimaryAction: () => void
  onSecondaryAction: () => void
  onClose?: () => void
}

export function MovementReceipt({
  open,
  title,
  amount,
  sections,
  primaryActionLabel,
  secondaryActionLabel,
  onPrimaryAction,
  onSecondaryAction,
  onClose,
}: MovementReceiptProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (open) {
      document.body.classList.add("modal-open")
    } else {
      document.body.classList.remove("modal-open")
    }
    return () => { document.body.classList.remove("modal-open") }
  }, [open])

  if (!open || !mounted) return null

  return createPortal(
    <>
      <div className="fixed inset-0 z-[90] bg-foreground/18 backdrop-blur-[6px] animate-in fade-in duration-200 dark:bg-black/45" onClick={onClose} aria-hidden="true" />
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-5">
        <div className="mx-auto flex w-full max-w-sm flex-col rounded-[20px] border border-border/15 bg-card shadow-[0_20px_60px_rgba(0,0,0,0.55)] animate-in fade-in zoom-in-95 duration-200 max-h-[calc(100dvh-2.5rem)]">
          <div className="overflow-y-auto p-5">
            <div className="flex items-start justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
                <CheckCircle2 className="h-[18px] w-[18px]" />
              </div>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground/[0.08] text-muted-foreground transition hover:text-foreground"
                  aria-label="Cerrar recibo"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <h2 className="mt-[18px] text-sm font-bold text-foreground">{title}</h2>
            <p className="mt-1 text-display-balance font-extrabold leading-[1.1] tracking-tight text-foreground tabular-nums">{amount}</p>

            <div className="mt-6 space-y-3">
              {sections
                .map((section) => ({
                  ...section,
                  lines: section.lines.filter((line) => line.value !== null && typeof line.value !== "undefined" && line.value !== ""),
                }))
                .filter((section) => section.lines.length > 0)
                .map((section) => (
                  <section key={section.title} className="rounded-[16px] bg-foreground/[0.03] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">{section.title}</p>
                    <div className="mt-3.5 space-y-3">
                      {section.lines.map((line) => (
                        <div key={line.label} className="flex items-start justify-between gap-4 text-sm">
                          <span className="text-muted-foreground">{line.label}</span>
                          <span className={cn("text-right font-semibold text-foreground", typeof line.value === "string" && line.value.length > 22 && "break-all")}>
                            {line.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
            </div>
          </div>

          <div className="grid shrink-0 grid-cols-2 gap-3 border-t border-border/10 p-5 pt-4">
            <button
              type="button"
              onClick={onSecondaryAction}
              className="h-12 rounded-full border border-border/20 bg-transparent text-sm font-bold text-foreground transition active:scale-[0.99]"
            >
              {secondaryActionLabel}
            </button>
            <button
              type="button"
              onClick={onPrimaryAction}
              className="h-12 rounded-full bg-foreground text-sm font-bold text-background transition active:scale-[0.99]"
            >
              {primaryActionLabel}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}
