"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Plus, Wallet, Target, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"

const navItems = [
  { href: "/", icon: Home, label: "Inicio" },
  { href: "/accounts", icon: Wallet, label: "Cuentas" },
  { href: "/expense", icon: Plus, label: "Agregar", isAction: true },
  { href: "/history", icon: Clock, label: "Historial" },
  { href: "/goals", icon: Target, label: "Metas" },
]

export function BottomNav() {
  const pathname = usePathname()
  const { user, loading } = useAuth()

  if (loading) return null

  const isAuthPage = pathname.startsWith('/auth')

  if (isAuthPage || !user) return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-card/95 backdrop-blur-lg">
      <div className="mx-auto flex h-20 max-w-md items-center justify-around px-2 pb-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== "/" && pathname.startsWith(item.href))
          const Icon = item.icon

          if (item.isAction) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95"
              >
                <Icon className="h-5 w-5" />
                <span className="sr-only">{item.label}</span>
              </Link>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-2 transition-colors",
                isActive ? "text-foreground" : "text-muted-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "text-accent")} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
