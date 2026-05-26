"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ChevronLeft, Sparkles } from "lucide-react"
import { PlanSelectorSheet } from "@/components/billing/plan-selector-sheet"

export function PlanScreen() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(true)
  }, [])

  return (
    <div className="app-scroll min-h-[100dvh] overflow-y-auto bg-background pb-nav-safe text-foreground">
      <div className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center gap-4 px-5 py-4">
          <Link href="/settings" className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/80 transition hover:bg-muted">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold">Planes MiCuadre</h1>
            <p className="text-xs text-muted-foreground">El selector se abre en una hoja inferior.</p>
          </div>
        </div>
      </div>

      <main className="mx-auto flex min-h-[calc(100dvh-80px)] max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-xl font-black">Elige el plan ideal para ti</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Consulta Free y Pro en una experiencia móvil simple.
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-5 h-11 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground transition active:scale-[0.99]"
          >
            Ver planes
          </button>
        </div>
      </main>

      <PlanSelectorSheet open={open} onOpenChange={setOpen} />
    </div>
  )
}
