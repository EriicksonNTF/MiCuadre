"use client"

import { offlineDB, type OutboxItem, type OutboxOperation, type EntityType } from "./db"
import { mutate } from "swr"

function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true
}

export function generateId(prefix = "local"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
}

export function generateIdempotencyKey(): string {
  return `idem_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
}

export function buildOutboxItem(params: {
  userId: string
  operation: OutboxOperation
  entity: EntityType
  payload: any
}): OutboxItem {
  return {
    id: generateId(),
    user_id: params.userId,
    operation: params.operation,
    entity: params.entity,
    payload: params.payload,
    status: "pending",
    retry_count: 0,
    created_at: new Date().toISOString(),
    last_attempt_at: null,
    last_error: null,
    idempotency_key: generateIdempotencyKey(),
  }
}

export async function tryEnqueueOffline(
  outboxItem: OutboxItem,
  swrKeys: string[]
): Promise<boolean> {
  if (isOnline()) return false

  console.log(`Device is offline. Enqueuing ${outboxItem.operation} to offline outbox.`)
  await offlineDB.put("offline_outbox", outboxItem)
  for (const key of swrKeys) {
    mutate(key)
  }
  return true
}

export async function enqueueOfflineFallback(outboxItem: OutboxItem, swrKeys: string[]): Promise<void> {
  console.log(`Enqueuing fallback for ${outboxItem.operation} to offline outbox.`)
  await offlineDB.put("offline_outbox", outboxItem)
  for (const key of swrKeys) {
    mutate(key)
  }
}

export async function getPendingOutboxCount(): Promise<number> {
  const items = await offlineDB.getAll<OutboxItem>("offline_outbox")
  return items.filter((i) => i.status === "pending" || i.status === "failed").length
}

export function isOfflineError(err: any): boolean {
  if (!err) return false
  if (err.message?.includes("Failed to fetch")) return true
  if (err.message?.includes("NetworkError")) return true
  if (err.code === "NETWORK_ERROR") return true
  if (err.message?.includes("ERR_INTERNET_DISCONNECTED")) return true
  return false
}
