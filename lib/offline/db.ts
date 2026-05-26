export interface OutboxItem {
  id: string; // client-generated local transaction ID
  operation: "create_transaction";
  entity: "transactions";
  payload: any;
  status: "pending" | "syncing" | "failed";
  retry_count: number;
  created_at: string;
  last_attempt_at: string | null;
  last_error: string | null;
  idempotency_key: string;
}

class OfflineDB {
  private dbName = "micuadre-offline";
  private version = 1;
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
        if (!db.objectStoreNames.contains("transactions_cache")) {
          db.createObjectStore("transactions_cache", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("accounts_cache")) {
          db.createObjectStore("accounts_cache", { keyPath: "id" });
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
    const stores = ["transactions_cache", "accounts_cache", "offline_outbox", "sync_errors"];
    await Promise.all(stores.map((store) => this.clearStore(store).catch((err) => console.error(`Failed to clear ${store}:`, err))));
  }
}

export const offlineDB = new OfflineDB();
