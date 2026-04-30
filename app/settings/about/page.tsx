"use client"

import Link from "next/link"
import { ChevronLeft, Smartphone, Code, Heart } from "lucide-react"

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="sticky top-0 z-10 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto max-w-md px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/settings" className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-lg font-semibold">Acerca de</h1>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-md px-6 pt-8 space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-accent to-emerald-600">
            <Smartphone className="h-10 w-10 text-white" />
          </div>
          <h2 className="mt-4 text-2xl font-bold">MiCuadre</h2>
          <p className="mt-1 text-sm text-muted-foreground">Versión 1.0.0</p>
        </div>
        <div className="rounded-2xl bg-card p-5">
          <p className="text-sm text-muted-foreground leading-relaxed">
            MiCuadre es tu asistente de finanzas personales. Administra tus cuentas, controla tus gastos,
            alcanza tus metas de ahorro y toma el control de tu dinero — todo en un solo lugar.
          </p>
        </div>
        <div className="rounded-2xl bg-card overflow-hidden divide-y divide-border">
          <div className="flex items-center justify-between p-5">
            <span className="font-medium">Versión</span>
            <span className="text-sm text-muted-foreground">1.0.0</span>
          </div>
          <div className="flex items-center justify-between p-5">
            <span className="font-medium">Plataforma</span>
            <span className="text-sm text-muted-foreground">iOS, Android, Web</span>
          </div>
          <div className="flex items-center justify-between p-5">
            <span className="font-medium">Licencia</span>
            <span className="text-sm text-muted-foreground">MIT</span>
          </div>
        </div>
        <div className="rounded-2xl bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Code className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">Código abierto</p>
              <p className="text-sm text-muted-foreground">Tecnología: Next.js, React, Supabase</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
              <Heart className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="font-semibold">Hecho con amor</p>
              <p className="text-sm text-muted-foreground">Santo Domingo, República Dominicana</p>
            </div>
          </div>
        </div>
        <p className="pt-4 text-center text-xs text-muted-foreground">
          © 2026 MiCuadre. Todos los derechos reservados.
        </p>
      </div>
    </div>
  )
}