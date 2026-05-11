"use client"

import { Wallet } from "lucide-react"

export function AppSplash() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="text-center">
        <div className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-[28px] bg-gradient-to-br from-primary to-emerald-500 text-white shadow-[0_24px_60px_-20px_rgba(16,185,129,0.45)]">
          <div className="absolute inset-0 rounded-[28px] border border-white/30" />
          <Wallet className="h-10 w-10" />
        </div>
        <h1 className="mt-5 text-3xl font-bold tracking-tight text-foreground">MiCuadre</h1>
      </div>
    </main>
  )
}

export function DashboardLoadingIcon() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <div className="relative h-14 w-14">
        <div className="absolute inset-0 animate-spin rounded-2xl border-4 border-primary/25 border-t-primary" />
        <div className="absolute inset-3 rounded-lg bg-primary/10" />
      </div>
    </main>
  )
}
