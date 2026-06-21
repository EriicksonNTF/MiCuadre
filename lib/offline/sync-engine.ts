import { createClient } from "@/lib/supabase/client"
import { offlineDB, OutboxItem } from "./db"
import { createTransaction } from "@/hooks/use-data"
import { mutate } from "swr"
import { EventBus } from "@/lib/event-bus"
import { showToast } from "@/components/toast/smart-toast"

const supabase = createClient()
let isSyncing = false
const MAX_RETRIES = 5

async function processOutboxItem(item: OutboxItem): Promise<boolean> {
  const { operation, payload, idempotency_key } = item

  // Check idempotency for create operations
  if (operation.startsWith("create_")) {
    const entityMap: Record<string, string> = {
      create_account: "accounts",
      create_category: "categories",
      create_goal: "goals",
      create_beneficiary: "beneficiaries",
      create_subscription: "subscriptions",
      create_budget: "budgets",
      create_debt: "debts",
    }
    const table = entityMap[operation]
    if (table) {
      const { data: existing } = await supabase
        .from(table)
        .select("id")
        .eq("user_id", item.user_id || "")
        .eq("metadata->>idempotency_key", idempotency_key)
        .maybeSingle()

      if (existing) {
        console.log(`Duplicate ${operation} found for idempotency key ${idempotency_key}. Skipping.`)
        await offlineDB.delete("offline_outbox", item.id)
        return true
      }
    }
  }

  switch (operation) {
    // ── Transactions ──
    case "create_transaction": {
      await createTransaction(payload, {
        applyCommission: payload.applyCommission,
        skipOutbox: true,
        idempotencyKey: idempotency_key,
      })
      return true
    }

    // ── Accounts ──
    case "create_account": {
      const { id, user_id, created_at, ...rest } = payload
      const { error } = await supabase
        .from("accounts")
        .insert({ ...rest, user_id: item.user_id, metadata: { idempotency_key } })
      if (error) throw error
      return true
    }

    case "update_account": {
      const { id, ...updates } = payload
      // Conflict resolution: check if server version is newer than the local edit
      const { data: serverVersion } = await supabase
        .from("accounts")
        .select("updated_at")
        .eq("id", id)
        .maybeSingle()
      if (serverVersion?.updated_at && updates.updated_at) {
        const serverTime = new Date(serverVersion.updated_at).getTime()
        const localTime = new Date(updates.updated_at).getTime()
        if (serverTime > localTime) {
          console.warn(`[sync-engine] Conflict on account ${id}: server is newer (${serverVersion.updated_at} > ${updates.updated_at}). Skipping local update.`)
          return true // Treat as "synced" — don't retry
        }
      }
      const { error } = await supabase
        .from("accounts")
        .update(updates)
        .eq("id", id)
      if (error) throw error
      return true
    }

    case "delete_account": {
      const { id } = payload
      const { error } = await supabase
        .from("accounts")
        .delete()
        .eq("id", id)
      if (error) throw error
      return true
    }

    // ── Categories ──
    case "create_category": {
      const { id, user_id, created_at, ...rest } = payload
      const { error } = await supabase
        .from("categories")
        .insert({ ...rest, user_id: item.user_id, metadata: { idempotency_key } })
      if (error) throw error
      return true
    }

    case "update_category": {
      const { id, ...updates } = payload
      const { error } = await supabase
        .from("categories")
        .update(updates)
        .eq("id", id)
        .eq("is_default", false)
      if (error) throw error
      return true
    }

    case "delete_category": {
      const { id, force } = payload
      if (!force) {
        const { data: txs } = await supabase
          .from("transactions")
          .select("id")
          .eq("category_id", id)
          .limit(1)
        if (txs && txs.length > 0) {
          throw new Error("Category has associated transactions")
        }
      }
      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", id)
        .eq("is_default", false)
      if (error) throw error
      return true
    }

    // ── Goals ──
    case "create_goal": {
      const { id, user_id, created_at, ...rest } = payload
      const { error } = await supabase
        .from("goals")
        .insert({ ...rest, user_id: item.user_id, current_amount: 0, is_completed: false, metadata: { idempotency_key } })
      if (error) throw error
      return true
    }

    case "update_goal": {
      const { id, ...updates } = payload
      const { error } = await supabase
        .from("goals")
        .update(updates)
        .eq("id", id)
      if (error) throw error
      return true
    }

    case "delete_goal": {
      const { id } = payload
      const { error } = await supabase
        .from("goals")
        .delete()
        .eq("id", id)
      if (error) throw error
      return true
    }

    // ── Beneficiaries ──
    case "create_beneficiary": {
      const { id, user_id, created_at, ...rest } = payload
      const { error } = await supabase
        .from("beneficiaries")
        .insert({ ...rest, user_id: item.user_id, metadata: { idempotency_key } })
      if (error) throw error
      return true
    }

    case "update_beneficiary": {
      const { id, ...updates } = payload
      const { error } = await supabase
        .from("beneficiaries")
        .update(updates)
        .eq("id", id)
      if (error) throw error
      return true
    }

    case "delete_beneficiary": {
      const { id } = payload
      const { error } = await supabase
        .from("beneficiaries")
        .delete()
        .eq("id", id)
      if (error) throw error
      return true
    }

    // ── Subscriptions ──
    case "create_subscription": {
      const { id, user_id, created_at, ...rest } = payload
      const { error } = await supabase
        .from("subscriptions")
        .insert({ ...rest, user_id: item.user_id, metadata: { idempotency_key } })
      if (error) throw error
      return true
    }

    case "update_subscription": {
      const { id, ...updates } = payload
      const { error } = await supabase
        .from("subscriptions")
        .update(updates)
        .eq("id", id)
        .eq("user_id", item.user_id)
      if (error) throw error
      return true
    }

    case "delete_subscription": {
      const { id } = payload
      const { error } = await supabase
        .from("subscriptions")
        .delete()
        .eq("id", id)
      if (error) throw error
      return true
    }

    // ── Notifications ──
    case "mark_notification_read": {
      const { id } = payload
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", id)
        .eq("user_id", item.user_id)
      if (error) throw error
      return true
    }

    case "mark_all_notifications_read": {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", item.user_id)
        .eq("read", false)
      if (error) throw error
      return true
    }

    // ── Budgets ──
    case "create_budget": {
      const { user_id, ...rest } = payload
      const { error } = await supabase
        .from("budgets")
        .insert({ ...rest, user_id: item.user_id, is_active: true, period: "monthly" })
      if (error) throw error
      return true
    }

    case "update_budget": {
      const { id, ...updates } = payload
      const { error } = await supabase
        .from("budgets")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", item.user_id)
      if (error) throw error
      return true
    }

    case "delete_budget": {
      const { id } = payload
      const { error } = await supabase
        .from("budgets")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", item.user_id)
      if (error) throw error
      return true
    }

    // ── Debts ──
    case "create_debt": {
      const { id, user_id, ...rest } = payload
      const { error } = await supabase
        .from("debts")
        .insert({ ...rest, user_id: item.user_id, is_active: true })
      if (error) throw error
      return true
    }

    case "pay_debt": {
      const { debt_id, source_account_id, amount, notes } = payload
      const { error } = await supabase.rpc("pay_debt_safe", {
        p_debt_id: debt_id,
        p_source_account_id: source_account_id,
        p_amount: amount,
        p_notes: notes || null,
      })
      if (error) throw error
      return true
    }

    // ── Transfers ──
    case "create_transfer": {
      const { data: result, error: rpcError } = await supabase.rpc("create_transfer_safe", {
        p_from_account_id: payload.from_account_id,
        p_to_account_id: payload.to_account_id || null,
        p_to_beneficiary_id: payload.to_beneficiary_id || null,
        p_amount: payload.amount,
        p_currency: payload.currency || "DOP",
        p_description: payload.description || null,
        p_apply_commission: Boolean(payload.apply_commission),
        p_exchange_rate: payload.exchange_rate || null,
      })
      if (rpcError) throw new Error(typeof rpcError === 'object' && rpcError !== null ? (rpcError as any).message || `RPC error: ${JSON.stringify(rpcError)}` : String(rpcError))
      return true
    }

    // ── Update/Delete transactions ──
    case "update_transaction": {
      const { id, ...updates } = payload
      const normalizedDate = updates.date ? (typeof updates.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(updates.date) ? updates.date : new Date(updates.date).toISOString().split('T')[0]) : undefined
      const { error } = await supabase.rpc("update_transaction_safe", {
        p_transaction_id: id,
        p_account_id: updates.account_id,
        p_type: updates.type,
        p_amount: Number(updates.amount),
        p_currency: updates.currency,
        p_description: updates.description || null,
        p_date: normalizedDate || null,
        p_category_id: updates.category_id || null,
        p_notes: updates.notes || null,
        p_amount_base: updates.amount_base || null,
        p_exchange_rate: updates.exchange_rate || null,
        p_is_recurring: updates.is_recurring ?? null,
      })
      if (error) throw error
      return true
    }

    case "delete_transaction": {
      const { id } = payload
      const { error } = await supabase.rpc("delete_transaction_safe", {
        p_transaction_id: id,
      })
      if (error) throw error
      return true
    }

    default:
      console.warn(`Unknown operation type: ${operation}. Skipping.`)
      throw new Error(`Unknown operation: ${operation}`)
  }
}

