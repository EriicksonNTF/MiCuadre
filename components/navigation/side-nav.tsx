"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { Home, Wallet, Plus, Clock, CalendarCog, Repeat, ReceiptText, Bell, Sparkles, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import { ModalOverlay } from "@/components/ui/modal-overlay"
import { useAuth } from "@/hooks/use-auth"

const navItems = [
  { href: "/dashboard", icon: Home, label: "Inicio" },
  { href: "/accounts", icon: Wallet, label: "Cuentas" },
  { href: "/expense", icon: Plus, label: "Agregar", isAction: true },
  { href: "/history", icon: Clock, label: "Historial" },
  { href: "/planning", icon: CalendarCog, label: "Planificación" },
]

const secondaryItems = [
  { href: "/coach-ia", icon: Sparkles, label: "Coach IA" },
  { href: "/notifications", icon: Bell, label: "Notificaciones" },
  { href: "/settings", icon: Settings, label: "Ajustes" },
]

export function SideNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading } = useAuth()
  const [showQuickMenu, setShowQuickMenu] = useState(false)
  const [longPressTriggered, setLongPressTriggered] = useState(false)
  const [pressingAction, setPressingAction] = useState(false)
  const [pressStart, setPressStart] = useState<{ x: number; y: number } | null>(null)
  const longPressTimerRef = useRef<number | null>(null)

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  useEffect(() => {
    setShowQuickMenu(false)
  }, [pathname])

  if (loading || !user) return null

  const isAuthPage = pathname.startsWith("/auth")
  const isOnboardingPage = pathname.startsWith("/onboarding")
  const isLandingPage = pathname === "/"

  if (isAuthPage || isOnboardingPage || isLandingPage) return null

  return (
    <>
      <aside className="fixed left-0 top-0 z-40 hidden h-full w-[280px] flex-col border-r border-border bg-card lg:flex">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 px-6 border-b border-border">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-black">
            M
          </div>
          <span className="text-base font-bold text-foreground">MiCuadre</span>
        </div>

        {/* Primary nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href))
            const Icon = item.icon

            if (item.isAction) {
              return (
                <button
                  key={item.href}
                  type="button"
                  onPointerDown={(event) => {
                    setPressingAction(true)
                    setLongPressTriggered(false)
                    setPressStart({ x: event.clientX, y: event.clientY })
                    clearLongPress()
                    longPressTimerRef.current = window.setTimeout(() => {
                      setLongPressTriggered(true)
                      setShowQuickMenu(true)
                    }, 520)
                  }}
                  onPointerMove={(event) => {
                    if (!pressStart || !pressingAction || longPressTriggered) return
                    const movedX = Math.abs(event.clientX - pressStart.x)
                    const movedY = Math.abs(event.clientY - pressStart.y)
                    if (movedX > 10 || movedY > 10) {
                      clearLongPress()
                    }
                  }}
                  onPointerUp={() => {
                    clearLongPress()
                    const wasLongPress = longPressTriggered
                    setPressingAction(false)
                    setPressStart(null)
                    if (!wasLongPress) {
                      setShowQuickMenu(false)
                      router.push("/expense")
                    }
                  }}
                  onPointerLeave={() => {
                    if (!longPressTriggered) clearLongPress()
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors",
                    "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
                    pressingAction && "scale-[0.98]"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </button>
              )
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors",
                  isActive
                    ? "bg-accent/10 text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            )
          })}

          {/* Separator */}
          <div className="my-3 border-t border-border" />

          {/* Secondary nav */}
          {secondaryItems.map((item) => {
            const isActive = pathname === item.href ||
              pathname.startsWith(item.href + "/")
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors",
                  isActive
                    ? "bg-accent/10 text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>

      <ModalOverlay open={showQuickMenu} onClose={() => setShowQuickMenu(false)}>
        <div className="flex min-h-full items-center justify-center">
          <div className="w-56 animate-in fade-in-0 zoom-in-95 duration-200 rounded-[1.45rem] border border-border/70 bg-card/96 p-2 shadow-[var(--shadow-float)] backdrop-blur-2xl">
            <button
              type="button"
              onClick={() => { setShowQuickMenu(false); router.push("/expense") }}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted/70"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/14 text-accent">
                <ReceiptText className="h-4 w-4" />
              </span>
              Añadir transacción
            </button>
            <button
              type="button"
              onClick={() => { setShowQuickMenu(false); router.push("/settings/subscriptions?create=1") }}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted/70"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/18 text-gold">
                <Repeat className="h-4 w-4" />
              </span>
              Añadir suscripción
            </button>
          </div>
        </div>
      </ModalOverlay>
    </>
  )
}
