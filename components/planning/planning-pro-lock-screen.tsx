"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { CalendarDays, Crown, CreditCard, PiggyBank } from "lucide-react"
import { PlanSelectorSheet } from "@/components/billing/plan-selector-sheet"

export function PlanningProLockScreen() {
  const [planOpen, setPlanOpen] = useState(false)
  const hasAutoOpened = useRef(false)

  useEffect(() => {
    if (hasAutoOpened.current) return
    hasAutoOpened.current = true

    const timer = window.setTimeout(() => {
      setPlanOpen(true)
    }, 1000)

    return () => {
      window.clearTimeout(timer)
    }
  }, [])

  return (
    <>
      <article className="relative overflow-hidden rounded-[1.8rem] bg-foreground p-5 text-background shadow-[0_24px_60px_-32px_rgba(0,0,0,0.72)]">
        <div className="absolute -right-12 -top-14 h-40 w-40 rounded-full bg-background/10" />
        <div className="absolute -bottom-20 left-8 h-44 w-44 rounded-full border border-background/10" />
        <div className="relative">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-background/12 text-amber-200">
            <Crown className="h-7 w-7" />
          </div>

          <h2 className="text-center text-2xl font-black tracking-tight">Planificación Pro</h2>
          <p className="mt-2 text-center text-sm leading-6 text-background/68">
            Controla presupuestos, pagos, tarjetas, deudas y suscripciones desde un solo lugar.
          </p>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-background/10 p-3">
              <PiggyBank className="h-4 w-4 text-emerald-200" />
              <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-background/60">Presupuestos</p>
            </div>
            <div className="rounded-2xl bg-background/10 p-3">
              <CalendarDays className="h-4 w-4 text-sky-200" />
              <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-background/60">Calendario</p>
            </div>
            <div className="rounded-2xl bg-background/10 p-3">
              <CreditCard className="h-4 w-4 text-amber-200" />
              <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-background/60">Deudas</p>
            </div>
          </div>

          <p className="mt-4 rounded-full bg-background/10 px-3 py-2 text-center text-xs font-semibold text-background/65">Abriendo planes...</p>
        </div>

        <div className="relative mt-4 grid grid-cols-1 gap-2">
          <button
            type="button"
            onClick={() => setPlanOpen(true)}
            className="h-12 rounded-2xl bg-background text-sm font-black text-foreground"
          >
            Ver planes ahora
          </button>
          <Link
            href="/dashboard"
            className="inline-flex h-12 items-center justify-center rounded-2xl bg-background/10 text-sm font-bold text-background"
          >
            Volver al inicio
          </Link>
        </div>
      </article>

      <PlanSelectorSheet open={planOpen} onOpenChange={setPlanOpen} reasonTitle="Planificación Pro" reasonBody="Desbloquea planificación completa con MiCuadre Pro." />
    </>
  )
}
