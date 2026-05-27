"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Crown } from "lucide-react"
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
      <article className="rounded-2xl border border-border bg-card p-5 text-card-foreground">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Crown className="h-6 w-6" />
        </div>

        <h2 className="text-center text-lg font-bold">Planificación Pro</h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Controla presupuestos, pagos, tarjetas, deudas y suscripciones desde un solo lugar.
        </p>
        <p className="mt-3 text-center text-sm text-muted-foreground">Esta función está disponible solo para usuarios Pro.</p>

        <ul className="mt-4 space-y-1 text-sm">
          <li>✓ Presupuestos inteligentes</li>
          <li>✓ Calendario financiero</li>
          <li>✓ Deudas y préstamos</li>
          <li>✓ Alertas de pagos</li>
          <li>✓ Suscripciones automáticas</li>
        </ul>

        <p className="mt-4 text-center text-xs text-muted-foreground">Abriendo planes...</p>

        <div className="mt-4 grid grid-cols-1 gap-2">
          <button
            type="button"
            onClick={() => setPlanOpen(true)}
            className="h-11 rounded-xl bg-primary text-sm font-bold text-primary-foreground"
          >
            Ver planes ahora
          </button>
          <Link
            href="/dashboard"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-muted text-sm font-bold text-foreground"
          >
            Volver al inicio
          </Link>
        </div>
      </article>

      <PlanSelectorSheet open={planOpen} onOpenChange={setPlanOpen} reasonTitle="Planificación Pro" reasonBody="Desbloquea planificación completa con MiCuadre Pro." />
    </>
  )
}
