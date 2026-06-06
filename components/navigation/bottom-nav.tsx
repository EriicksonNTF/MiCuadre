"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Home, Plus, Wallet, CalendarCog, Clock, Repeat, ReceiptText } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"

const navItems = [
  { href: "/dashboard", icon: Home, label: "Inicio" },
  { href: "/accounts", icon: Wallet, label: "Cuentas" },
  { href: "/expense", icon: Plus, label: "Agregar", isAction: true },
  { href: "/history", icon: Clock, label: "Historial" },
  { href: "/planning", icon: CalendarCog, label: "Planificación" },
]

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading } = useAuth()
  const [isMobileFormOpen, setIsMobileFormOpen] = useState(false)
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
    const update = () => {
      setIsMobileFormOpen(document.body.classList.contains("mobile-form-open"))
    }

    update()
    const observer = new MutationObserver(update)
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    setShowQuickMenu(false)
  }, [pathname])

  if (loading) return null

  const isAuthPage = pathname.startsWith('/auth')
  const isOnboardingPage = pathname.startsWith('/onboarding')

  if (isAuthPage || isOnboardingPage || !user || isMobileFormOpen) return null

  return (
    <>
      {showQuickMenu && (
        <button type="button"
          aria-label="Cerrar menú rápido"
          onClick={() => setShowQuickMenu(false)}
          className="fixed inset-0 z-40 bg-foreground/12 backdrop-blur-[6px] dark:bg-black/35"
        />
      )}

      {showQuickMenu && (
        <div className="pointer-events-none fixed bottom-24 left-0 right-0 z-50 animate-in fade-in-0 slide-in-from-bottom-3 duration-300 ease-[var(--ease-out-ios)]">
          <div className="pointer-events-auto mx-auto w-[min(92vw,20rem)] rounded-[1.45rem] border border-border/70 bg-card/96 p-2 shadow-[var(--shadow-float)] backdrop-blur-2xl">
            <button type="button"
              onClick={() => {
                setShowQuickMenu(false)
                router.push("/expense")
              }}
              className="tap-lift flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-muted/70"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/14 text-accent"><ReceiptText className="h-4 w-4" /></span>
              <span className="text-sm font-medium text-foreground">Añadir transacción</span>
            </button>
            <button type="button"
              onClick={() => {
                setShowQuickMenu(false)
                router.push("/settings/subscriptions?create=1")
              }}
              className="tap-lift flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-muted/70"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/18 text-gold"><Repeat className="h-4 w-4" /></span>
              <span className="text-sm font-medium text-foreground">Añadir suscripción</span>
            </button>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-50 px-3 pb-[calc(0.65rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto flex h-[4.7rem] max-w-md items-center justify-around rounded-[1.8rem] border border-border/65 bg-card/88 px-3 shadow-[var(--shadow-float)] backdrop-blur-2xl">
        {navItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== "/" && pathname.startsWith(item.href))
          const Icon = item.icon

          if (item.isAction) {
            return (
              <button type="button"
                key={item.href}
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
                  if (!longPressTriggered) {
                    clearLongPress()
                  }
                }}
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_18px_42px_-24px_rgba(0,0,0,0.55)] transition-[transform,box-shadow] duration-200 ease-[var(--ease-out-ios)] active:scale-95",
                  pressingAction && "scale-95"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="sr-only">{item.label}</span>
              </button>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "tap-lift relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-2 transition-colors",
                isActive ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {isActive && <span className="absolute inset-x-4 top-1 h-7 rounded-full bg-accent/10" />}
              <Icon className={cn("relative h-5 w-5 transition-transform duration-200 ease-[var(--ease-out-ios)]", isActive && "-translate-y-0.5 text-accent")} />
              <span className={cn("relative max-w-full truncate text-[10px] font-semibold", isActive && "text-foreground")}>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
    </>
  )
}
