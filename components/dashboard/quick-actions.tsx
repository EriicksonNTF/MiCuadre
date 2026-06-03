"use client"

import Link from "next/link"
import { Send, CreditCard, QrCode } from "lucide-react"
import { cn } from "@/lib/utils"

const actions = [
  {
    href: "/send",
    label: "Enviar",
    icon: Send,
    tone: "from-sky-500/16 to-cyan-500/10 text-sky-700 dark:text-sky-300",
  },
  {
    href: "/pay",
    label: "Pagar",
    icon: CreditCard,
    tone: "from-emerald-500/16 to-teal-500/10 text-emerald-700 dark:text-emerald-300",
  },
  {
    href: "/scan",
    label: "Escanear",
    icon: QrCode,
    tone: "from-amber-500/18 to-orange-500/10 text-amber-700 dark:text-amber-300",
  },
]

export function QuickActions() {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {actions.map((action) => {
        const Icon = action.icon
        return (
          <Link
            key={action.href}
            href={action.href}
            className="tap-lift group flex flex-col items-center gap-2 rounded-[1.35rem] border border-border/60 bg-card/72 p-3 shadow-sm backdrop-blur transition-colors hover:bg-card"
          >
            <div className={cn("flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br shadow-inner transition-transform duration-200 ease-[var(--ease-out-ios)] group-active:scale-95", action.tone)}>
              <Icon className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-muted-foreground">{action.label}</span>
          </Link>
        )
      })}
    </div>
  )
}
