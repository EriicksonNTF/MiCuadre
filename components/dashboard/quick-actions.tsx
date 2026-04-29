"use client"

import { Send, CreditCard, QrCode, Plus } from "lucide-react"

const actions = [
  { icon: Send, label: "Enviar" },
  { icon: CreditCard, label: "Pagar" },
  { icon: QrCode, label: "Escanear" },
  { icon: Plus, label: "Recargar" },
]

export function QuickActions() {
  return (
    <div className="flex justify-between">
      {actions.map((action) => {
        const Icon = action.icon
        return (
          <button
            key={action.label}
            className="flex flex-col items-center gap-2 rounded-2xl p-3 transition-colors hover:bg-muted active:scale-95"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Icon className="h-5 w-5 text-foreground" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              {action.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
