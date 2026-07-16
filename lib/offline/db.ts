export type EntityType = "transactions" | "accounts" | "categories" | "goals" | "notifications" | "subscriptions" | "beneficiaries" | "budgets" | "debts" | "debt_payments"

export type OutboxOperation =
  | "create_transaction"
  | "update_transaction"
  | "delete_transaction"
  | "create_account"
  | "update_account"
  | "delete_account"
  | "create_category"
  | "update_category"
  | "delete_category"
  | "create_goal"
  | "update_goal"
  | "delete_goal"
  | "add_goal_contribution"
  | "create_transfer"
  | "pay_credit_card"
  | "create_subscription"
  | "update_subscription"
  | "delete_subscription"
  | "create_beneficiary"
  | "update_beneficiary"
  | "delete_beneficiary"
  | "create_budget"
  | "update_budget"
  | "delete_budget"
  | "create_debt"
  | "update_debt"
  | "pay_debt"
  | "mark_notification_read"
  | "mark_all_notifications_read"
  | "update_profile"

export interface OutboxItem {
  id: string;
  user_id?: string;
  operation: OutboxOperation;
  entity: EntityType;
  payload: any;
  status: "pending" | "syncing" | "failed";
  retry_count: number;
  created_at: string;
  last_attempt_at: string | null;
  last_error: string | null;
  idempotency_key: string;
}

const CACHE_STORES = [
  "transactions_cache", "accounts_cache",
  "categories_cache", "goals_cache", "notifications_cache",
  "profile_cache", "subscriptions_cache", "beneficiaries_cache",
  "budgets_cache", "debts_cache", "debt_payments_cache", "calendar_events_cache",
] as const

class OfflineDB {
  private dbName = "micuadre-offline";
  private version = 2;
  private db: IDBDatabase | null = null;

  private isClient(): boolean {
    return typeof window !== "undefined" && typeof indexedDB !== "undefined";
  }

  async getDB(): Promise<IDBDatabase | null> {
    if (!this.isClient()) return null;
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => {
        console.error("Failed to open IndexedDB:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = request.result;

        // Caches for offline reading
        for (const store of CACHE_STORES) {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store, { keyPath: "id" });
          }
        }

        // Outbox queue for offline actions
        if (!db.objectStoreNames.contains("offline_outbox")) {
          db.createObjectStore("offline_outbox", { keyPath: "id" });
        }

        // Log of sync errors
        if (!db.objectStoreNames.contains("sync_errors")) {
          db.createObjectStore("sync_errors", { keyPath: "id" });
        }
      };
    });
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    const db = await this.getDB();
    if (!db) return [];

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readonly");
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async put(storeName: string, value: any): Promise<void> {
    const db = await this.getDB();
    if (!db) return;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);
      const request = store.put(value);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async delete(storeName: string, key: string): Promise<void> {
    const db = await this.getDB();
    if (!db) return;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clearStore(storeName: string): Promise<void> {
    const db = await this.getDB();
    if (!db) return;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clearAllCaches(): Promise<void> {
    const stores = [...CACHE_STORES, "offline_outbox", "sync_errors"];
    await Promise.all(stores.map((store) => this.clearStore(store).catch((err) => console.error(`Failed to clear ${store}:`, err))));
  }
}

export const offlineDB = new OfflineDB();
