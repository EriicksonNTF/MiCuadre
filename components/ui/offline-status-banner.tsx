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

export function OfflineStatusBanner() {
  const pathname = usePathname()
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [failedCount, setFailedCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  const isAuthPage = pathname?.startsWith("/auth")
  const isOnboardingPage = pathname?.startsWith("/onboarding")

  const refreshOutboxStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))
      const outbox = await offlineDB.getAll<OutboxItem>("offline_outbox")
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

    const unsubTx = EventBus.on("transaction_created", () => {
      refreshOutboxStatus()
    })

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

  if (showSuccess && isOnline && !syncing && pendingCount === 0) {
    return (
      <div className={cn(
        "sticky top-0 left-0 right-0 z-50 flex items-center justify-center gap-2",
        "h-9 px-4 text-xs font-semibold",
        "border-b border-emerald-500/20 bg-emerald-500/10 text-emerald-700",
        "dark:bg-emerald-500/20 dark:text-emerald-300",
        "animate-in fade-in slide-in-from-top-1 duration-300",
      )}>
        <CheckCircle2 className="h-3.5 w-3.5" />
        <span>Movimientos sincronizados</span>
      </div>
    )
  }

  return (
    <div className={cn(
      "sticky top-0 left-0 right-0 z-50 flex items-center justify-between",
      "h-9 px-4 text-xs font-semibold border-b backdrop-blur-md",
      !isOnline
        ? "border-amber-500/20 bg-amber-500/10 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
        : syncing
          ? "border-blue-500/20 bg-blue-500/10 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300"
          : failedCount > 0
            ? "border-red-500/20 bg-red-500/10 text-red-800 dark:bg-red-500/20 dark:text-red-300"
            : "border-primary/20 bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-foreground",
      "animate-in fade-in slide-in-from-top-1 duration-300"
    )}>
      <div className="flex items-center gap-2 min-w-0">
        {!isOnline ? (
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
        ) : syncing ? (
          <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin" />
        ) : failedCount > 0 ? (
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <Wifi className="h-3.5 w-3.5 shrink-0" />
        )}

        <span className="truncate">
          {!isOnline ? (
            pendingCount > 0
              ? `Sin conexión · ${pendingCount} pendiente${pendingCount > 1 ? "s" : ""}`
              : "Estás sin conexión · Modo local"
          ) : syncing ? (
            "Sincronizando con la nube..."
          ) : failedCount > 0 ? (
            `${pendingCount} pendiente${pendingCount > 1 ? "s" : ""} (${failedCount} con error)`
          ) : (
            `${pendingCount} movimiento${pendingCount > 1 ? "s" : ""} por subir`
          )}
        </span>
      </div>

      {isOnline && !syncing && hasOutbox && (
        <button type="button"
          onClick={handleSyncClick}
          className={cn(
            "ml-2 shrink-0 rounded-md px-2 py-0.5 text-xs uppercase tracking-wide font-extrabold shadow-xs transition active:scale-95",
            failedCount > 0
              ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              : "bg-primary text-primary-foreground hover:opacity-90"
          )}
        >
          {failedCount > 0 ? "Reintentar" : "Sincronizar"}
        </button>
      )}
    </div>
  )
}
