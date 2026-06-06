"use client"

import Link from "next/link"
import { CreditCard, QrCode, Send } from "lucide-react"
import { cn } from "@/lib/utils"

const actions = [
  {
    href: "/send",
    label: "Enviar",
    description: "Transferir dinero",
    icon: Send,
    tone: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
  },
  {
    href: "/pay",
    label: "Pagar tarjeta",
    description: "Saldar corte",
    icon: CreditCard,
    tone: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  },
  {
    href: "/scan",
    label: "Escanear",
    description: "Registrar recibo",
    icon: QrCode,
    tone: "bg-amber-500/14 text-amber-700 dark:text-amber-300",
  },
]

export function QuickActions() {
  return (
    <section className="grid gap-3">
      <Link
        href={actions[0].href}
        className="tap-lift group flex items-center justify-between rounded-[1.65rem] border border-border/70 bg-card p-4 shadow-[var(--shadow-soft)]"
      >
        <div className="flex items-center gap-3">
          <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl", actions[0].tone)}>
            <Send className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-black text-foreground">{actions[0].label}</p>
            <p className="text-xs text-muted-foreground">{actions[0].description}</p>
          </div>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground group-active:scale-95">
          Ahora
        </span>
      </Link>

      <div className="grid grid-cols-2 gap-3">
        {actions.slice(1).map((action) => {
          const Icon = action.icon
          return (
            <Link
              key={action.href}
              href={action.href}
              className="tap-lift rounded-[1.5rem] border border-border/70 bg-card p-4 shadow-sm"
            >
              <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", action.tone)}>
                <Icon className="h-5 w-5" />
              </div>
              <p className="mt-4 text-sm font-black leading-tight text-foreground">{action.label}</p>
              <p className="mt-1 text-xs leading-snug text-muted-foreground">{action.description}</p>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
