import { makeAutoObservable, flow, runInAction, toJS } from 'mobx';
import { LRUCache } from '../modules/LRUCache';
import { IndexedDBManager } from '../modules/IndexedDBManager';

// ==================== 类型定义 ====================

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: {
    model?: string;
    tokens?: number;
    sources?: Array<{ id: string; title: string; content: string; relevance: number }>;
  };
}

// ⚠️ 关键：context 使用普通对象，不是 Map
export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  context: Record<string, unknown>;  // 普通对象，可被 IndexedDB 克隆
  createdAt: number;
  lastAccessedAt: number;
  synced: boolean;
}

export interface UserPreferences {
  theme: 'light' | 'dark';
  defaultModel: 'gpt-4' | 'claude' | 'deepseek';
  language: string;
  outputStyle: 'concise' | 'detailed' | 'professional';
  reportTemplate?: string;
}

export interface FactMemory {
  id: string;
  key: string;
  value: unknown;
  createdAt: number;
  updatedAt: number;
  source: 'user_declared' | 'ai_inferred' | 'system';
}

export interface SavedQuery {
  id: string;
  name: string;
  query: string;
  tags: string[];
  createdAt: number;
}

// ==================== 默认值 ====================

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'light',
  defaultModel: 'gpt-4',
  language: 'zh-CN',
  outputStyle: 'professional',
};

// ==================== MemoryStore ====================

export class MemoryStore {
  // ========== 短期记忆（会话内） ==========
  currentMessages: Message[] = [];
  currentSessionId: string | null = null;
  
  // ⚠️ 内部使用 Map 方便操作，但保存时会转换为普通对象
  private _sessionContext: Map<string, unknown> = new Map();
  
  // 对外暴露的 context 操作（保持 Map 的便利性）
  get sessionContext(): Map<string, unknown> {
    return this._sessionContext;
  }
  
  set sessionContext(value: Map<string, unknown>) {
    this._sessionContext = value;
  }

  // ========== 长期记忆 ==========
  preferences: UserPreferences = DEFAULT_PREFERENCES;
  facts: FactMemory[] = [];
  savedQueries: SavedQuery[] = [];

  // ========== 历史会话 ==========
  recentConversations: Conversation[] = [];

  // ========== UI 状态 ==========
  isLoading: boolean = false;
  error: string | null = null;
  isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;

  // ========== 私有依赖 ==========
  private lruCache: LRUCache<string, Conversation>;
  private db: IndexedDBManager;
  private userId: string;
  private syncInterval: number | null = null;

