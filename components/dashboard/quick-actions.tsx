"use client"

import Link from "next/link"
import { Send, CreditCard, QrCode, Plus } from "lucide-react"

export function QuickActions() {
  return (
    <div className="flex justify-between">
      <Link
        href="/send"
        className="flex flex-col items-center gap-2 rounded-2xl p-3 transition-colors hover:bg-muted active:scale-95"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Send className="h-5 w-5 text-foreground" />
        </div>
        <span className="text-xs font-medium text-muted-foreground">Enviar</span>
      </Link>

      <Link
        href="/pay"
        className="flex flex-col items-center gap-2 rounded-2xl p-3 transition-colors hover:bg-muted active:scale-95"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <CreditCard className="h-5 w-5 text-foreground" />
        </div>
        <span className="text-xs font-medium text-muted-foreground">Pagar</span>
      </Link>

      <Link
        href="/scan"
        className="flex flex-col items-center gap-2 rounded-2xl p-3 transition-colors hover:bg-muted active:scale-95"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <QrCode className="h-5 w-5 text-foreground" />
        </div>
        <span className="text-xs font-medium text-muted-foreground">Escanear</span>
      </Link>

      <Link
        href="/accounts"
        className="flex flex-col items-center gap-2 rounded-2xl p-3 transition-colors hover:bg-muted active:scale-95"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Plus className="h-5 w-5 text-foreground" />
        </div>
        <span className="text-xs font-medium text-muted-foreground">Recargar</span>
      </Link>
    </div>
  )
}
