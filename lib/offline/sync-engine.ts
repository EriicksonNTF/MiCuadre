import { createClient } from "@/lib/supabase/client"
import { offlineDB, OutboxItem } from "./db"
import { createTransaction } from "@/hooks/use-data"
import { mutate } from "swr"
import { EventBus } from "@/lib/event-bus"
import { showToast } from "@/components/toast/smart-toast"

const supabase = createClient()
let isSyncing = false

export async function syncPendingOperations() {
  if (isSyncing) return
  if (typeof window === "undefined" || !navigator.onLine) return

  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))
  if (!user) return

  const outbox = await offlineDB.getAll<OutboxItem>("offline_outbox")
  const pendingItems = outbox.filter(item => (item.status === "pending" || item.status === "failed") && (!item.user_id || item.user_id === user.id))

  if (pendingItems.length === 0) return

  isSyncing = true
  console.log(`Starting sync for ${pendingItems.length} offline operations...`)
  
  EventBus.emit({ type: "offline_sync_started", payload: { count: pendingItems.length } })

  let successCount = 0
  let failCount = 0

  for (const item of pendingItems) {
    try {
      // 1. Mark as syncing
      item.status = "syncing"
      item.last_attempt_at = new Date().toISOString()
      await offlineDB.put("offline_outbox", item)

      // 2. Check for duplicate on server using idempotency key
      const { data: existing, error: checkError } = await supabase
        .from("transactions")
        .select("id")
        .eq("metadata->>idempotency_key", item.idempotency_key)
        .maybeSingle()

      if (checkError) throw checkError

      if (existing) {
        console.log(`Duplicate transaction found for idempotency key ${item.idempotency_key}. Skipping insert.`)
        await offlineDB.delete("offline_outbox", item.id)
        successCount++
        continue
      }

      // 3. Sync to server (bypassing outbox enqueuing)
      await createTransaction(item.payload, {
        applyCommission: item.payload.applyCommission,
        skipOutbox: true,
        idempotencyKey: item.idempotency_key,
      })

      // 4. Remove from outbox on success
      await offlineDB.delete("offline_outbox", item.id)
      successCount++
    } catch (err: any) {
      console.error(`Failed to sync operation ${item.id}:`, err)
      failCount++
      
      // Update item status to failed
      item.status = "failed"
      item.retry_count += 1
      item.last_error = err.message || "Unknown error"
      await offlineDB.put("offline_outbox", item)
      
      // Save error details in sync_errors store
      await offlineDB.put("sync_errors", {
        id: item.id,
        operation: item.operation,
        payload: item.payload,
        error: item.last_error,
        failed_at: new Date().toISOString(),
      })
    }
  }

  isSyncing = false
  console.log(`Sync completed: ${successCount} succeeded, ${failCount} failed.`)

  // Mutate cache to refresh data in UI
  mutate("accounts")
  mutate((key: any) => Array.isArray(key) && key[0] === "transactions")

  // Show result toast
  if (successCount > 0 && failCount === 0) {
    showToast({
      title: "Sincronización completada",
      body: successCount === 1 
        ? "Se sincronizó 1 movimiento pendiente." 
        : `Se sincronizaron ${successCount} movimientos pendientes.`,
      type: "success",
      duration: 3000,
    })
  } else if (failCount > 0) {
    showToast({
      title: "Sincronización parcial",
      body: `${successCount} completados, ${failCount} requieren revisión.`,
      type: "warning",
      duration: 4000,
    })
  }

  EventBus.emit({ type: "offline_sync_completed", payload: { successCount, failCount } })
}

// Function to register background/foreground event listeners
export function initSyncEngine() {
  if (typeof window === "undefined") return

  // Sync on online connectivity event
  window.addEventListener("online", () => {
    syncPendingOperations()
  })

  // Sync on visibility change (visibilitychange / page focus)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      syncPendingOperations()
    }
  })

  window.addEventListener("focus", () => {
    syncPendingOperations()
  })

  // Sync on startup (non-blocking)
  if (navigator.onLine) {
    setTimeout(syncPendingOperations, 2000)
  }
}
