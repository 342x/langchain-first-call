
const DB_NAME = 'AIMemoryDB';
const DB_VERSION = 1;

export class IndexedDBManager {
  private db: IDBDatabase | null = null;
  private readyPromise: Promise<void>;

  constructor() {
    this.readyPromise = this.init();
  }

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

        // 会话存储
        if (!db.objectStoreNames.contains('conversations')) {
          const conversationStore = db.createObjectStore('conversations', { keyPath: 'id' });
          conversationStore.createIndex('lastAccessedAt', 'lastAccessedAt', { unique: false });
          conversationStore.createIndex('createdAt', 'createdAt', { unique: false });
          conversationStore.createIndex('synced', 'synced', { unique: false });
        }

        // 长期记忆存储
        if (!db.objectStoreNames.contains('longTermMemory')) {
          const memoryStore = db.createObjectStore('longTermMemory', { keyPath: 'key' });
          memoryStore.createIndex('updatedAt', 'updatedAt');
        }

        // 离线同步队列
        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
          syncStore.createIndex('timestamp', 'timestamp');
          syncStore.createIndex('retryCount', 'retryCount');
        }

        // V2 新增：独立消息存储（大数据量优化）
        if (oldVersion < 2 && !db.objectStoreNames.contains('messages')) {
          const messagesStore = db.createObjectStore('messages', { keyPath: 'id' });
          messagesStore.createIndex('conversationId', 'conversationId', { unique: false });
          messagesStore.createIndex('timestamp', 'timestamp');
        }
      };
    });
  }

  private async getDB(): Promise<IDBDatabase> {
    await this.readyPromise;
    return this.db!;
  }

  // ========== 会话操作 ==========

  async saveConversation(conversation: Conversation): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction(['conversations'], 'readwrite');
    const store = tx.objectStore('conversations');
    store.put(conversation);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    const db = await this.getDB();
    const tx = db.transaction(['conversations'], 'readonly');
    const store = tx.objectStore('conversations');
    return new Promise((resolve) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(undefined);
    });
  }

  async getAllConversations(): Promise<Conversation[]> {
    const db = await this.getDB();
    const tx = db.transaction(['conversations'], 'readonly');
    const store = tx.objectStore('conversations');
    const index = store.index('lastAccessedAt');
    return new Promise((resolve) => {
      const request = index.openCursor(null, 'prev');
      const results: Conversation[] = [];
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      request.onerror = () => resolve([]);
    });
  }

  async deleteConversation(id: string): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction(['conversations'], 'readwrite');
    const store = tx.objectStore('conversations');
    store.delete(id);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async batchSaveConversations(conversations: Conversation[]): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction(['conversations'], 'readwrite');
    const store = tx.objectStore('conversations');
    for (const conv of conversations) {
      store.put(conv);
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // ========== 长期记忆操作 ==========

  async saveLongTermMemory(key: string, value: unknown, updatedAt: number = Date.now()): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction(['longTermMemory'], 'readwrite');
    const store = tx.objectStore('longTermMemory');
    store.put({ key, value, updatedAt });
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getLongTermMemory<T>(key: string): Promise<T | undefined> {
    const db = await this.getDB();
    const tx = db.transaction(['longTermMemory'], 'readonly');
    const store = tx.objectStore('longTermMemory');
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
    const tx = db.transaction(['longTermMemory'], 'readwrite');
    const store = tx.objectStore('longTermMemory');
    store.delete(key);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllLongTermMemories(): Promise<Array<{ key: string; value: unknown; updatedAt: number }>> {
    const db = await this.getDB();
    const tx = db.transaction(['longTermMemory'], 'readonly');
    const store = tx.objectStore('longTermMemory');
    return new Promise((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve([]);
    });
  }

  // ========== 同步队列操作 ==========

  async addSyncTask(task: Omit<SyncTask, 'id'>): Promise<number> {
    const db = await this.getDB();
    const tx = db.transaction(['syncQueue'], 'readwrite');
    const store = tx.objectStore('syncQueue');
    return new Promise((resolve, reject) => {
      const request = store.add({ ...task, retryCount: task.retryCount ?? 0 });
      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => reject(request.error);
    });
  }

  async getPendingSyncTasks(): Promise<SyncTask[]> {
    const db = await this.getDB();
    const tx = db.transaction(['syncQueue'], 'readonly');
    const store = tx.objectStore('syncQueue');
    return new Promise((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve([]);
    });
  }

  async removeSyncTask(id: number): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction(['syncQueue'], 'readwrite');
    const store = tx.objectStore('syncQueue');
    store.delete(id);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clearSyncQueue(): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction(['syncQueue'], 'readwrite');
    const store = tx.objectStore('syncQueue');
    store.clear();
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getSyncQueueCount(): Promise<number> {
    const db = await this.getDB();
    const tx = db.transaction(['syncQueue'], 'readonly');
    const store = tx.objectStore('syncQueue');
    return new Promise((resolve) => {
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(0);
    });
  }

  // ========== 消息独立操作（大数据量优化） ==========

  async saveMessage(conversationId: string, message: Message): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction(['messages'], 'readwrite');
    const store = tx.objectStore('messages');
    store.put({ ...message, conversationId });
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getMessages(conversationId: string, limit?: number): Promise<Message[]> {
    const db = await this.getDB();
    const tx = db.transaction(['messages'], 'readonly');
    const store = tx.objectStore('messages');
    const index = store.index('conversationId');
    return new Promise((resolve) => {
      const request = index.openCursor(IDBKeyRange.only(conversationId));
      const results: Message[] = [];
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor && (!limit || results.length < limit)) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      request.onerror = () => resolve([]);
    });
  }

  async deleteMessages(conversationId: string): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction(['messages'], 'readwrite');
    const store = tx.objectStore('messages');
    const index = store.index('conversationId');
    return new Promise((resolve, reject) => {
      const request = index.openCursor(IDBKeyRange.only(conversationId));
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
}

// 类型定义（与 MemoryStore 保持一致）
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  context: Record<string, unknown>;
  createdAt: number;
  lastAccessedAt: number;
  synced: boolean;
}

interface SyncTask {
  id: number;
  action: 'create' | 'update' | 'delete';
  target: 'conversation' | 'preference' | 'fact' | 'query';
  data: unknown;
  timestamp: number;
  retryCount: number;
}
