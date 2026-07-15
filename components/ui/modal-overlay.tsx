"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { useModalA11y } from "@/lib/a11y/use-modal-a11y"

type ModalOverlayProps = {
  open: boolean
  onClose?: () => void
  blocking?: boolean
  className?: string
  children?: ReactNode
  asPortal?: boolean
  trapFocus?: boolean
}

export function ModalOverlay({
  open,
  onClose,
  blocking,
  className,
  children,
  asPortal = true,
  trapFocus = false,
}: ModalOverlayProps) {
  const focusRef = useRef<HTMLDivElement | null>(null)
  useModalA11y({ containerRef: focusRef, onClose, enabled: open && trapFocus, trapFocus })

  useEffect(() => {
    if (!open) return
    document.body.classList.add("modal-open")
    return () => {
      document.body.classList.remove("modal-open")
    }
  }, [open])

  if (!open) return null

  const content = (
    <div
      className={cn(
        "fixed inset-0 z-[var(--z-overlay)] bg-foreground/40 backdrop-blur-[6px] animate-in fade-in duration-200 dark:bg-black/50",
        className,
      )}
      onClick={blocking ? undefined : onClose}
      data-modal-overlay
    >
      <div ref={trapFocus ? focusRef : undefined}>
        {children}
      </div>
    </div>
  )

  if (asPortal && typeof document !== "undefined") {
    return createPortal(content, document.body)
  }

  return content
}
