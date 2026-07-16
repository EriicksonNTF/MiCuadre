"use client"

import React, { useEffect } from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"
import { Branch as DismissableLayerBranch } from "@radix-ui/react-dismissable-layer"
import { RemoveScroll } from "react-remove-scroll"
import { Z_INDEX } from "@/lib/z-index"

interface SlideUpModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  footer?: React.ReactNode
  contentClassName?: string
}

export function SlideUpModal({ isOpen, onClose, title, children, footer, contentClassName }: SlideUpModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    if (isOpen) window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose, isOpen])

  if (typeof window === "undefined") return null

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        // This modal portals straight to document.body, outside the DOM subtree of
        // any enclosing Drawer/Dialog. Radix's DismissableLayer (which those use to
        // detect "outside" clicks and dismiss/refocus itself) only recognizes DOM
        // descendants as "inside" — without this Branch registration, every tap here
        // reads as an outside interaction and the enclosing modal fights it for focus
        // mid-gesture, breaking scroll/tap. Branch registers via React context (which
        // portals don't break), regardless of DOM placement.
        //
        // Separately, an enclosing Drawer/Dialog's own react-remove-scroll instance
        // only allows wheel/touch scroll gestures inside its own shard — everything
        // else gets preventDefault()'d, which is why taps on a date worked but
        // dragging the wheel picker itself didn't. Nesting our own RemoveScroll here
        // makes it the active lock (last-mounted wins) while this modal is open, so
        // scrolling inside it is allowed again; closing it restores the parent's lock.
        <DismissableLayerBranch className="contents">
          <RemoveScroll as="div" forwardProps removeScrollBar={false} allowPinchZoom>
            <div className="fixed inset-0 flex flex-col justify-end" style={{ zIndex: Z_INDEX.modal, pointerEvents: "auto" }}>
              <motion.div
                className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={onClose}
              />
              <motion.div
                className="relative flex max-h-[90vh] flex-col overflow-hidden rounded-t-[2rem] border-t bg-background shadow-xl"
                role="dialog"
                aria-modal="true"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 300 }}
              >
                {title && (
                  <div className="flex items-center justify-between border-b p-4">
                    <h2 className="text-lg font-semibold">{title}</h2>
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-full p-1 transition-colors hover:bg-muted"
                      aria-label="Cerrar modal"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                )}
                <div className={cn("flex-1 overflow-y-auto p-4", contentClassName)}>
                  {children}
                </div>
                {footer && (
                  <div className="shrink-0 border-t p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom)+4.5rem)]">
                    {footer}
                  </div>
                )}
              </motion.div>
            </div>
          </RemoveScroll>
        </DismissableLayerBranch>
      )}
    </AnimatePresence>,
    document.body
  )
}
