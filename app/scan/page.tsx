"use client"

import Link from "next/link"
import {
  ArrowLeft,
  QrCode,
  Camera,
  Upload,
} from "lucide-react"
import { Button } from "@/components/ui/button"

export default function ScanPage() {
  return (
    <div className="app-scroll min-h-[100dvh] overflow-y-auto bg-background pb-nav-safe">
      <header className="flex items-center gap-3 px-6 pb-4 pt-8">
        <Link
          href="/"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-semibold text-foreground">Escanear</h1>
      </header>

      <div className="flex flex-col items-center justify-center px-6 pt-12">
        <div className="relative flex h-64 w-64 items-center justify-center rounded-3xl bg-muted">
          <QrCode className="h-24 w-24 text-muted-foreground/30" />
          <div className="absolute inset-8 rounded-2xl border-2 border-dashed border-muted-foreground/30" />
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Escanea un código QR para agregar una transacción o beneficiario
        </p>

        <div className="mt-8 w-full space-y-3">
          <Button
            variant="outline"
            className="h-14 w-full rounded-2xl gap-2"
          >
            <Camera className="h-5 w-5" />
            Abrir cámara
          </Button>

          <Button
            variant="outline"
            className="h-14 w-full rounded-2xl gap-2"
          >
            <Upload className="h-5 w-5" />
            Subir imagen
          </Button>
        </div>

        <div className="mt-8 rounded-2xl bg-card p-4">
          <p className="text-sm text-muted-foreground text-center">
            Próximamente: Escanea recibos para crear transacciones automáticamente usando IA
          </p>
        </div>
      </div>
    </div>
  )
}
