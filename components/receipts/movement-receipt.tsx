"use client"

import { ReactNode } from "react"
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
  if (!open) return null

  return (
    <>
      {/* Denser backdrop — fully hides navbar underneath */}
      <div className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-[6px] animate-in fade-in duration-200" onClick={onClose} />
      {/* Centered receipt card — always vertically centered, covers all screen sizes */}
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="mx-auto flex w-full max-w-md flex-col rounded-2xl border border-border bg-card shadow-2xl ring-1 ring-border animate-in fade-in zoom-in-95 duration-200 max-h-[calc(100dvh-2rem)]">
          <div className="overflow-y-auto p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-500">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h2 className="mt-3 text-xl font-black text-foreground">{title}</h2>
                <p className="mt-1 text-3xl font-black tracking-tight text-foreground">{amount}</p>
              </div>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground transition hover:text-foreground"
                  aria-label="Cerrar recibo"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="mt-5 space-y-3">
              {sections
                .map((section) => ({
                  ...section,
                  lines: section.lines.filter((line) => line.value !== null && typeof line.value !== "undefined" && line.value !== ""),
                }))
                .filter((section) => section.lines.length > 0)
                .map((section) => (
                  <section key={section.title} className="rounded-2xl bg-muted/35 p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">{section.title}</p>
                    <div className="mt-2 space-y-2">
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

          <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-border p-4">
            <button
              type="button"
              onClick={onPrimaryAction}
              className="h-11 rounded-xl border border-border bg-background text-sm font-black text-foreground transition active:scale-[0.99]"
            >
              {primaryActionLabel}
            </button>
            <button
              type="button"
              onClick={onSecondaryAction}
              className="h-11 rounded-xl bg-primary text-sm font-black text-primary-foreground transition active:scale-[0.99]"
            >
              {secondaryActionLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