export async function syncPendingOperations() {
  if (isSyncing) return
  isSyncing = true
  try {
    if (typeof window === "undefined" || !navigator.onLine) return

    const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))
    if (!user) return

    const outbox = await offlineDB.getAll<OutboxItem>("offline_outbox")
    const pendingItems = outbox.filter(item => (item.status === "pending" || item.status === "failed") && item.user_id === user.id)
    const orphanItems = outbox.filter(item => !item.user_id && (item.status === "pending" || item.status === "failed"))

    if (orphanItems.length > 0) {
      console.warn(`Found ${orphanItems.length} outbox items without user_id. Moving to sync_errors.`)
      for (const orphan of orphanItems) {
        await offlineDB.put("sync_errors", {
          id: orphan.id,
          operation: orphan.operation,
          payload: orphan.payload,
          error: "Outbox item has no user_id — cannot determine ownership. Skipped.",
          failed_at: new Date().toISOString(),
          permanent: true,
        })
        await offlineDB.delete("offline_outbox", orphan.id)
      }
    }

    if (pendingItems.length === 0) return

    console.log(`Starting sync for ${pendingItems.length} offline operations...`)
    EventBus.emit({ type: "offline_sync_started", payload: { count: pendingItems.length } })

    let successCount = 0
    let failCount = 0

    for (const item of pendingItems) {
      try {
        item.status = "syncing"
        item.last_attempt_at = new Date().toISOString()
        await offlineDB.put("offline_outbox", item)

        await processOutboxItem(item)

        await offlineDB.delete("offline_outbox", item.id)
        successCount++
      } catch (err: any) {
        console.error(`Failed to sync operation ${item.id} (${item.operation}):`, err)
        item.status = "failed"
        item.retry_count += 1
        item.last_error = err.message || "Unknown error"

        if (item.retry_count >= MAX_RETRIES) {
          console.warn(`Operation ${item.id} permanently failed after ${MAX_RETRIES} retries. Moving to sync_errors.`)
          await offlineDB.put("sync_errors", {
            id: item.id,
            operation: item.operation,
            payload: item.payload,
            error: `${item.last_error} (permanent after ${MAX_RETRIES} retries)`,
            failed_at: new Date().toISOString(),
            permanent: true,
          })
          await offlineDB.delete("offline_outbox", item.id)
          continue
        }

        failCount++
        await offlineDB.put("offline_outbox", item)
        await offlineDB.put("sync_errors", {
          id: item.id,
          operation: item.operation,
          payload: item.payload,
          error: item.last_error,
          failed_at: new Date().toISOString(),
        })
      }
    }

    console.log(`Sync completed: ${successCount} succeeded, ${failCount} failed.`)
    mutate("accounts")
    mutate("categories")
    mutate("goals")
    mutate("notifications")
    mutate("beneficiaries")
    mutate("financial_subscriptions")
    mutate((key: any) => Array.isArray(key) && key[0] === "transactions")

    if (successCount > 0 && failCount === 0) {
      showToast({
        title: "Sincronización completada",
        body: successCount === 1
          ? "Se sincronizó 1 operación pendiente."
          : `Se sincronizaron ${successCount} operaciones pendientes.`,
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
  } finally {
    isSyncing = false
  }
}

// Function to register background/foreground event listeners
export function initSyncEngine() {
  if (typeof window === "undefined") return

  // Sync on online connectivity event
  window.addEventListener("online", () => {
    syncPendingOperations()
    // Register background sync when coming back online
    registerBackgroundSync()
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

/**
 * Register a Background Sync event with the Service Worker.
 * This allows the SW to retry pending operations even when the
 * page is closed, as long as the browser supports it.
 */
export async function registerBackgroundSync() {
  if (typeof navigator === "undefined") return
  if (!("serviceWorker" in navigator)) return
  if (!("SyncManager" in window)) return

  try {
    const registration = await navigator.serviceWorker.ready
    await (registration as any).sync.register("micuadre-sync")
  } catch (err) {
    // Background sync registration is best-effort — not critical
    console.warn("[sync-engine] Background sync registration failed:", err)
  }
}