  constructor(userId: string) {
    makeAutoObservable(this, {
      db: false,
      lruCache: false,
      userId: false,
      syncInterval: false,
      _sessionContext: true,  // 使 Map 可观察
      init: flow,
      loadRecentConversations: flow,
      saveCurrentSession: flow,
      restoreConversation: flow,
      deleteConversation: flow,
      clearAllMemories: flow,
      syncWithServer: flow,
    } as any);

    this.userId = userId;
    this.lruCache = new LRUCache(50, this.handleEviction.bind(this));
    this.db = new IndexedDBManager();

    this.init();

    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline.bind(this));
      window.addEventListener('offline', this.handleOffline.bind(this));
    }

    this.startAutoSync();
  }

  // ========== 辅助方法：Map ↔ Object 转换 ==========
  
  /**
   * 将 Map 转换为普通对象（用于 IndexedDB 存储）
   */
  private contextMapToObject(map: Map<string, unknown>): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    map.forEach((value, key) => {
      // 跳过不可克隆的值
      if (value !== undefined && value !== null && typeof value !== 'function') {
        obj[key] = value;
      }
    });
    return obj;
  }

  /**
   * 将普通对象转换为 Map（用于恢复会话）
   */
  private contextObjectToMap(obj: Record<string, unknown>): Map<string, unknown> {
    const map = new Map<string, unknown>();
    Object.entries(obj).forEach(([key, value]) => {
      map.set(key, value);
    });
    return map;
  }

  // ========== 初始化 ==========

  private *init() {
    runInAction(() => {
      this.isLoading = true;
      this.error = null;
    });

    try {
      yield this.loadLongTermMemory();
      yield this.loadRecentConversations();
      this.startNewSession();
    } catch (error) {
      runInAction(() => {
        this.error = String(error);
      });
      console.error('MemoryStore 初始化失败:', error);
    } finally {
      runInAction(() => {
        this.isLoading = false;
      });
    }
  }

  private async loadLongTermMemory() {
    const saved = await this.db.getLongTermMemory<{
      preferences: UserPreferences;
      facts: FactMemory[];
      savedQueries: SavedQuery[];
    }>(`memory_${this.userId}`);

    if (saved) {
      runInAction(() => {
        this.preferences = saved.preferences;
        this.facts = saved.facts;
        this.savedQueries = saved.savedQueries;
      });
    }
  }

  private async persistLongTermMemory() {
    await this.db.saveLongTermMemory(`memory_${this.userId}`, {
      preferences: toJS(this.preferences),
      facts: toJS(this.facts),
      savedQueries: toJS(this.savedQueries),
    });
  }

  // ========== LRU 淘汰回调 ==========

  private async handleEviction(id: string, conversation: Conversation) {
    console.log(`[LRU] 淘汰会话 ${id}，持久化到 IndexedDB`);
    await this.db.saveConversation(conversation);
  }

  // ========== 短期记忆 API ==========

  startNewSession() {
    this.currentSessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    this.currentMessages = [];
    this._sessionContext.clear();
  }

  addMessage(role: Message['role'], content: string, metadata?: Message['metadata']): Message {
    const newMessage: Message = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      role,
      content,
      timestamp: Date.now(),
      metadata,
    };
    this.currentMessages.push(newMessage);
    return newMessage;
  }

  updateMessage(id: string, content: string) {
    const index = this.currentMessages.findIndex(m => m.id === id);
    if (index !== -1) {
      this.currentMessages[index] = {
        ...this.currentMessages[index],
        content,
      };
    }
  }

  deleteMessage(id: string) {
    this.currentMessages = this.currentMessages.filter(m => m.id !== id);
  }

  clearCurrentSession() {
    this.currentMessages = [];
    this._sessionContext.clear();
  }

  updateSessionContext(key: string, value: unknown) {
    this._sessionContext.set(key, value);
  }

  getSessionContext<T>(key: string): T | undefined {
    return this._sessionContext.get(key) as T | undefined;
  }

  // ========== 长期记忆 - 会话历史 ==========

  *loadRecentConversations(limit: number = 20) {
    const cached = this.lruCache.getRecent(limit);
    if (cached.length >= limit) {
      runInAction(() => {
        this.recentConversations = cached;
      });
      return;
    }

    const all = yield this.db.getAllConversations();
    const existingIds = new Set(cached.map(c => c.id));
    const fromDB = all.filter(c => !existingIds.has(c.id)).slice(0, limit - cached.length);

    runInAction(() => {
      this.recentConversations = [...cached, ...fromDB];
    });
  }

  *saveCurrentSession(title?: string) {
    if (!this.currentSessionId || this.currentMessages.length === 0) {
      return null;
    }

    // ⚠️ 关键修复：将 Map 转换为普通对象
    const contextObject = this.contextMapToObject(this._sessionContext);

    const conversation: Conversation = {
      id: this.currentSessionId,
      title: title || `会话 ${new Date().toLocaleString()}`,
      messages: [...this.currentMessages],
      context: contextObject,  // 使用普通对象，不是 Map
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      synced: false,
    };

    this.lruCache.set(conversation.id, conversation);
    yield this.db.saveConversation(conversation);
    yield this.db.addSyncTask({
      action: 'create',
      target: 'conversation',
      data: conversation,
      timestamp: Date.now(),
      retryCount: 0,
    });
    yield this.loadRecentConversations();
    this.startNewSession();

    return conversation.id;
  }

  *restoreConversation(id: string) {
    let conversation = this.lruCache.get(id);

    if (!conversation) {
      conversation = yield this.db.getConversation(id);
    }

    if (conversation) {
      conversation.lastAccessedAt = Date.now();
      this.lruCache.set(id, conversation);

      // ⚠️ 关键修复：将普通对象转换为 Map
      const contextMap = this.contextObjectToMap(conversation.context || {});

      runInAction(() => {
        this.currentSessionId = conversation.id;
        this.currentMessages = [...conversation.messages];
        this._sessionContext = contextMap;
      });

      return true;
    }
    return false;
  }

  *deleteConversation(id: string) {
    this.lruCache.delete(id);
    yield this.db.deleteConversation(id);
    yield this.db.addSyncTask({
      action: 'delete',
      target: 'conversation',
      data: { id },
      timestamp: Date.now(),
      retryCount: 0,
    });
    yield this.loadRecentConversations();
  }

  // ========== 长期记忆 - 偏好 ==========

  async updatePreferences(prefs: Partial<UserPreferences>) {
    this.preferences = { ...this.preferences, ...prefs };
    await this.persistLongTermMemory();
    await this.db.addSyncTask({
      action: 'update',
      target: 'preference',
      data: toJS(this.preferences),
      timestamp: Date.now(),
      retryCount: 0,
    });
  }

  // ========== 长期记忆 - 事实 ==========

  async addFact(key: string, value: unknown, source: FactMemory['source'] = 'user_declared') {
    // 确保值是可克隆的
    const safeValue = this.makeClonable(value);
    
    const existingIndex = this.facts.findIndex(f => f.key === key);
    const newFact: FactMemory = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      key,
      value: safeValue,
      createdAt: existingIndex >= 0 ? this.facts[existingIndex].createdAt : Date.now(),
      updatedAt: Date.now(),
      source,
    };

    if (existingIndex >= 0) {
      this.facts[existingIndex] = newFact;
    } else {
      this.facts.push(newFact);
    }

    await this.persistLongTermMemory();
    await this.db.addSyncTask({
      action: existingIndex >= 0 ? 'update' : 'create',
      target: 'fact',
      data: newFact,
      timestamp: Date.now(),
      retryCount: 0,
    });
  }

  async updateFact(key: string, value: unknown) {
    await this.addFact(key, value, 'user_declared');
  }

  async deleteFact(key: string) {
    this.facts = this.facts.filter(f => f.key !== key);
    await this.persistLongTermMemory();
    await this.db.addSyncTask({
      action: 'delete',
      target: 'fact',
      data: { key },
      timestamp: Date.now(),
      retryCount: 0,
    });
  }

  getFact<T>(key: string): T | undefined {
    return this.facts.find(f => f.key === key)?.value as T | undefined;
  }

  // ========== 辅助方法：确保值可克隆 ==========
  
  /**
   * 将值转换为 IndexedDB 可克隆的格式
   */
  private makeClonable<T>(value: T): T {
    if (value === null || value === undefined) {
      return value;
    }
    
    if (value instanceof Map) {
      // Map 转换为普通对象
      const obj: Record<string, unknown> = {};
      value.forEach((v, k) => {
        obj[String(k)] = this.makeClonable(v);
      });
      return obj as T;
    }
    
    if (value instanceof Set) {
      // Set 转换为数组
      return Array.from(value) as T;
    }
    
    if (value instanceof Date) {
      // Date 转换为时间戳
      return value.getTime() as T;
    }
    
    if (typeof value === 'function') {
      // 函数不能存储
      return undefined as T;
    }
    
    if (typeof value === 'object') {
      // 递归处理对象
      const result: Record<string, unknown> = {};
      for (const key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          result[key] = this.makeClonable((value as Record<string, unknown>)[key]);
        }
      }
      return result as T;
    }
    
    return value;
  }

  // ========== 长期记忆 - 保存的查询 ==========

  async addSavedQuery(name: string, query: string, tags: string[] = []) {
    const newQuery: SavedQuery = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name,
      query,
      tags,
      createdAt: Date.now(),
    };
    this.savedQueries.push(newQuery);
    await this.persistLongTermMemory();
  }

  async deleteSavedQuery(id: string) {
    this.savedQueries = this.savedQueries.filter(q => q.id !== id);
    await this.persistLongTermMemory();
  }

  // ========== 管理面板 ==========

  getAllMemories() {
    return {
      preferences: this.preferences,
      facts: this.facts,
      savedQueries: this.savedQueries,
      recentTools: [] as string[],
    };
  }

  *clearAllMemories() {
    this.preferences = DEFAULT_PREFERENCES;
    this.facts = [];
    this.savedQueries = [];
    this.lruCache.clear();
    yield this.db.clearSyncQueue();
    yield this.persistLongTermMemory();
    yield this.loadRecentConversations();
  }

  // ========== 同步与网络 ==========

  private startAutoSync() {
    if (typeof window === 'undefined') return;
    
    this.syncInterval = window.setInterval(() => {
      if (this.isOnline) {
        this.syncWithServer();
      }
    }, 30000);
  }

  *syncWithServer() {
    if (!this.isOnline) return;

    const pendingTasks = yield this.db.getPendingSyncTasks();
    if (pendingTasks.length === 0) return;

    console.log(`[Sync] 开始同步 ${pendingTasks.length} 条任务`);

    for (const task of pendingTasks) {
      try {
        yield this.sendToServer(task);
        yield this.db.removeSyncTask(task.id);
      } catch (error) {
        console.error(`[Sync] 同步任务 ${task.id} 失败:`, error);
        if (task.retryCount >= 3) {
          yield this.db.removeSyncTask(task.id);
        } else {
          yield this.db.addSyncTask({
            action: task.action,
            target: task.target,
            data: task.data,
            retryCount: task.retryCount + 1,
            timestamp: Date.now(),
          });
          yield this.db.removeSyncTask(task.id);
        }
      }
    }
  }

  private async sendToServer(task: unknown) {
    await new Promise<void>((resolve) => {
      window.setTimeout(() => resolve(), 120);
    });
    void task;
  }

  private handleOnline() {
    runInAction(() => {
      this.isOnline = true;
    });
    this.syncWithServer();
  }

  private handleOffline() {
    runInAction(() => {
      this.isOnline = false;
    });
  }

  // ========== 清理 ==========
  destroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline.bind(this));
      window.removeEventListener('offline', this.handleOffline.bind(this));
    }
  }
}
