"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Home, Plus, Wallet, CalendarCog, Clock, Repeat, ReceiptText } from "lucide-react"
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
      <ModalOverlay open={showQuickMenu} onClose={() => setShowQuickMenu(false)}>
        <div className="flex min-h-full items-end justify-center pb-[calc(4.5rem+env(safe-area-inset-bottom))] px-4">
          <div className="w-full max-w-[20rem] animate-in fade-in-0 slide-in-from-bottom-3 duration-300 ease-[var(--ease-out-ios)] rounded-[1.45rem] border border-border/70 bg-card/96 p-2 shadow-[var(--shadow-float)] backdrop-blur-2xl">
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
      </ModalOverlay>

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card hide-on-desktop"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="mx-auto flex h-[4.5rem] max-w-md items-center justify-around px-2">
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
                    "flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-[transform,box-shadow] duration-200 ease-[var(--ease-out-ios)] active:scale-95",
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
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "tap-lift relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 transition-colors",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}
              >
                <Icon className={cn(
                  "relative transition-all duration-200 ease-[var(--ease-out-ios)]",
                  isActive ? "h-5 w-5 scale-110 drop-shadow-sm" : "h-5 w-5"
                )} />
                <span className={cn("relative max-w-full truncate text-[0.625rem] font-semibold")}>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
