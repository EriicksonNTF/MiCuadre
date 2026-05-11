"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Home, Plus, Wallet, Target, Clock, Repeat, ReceiptText } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"

const navItems = [
  { href: "/", icon: Home, label: "Inicio" },
  { href: "/accounts", icon: Wallet, label: "Cuentas" },
  { href: "/expense", icon: Plus, label: "Agregar", isAction: true },
  { href: "/history", icon: Clock, label: "Historial" },
  { href: "/goals", icon: Target, label: "Metas" },
]

const MAIN_ROUTES = new Set(["/", "/dashboard", "/accounts", "/history", "/goals"])

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
  const showBottomNav = MAIN_ROUTES.has(pathname)

  if (isAuthPage || isOnboardingPage || !user || isMobileFormOpen || !showBottomNav) return null

  return (
    <>
      {showQuickMenu && (
        <button
          aria-label="Cerrar menú rápido"
          onClick={() => setShowQuickMenu(false)}
          className="fixed inset-0 z-40 bg-background/35 backdrop-blur-[2px]"
        />
      )}

      {showQuickMenu && (
        <div className="pointer-events-none fixed bottom-24 left-0 right-0 z-50">
          <div className="pointer-events-auto mx-auto w-[min(92vw,20rem)] rounded-2xl border border-border/60 bg-card/95 p-2 shadow-2xl backdrop-blur-xl">
            <button
              onClick={() => {
                setShowQuickMenu(false)
                router.push("/expense")
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-muted"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary"><ReceiptText className="h-4 w-4" /></span>
              <span className="text-sm font-medium text-foreground">Añadir transacción</span>
            </button>
            <button
              onClick={() => {
                setShowQuickMenu(false)
                router.push("/settings/subscriptions?create=1")
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-muted"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"><Repeat className="h-4 w-4" /></span>
              <span className="text-sm font-medium text-foreground">Añadir suscripción</span>
            </button>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-card/95 backdrop-blur-lg">
      <div className="mx-auto flex h-20 max-w-md items-center justify-around px-2 pb-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== "/" && pathname.startsWith(item.href))
          const Icon = item.icon

          if (item.isAction) {
            return (
              <button
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
                className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95"
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
    </>
  )
}
