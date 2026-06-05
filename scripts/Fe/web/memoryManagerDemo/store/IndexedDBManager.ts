import type { Conversation, LongTermMemory, SyncTask } from "../../types/memory.types";

const DB_NAME = "AIMemoryDB";
const DB_VERSION = 1;

export class IndexedDBManager {
  private db: IDBDatabase | null = null;
  private readyPromise: Promise<void>;

  constructor() {
    this.readyPromise = this.init();
  }
  /** 初始化 */
  private async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onupgradeneeded = (event) => {
        const db = request.result;
        const oldVersion = event.oldVersion;
        // 绘画存储
        if (!db.objectStoreNames.contains("conversations")) {
          const conversationStore = db.createObjectStore("conversations", {
            keyPath: "id",
          });
          conversationStore.createIndex("lastAccessedAt", "lastAccessedAt", {
            unique: false,
          });
          conversationStore.createIndex("createdAt", "createdAt", {
            unique: false,
          });
          conversationStore.createIndex("synced", "synced", { unique: false });
        }
        // 长期记忆存储
        if (!db.objectStoreNames.contains("longTerMemory")) {
          const memoryStore = db.createObjectStore("longTerMemory", {
            keyPath: "key",
          });
          memoryStore.createIndex("updatedAt", "updatedAt");
          // 离线同步队列
          if (!db.objectStoreNames.contains("syncQueue")) {
            const syncStore = db.createObjectStore("syncQueue", {
              keyPath: "id",
              autoIncrement: true,
            });
            syncStore.createIndex("timestamp", "timestamp");
            syncStore.createIndex("retryCount", "retryCount");
          }
          // 对话消息独立存储（针对大数据量进行优化）
          if (!db.objectStoreNames.contains("messages")) {
            const messagesStore = db.createObjectStore("messages", {
              keyPath: "id",
            });
            messagesStore.createIndex("conversationId", "conversationId", {
              unique: false,
            });
            messagesStore.createIndex("timestamp", "timestamp");
          }
        }
      };
    });
  }
  private async getDB(): Promise<IDBDatabase> {
    await this.readyPromise;
    return this.db!;
  }
  // 绘画操作
  async saveConversation(conversation: Conversation): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction(["conversations"], "readwrite");
    const store = tx.objectStore("conversations");
    store.put(conversation);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  // 获取会话信息
  async getConversation(id: string): Promise<Conversation | undefined> {
    const db = await this.getDB();
    const tx = db.transaction(["conversations"], "readonly");
    const store = tx.objectStore("conversations");
    return new Promise((resolve) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(undefined);
    });
  }
  // 删除会话信息
  async deleteConversation(id: string): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction(["conversations"], "readwrite");
    const store = tx.objectStore("conversations");
    store.delete(id);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  // ========== 长期记忆操作 ==========
  async saveLongTerMemory(
    key: string,
    value: unknown,
    updatedAt: number = Date.now(),
  ): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction(["longTerMemory"], "readwrite");
    const store = tx.objectStore("longTerMemory");
    store.put({ key, value, updatedAt });
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  async getLongTermMemory<T>(key: string): Promise<T | undefined> {
    const db = await this.getDB();
    const tx = db.transaction(["longTermMemory"], "readonly");
    const store = tx.objectStore("longTermMemory");
    return new Promise((resolve) => {
      const request = store.get(key);
      request.onsuccess = () => {
        const result = request.result;
        resolve(result?.value as T | undefined);
      };
      request.onerror = () => resolve(undefined);
    });
  }

  async deleteLongTermMemory(key: string): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction(["longTermMemory"], "readwrite");
    const store = tx.objectStore("longTermMemory");
    store.delete(key);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  // ========== 同步队列操作 ==========

  async addSyncTask(task: Omit<SyncTask, "id">): Promise<number> {
    const db = await this.getDB();
    const tx = db.transaction(["syncQueue"], "readwrite");
    const store = tx.objectStore("syncQueue");
    return new Promise((resolve, reject) => {
      const request = store.add({ ...task, retryCount: 0 });
      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => reject(request.error);
    });
  }
  async getPendingSyncTasks(): Promise<SyncTask[]> {
    const db = await this.getDB();
    const tx = db.transaction(["syncQueue"], "readonly");
    const store = tx.objectStore("syncQueue");
    return new Promise((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve([]);
    });
  }
  async removeSyncTask(id: number): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction(["syncQueue"], "readwrite");
    const store = tx.objectStore("syncQueue");
    store.delete(id);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  async clearSyncQueue(): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction(["syncQueue"], "readwrite");
    const store = tx.objectStore("syncQueue");
    store.clear();
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}
