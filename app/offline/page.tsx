"use client"

import Link from "next/link"
import { CloudOff, RefreshCcw } from "lucide-react"

export default function OfflinePage() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-6 py-10 text-center">
      <div className="relative flex h-20 w-20 items-center justify-center rounded-[1.65rem] bg-card shadow-[var(--shadow-soft)] ring-1 ring-border/60">
        <CloudOff className="h-9 w-9 text-muted-foreground" />
        <span className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full bg-amber-500 ring-2 ring-background dark:bg-amber-400 dark:ring-background" />
      </div>

      <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-foreground">
        Estás sin conexión
      </h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
        No pudimos conectar con MiCuadre. Tus gastos e ingresos que registres
        ahora se guardarán en el dispositivo y se sincronizarán automáticamente
        cuando vuelvas a tener internet.
      </p>

      <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined") {
              window.location.reload()
            }
          }}
          className="tap-lift inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-lift)]"
        >
          <RefreshCcw className="h-4 w-4" />
          Reintentar
        </button>
        <Link
          href="/dashboard"
          className="tap-lift inline-flex h-12 items-center justify-center rounded-2xl border border-border/70 bg-card px-5 text-sm font-semibold text-foreground"
        >
          Ir al inicio
        </Link>
      </div>

      <p className="mt-10 text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        MiCuadre · Funciona offline
      </p>
    </main>
  )
}
