"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { Wifi, WifiOff, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react"
import { offlineDB, OutboxItem } from "@/lib/offline/db"
import { createClient } from "@/lib/supabase/client"
import { syncPendingOperations } from "@/lib/offline/sync-engine"
import { EventBus } from "@/lib/event-bus"
import { cn } from "@/lib/utils"

const supabase = createClient()

const MAIN_ROUTES = new Set(["/", "/dashboard", "/accounts", "/history", "/planning"])

export function OfflineStatusBanner() {
  const pathname = usePathname()
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [failedCount, setFailedCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  const isAuthPage = pathname?.startsWith("/auth")
  const isOnboardingPage = pathname?.startsWith("/onboarding")
  const showBottomNav = MAIN_ROUTES.has(pathname || "")

  // Function to refresh outbox status from IndexedDB
  const refreshOutboxStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))
      const outbox = await offlineDB.getAll<OutboxItem>("offline_outbox")
      
      // Filter outbox items belonging to the current user (with fallback)
      const userOutbox = outbox.filter(item => !user || !item.user_id || item.user_id === user.id)
      
      const pending = userOutbox.filter((item) => item.status === "pending" || item.status === "failed")
      const failed = userOutbox.filter((item) => item.status === "failed")
      setPendingCount(pending.length)
      setFailedCount(failed.length)
    } catch (err) {
      console.error("Failed to load outbox count in banner:", err)
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return

    setIsOnline(navigator.onLine)

    const handleOnline = () => {
      setIsOnline(true)
      refreshOutboxStatus()
    }
    const handleOffline = () => {
      setIsOnline(false)
      refreshOutboxStatus()
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    // Listen to sync events from sync-engine
    const unsubStarted = EventBus.on("offline_sync_started", () => {
      setSyncing(true)
    })

    const unsubCompleted = EventBus.on("offline_sync_completed", (event) => {
      setSyncing(false)
      refreshOutboxStatus()
      
      const successCount = event.payload?.successCount || 0
      const failCount = event.payload?.failCount || 0
      
      if (successCount > 0 && failCount === 0) {
        setShowSuccess(true)
        setTimeout(() => setShowSuccess(false), 4000)
      }
    })

    // Listen to generic transactions/transfers to refresh status count
    const unsubTx = EventBus.on("transaction_created", () => {
      refreshOutboxStatus()
    })

    // Poll periodically in case of background updates
    refreshOutboxStatus()
    const interval = setInterval(refreshOutboxStatus, 3000)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      unsubStarted()
      unsubCompleted()
      unsubTx()
      clearInterval(interval)
    }
  }, [])

  if (isAuthPage || isOnboardingPage) return null

  // Determine visibility and styles
  const hasOutbox = pendingCount > 0
  const showBanner = !isOnline || hasOutbox || syncing || showSuccess

  if (!showBanner) return null

  const handleSyncClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isOnline && !syncing) {
      syncPendingOperations()
    }
  }

  // Position based on bottom nav presence
  const positionClass = showBottomNav 
    ? "bottom-24 md:bottom-24" 
    : "bottom-6"

  // Render success state
  if (showSuccess && isOnline && !syncing && pendingCount === 0) {
    return (
      <div className={cn(
        "fixed left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold shadow-lg backdrop-blur-md transition-all duration-350 animate-in fade-in slide-in-from-bottom-4",
        "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
        positionClass
      )}>
        <CheckCircle2 className="h-4 w-4 animate-bounce text-emerald-600 dark:text-emerald-400" />
        <span>¡Movimientos sincronizados!</span>
      </div>
    )
  }

  return (
    <div className={cn(
      "fixed left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border px-4 py-2.5 text-xs font-semibold shadow-lg backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-4",
      !isOnline 
        ? "border-amber-500/20 bg-amber-500/10 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
        : syncing
          ? "border-blue-500/20 bg-blue-500/10 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300"
          : failedCount > 0
            ? "border-red-500/20 bg-red-500/10 text-red-800 dark:bg-red-500/20 dark:text-red-300"
            : "border-primary/20 bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-foreground",
      positionClass
    )}>
      {/* Icon */}
      {!isOnline ? (
        <WifiOff className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      ) : syncing ? (
        <RefreshCw className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
      ) : failedCount > 0 ? (
        <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
      ) : (
        <Wifi className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
      )}

      {/* Message */}
      <span className="whitespace-nowrap">
        {!isOnline ? (
          pendingCount > 0 
            ? `Modo offline · ${pendingCount} pendiente${pendingCount > 1 ? "s" : ""}`
            : "Estás sin conexión · Modo local"
        ) : syncing ? (
          "Sincronizando con la nube..."
        ) : failedCount > 0 ? (
          `${pendingCount} pendiente${pendingCount > 1 ? "s" : ""} (${failedCount} con error)`
        ) : (
          `${pendingCount} movimiento${pendingCount > 1 ? "s" : ""} por subir`
        )}
      </span>

      {/* Sync trigger button */}
      {isOnline && !syncing && hasOutbox && (
        <button
          onClick={handleSyncClick}
          className={cn(
            "ml-1.5 rounded-lg px-2.5 py-1 text-[10px] uppercase tracking-wide font-extrabold shadow-sm transition active:scale-95",
            failedCount > 0 
              ? "bg-red-500 text-white hover:bg-red-600"
              : "bg-primary text-primary-foreground hover:opacity-90"
          )}
        >
          {failedCount > 0 ? "Reintentar" : "Sincronizar"}
        </button>
      )}
    </div>
  )
}
