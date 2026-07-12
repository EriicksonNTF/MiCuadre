"use client"

import { useState, useEffect, useCallback, Children, cloneElement, type ReactElement, type Dispatch, type SetStateAction } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import { X } from "lucide-react"
import { Z_INDEX } from "@/lib/z-index"

export interface FilterSlideUpShellProps<T> {
  isOpen: boolean
  onClose: () => void
  onApply: (filters: T) => void
  initialFilters: T
  children: ReactElement<{ filters: T; setFilters: Dispatch<SetStateAction<T>> }>
  title?: string
}

export function FilterSlideUpShell<T>({
  isOpen,
  onClose,
  onApply,
  initialFilters,
  children,
  title = "Filtrar",
}: FilterSlideUpShellProps<T>) {
  const [filters, setFilters] = useState<T>(initialFilters)

  useEffect(() => {
    if (isOpen) setFilters(initialFilters)
  }, [isOpen, initialFilters])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    if (isOpen) window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose, isOpen])

  const handleBackdrop = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }, [onClose])

  const child = Children.only(children)
  const injected = cloneElement(child, { filters, setFilters } as any)

  if (typeof window === "undefined") return null

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0" style={{ zIndex: Z_INDEX.backdrop }} onClick={handleBackdrop}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="absolute bottom-0 left-0 right-0 flex max-h-[calc(100dvb-5rem)] flex-col rounded-t-[2rem] border border-border/70 bg-card shadow-[var(--shadow-float)]"
            style={{ zIndex: Z_INDEX.modal }}
          >
            <div className="flex items-center justify-between border-b border-border/50 px-6 py-4">
              <h2 className="text-lg font-bold text-foreground">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {injected}
            </div>

            <div className="border-t border-border/50 px-6 py-4 pb-[calc(1.25rem+env(safe-area-inset-bottom)+4.5rem)]">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFilters(initialFilters)}
                  className="h-12 rounded-xl border border-border bg-background text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                >
                  Limpiar
                </button>
                <button
                  type="button"
                  onClick={() => onApply(filters)}
                  className="h-12 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Buscar
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}
