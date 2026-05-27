"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { ChevronLeft, Sparkles } from "lucide-react"
import { PlanSelectorSheet } from "@/components/billing/plan-selector-sheet"
import { useBillingStatus } from "@/hooks/use-billing-status"
import { notify } from "@/lib/notifications"
import { PLAN_CONFIG } from "@/lib/billing/plans"

export function PlanScreen() {
  const [open, setOpen] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const params = useSearchParams()
  const { data: billingStatus, mutate: refreshBillingStatus } = useBillingStatus()

  useEffect(() => {
    setOpen(true)
  }, [])

  useEffect(() => {
    const checkoutState = params.get("checkout")
    if (checkoutState === "success") {
      notify({ title: "Pago recibido", message: "Estamos verificando tu plan..." })
    }
    if (checkoutState === "cancelled") {
      notify({ title: "Pago cancelado", message: "No se completó el pago." })
    }
  }, [params])

  const verifyStatus = async () => {
    setIsVerifying(true)
    await refreshBillingStatus()
    notify({ title: "Estado verificado", message: "Tu plan se sincronizó correctamente." })
    setIsVerifying(false)
  }

  const checkoutState = params.get("checkout")
  const isProActive = billingStatus?.planTier === "pro"
  const lastSyncedLabel = billingStatus?.lastSyncedAt
    ? new Date(billingStatus.lastSyncedAt).toLocaleString()
    : "Sin sincronización reciente"

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
          <button
            type="button"
            onClick={verifyStatus}
            disabled={isVerifying}
            className="mt-2 h-11 w-full rounded-xl border border-border bg-background text-sm font-bold text-foreground transition active:scale-[0.99] disabled:opacity-60"
          >
            {isVerifying ? "Verificando..." : "Verificar estado"}
          </button>

          {checkoutState === "success" && !isProActive && (
            <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-left text-xs text-amber-800">
              Pago recibido. Estamos verificando tu plan. Si no cambia en unos segundos, toca "Verificar estado".
              <p className="mt-1 font-semibold">Última sincronización: {lastSyncedLabel}</p>
            </div>
          )}

          {checkoutState === "success" && isProActive && (
            <div className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-3 text-left text-xs text-emerald-900">
              <p className="text-sm font-bold">Felicidades, ya eres Pro.</p>
              <p className="mt-1">Ya tienes acceso a:</p>
              <ul className="mt-1 list-disc pl-4">
                {PLAN_CONFIG.pro.benefits.slice(0, 4).map((benefit) => (
                  <li key={benefit}>{benefit}</li>
                ))}
              </ul>
            </div>
          )}

          {checkoutState === "cancelled" && (
            <div className="mt-3 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-left text-xs text-slate-700">
              No se completó el pago. Puedes intentarlo de nuevo cuando quieras.
            </div>
          )}

          <p className="mt-3 text-[11px] text-muted-foreground">Última sincronización de facturación: {lastSyncedLabel}</p>
        </div>
      </main>

      <PlanSelectorSheet open={open} onOpenChange={setOpen} />
    </div>
  )
}
