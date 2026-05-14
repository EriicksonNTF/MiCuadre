"use client"

import Image from "next/image"

export function AppSplash() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="text-center">
        <div className="relative mx-auto h-24 w-24">
          <div className="absolute inset-0 rounded-[28px] bg-gradient-to-br from-[#14B8A6]/30 to-[#10B981]/20 blur-xl" />
          <div className="relative overflow-hidden rounded-[28px] border border-white/35 shadow-[0_24px_60px_-20px_rgba(16,185,129,0.45)]">
            <Image src="/icono-favicon.png" alt="MiCuadre" width={96} height={96} className="h-24 w-24 object-cover" priority />
          </div>
        </div>
        <h1 className="mt-5 text-3xl font-bold tracking-tight text-foreground">MiCuadre</h1>
      </div>
    </main>
  )
}

export function DashboardLoadingIcon() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="overflow-hidden rounded-2xl border border-border/70 shadow-md">
          <Image src="/icono-favicon.png" alt="MiCuadre" width={56} height={56} className="h-14 w-14 object-cover" />
        </div>
        <div className="relative h-6 w-6">
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
        </div>
      </div>
    </main>
  )
}
