// modules/MemoryManager.ts

import { LRUCache } from './LRUCache';
import { IndexedDBManager } from './IndexedDBManager';
import type {
  Conversation,
  Message,
  LongTermMemory,
  UserPreferences,
  FactMemory,
  SavedQuery,
  SyncTask,
} from '../../types/memory.types';

// 默认用户偏好
const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'light',
  defaultModel: 'gpt-4',
  language: 'zh-CN',
  outputStyle: 'professional',
};

// 默认长期记忆结构
const DEFAULT_LONG_TERM_MEMORY: Omit<LongTermMemory, 'userId'> = {
  version: 1,
  preferences: DEFAULT_PREFERENCES,
  facts: [],
  savedQueries: [],
  recentTools: [],
};

/**
 * Memory 管理器
 * 整合：短期记忆、长期记忆、LRU缓存、IndexedDB、离线同步
 */
export class MemoryManager {
  private static instance: MemoryManager;

  // ========== 短期记忆（会话内） ==========
  private sessionMessages: Message[] = [];
  private sessionContext: Map<string, unknown> = new Map();
  private currentSessionId: string | null = null;

  // ========== 长期记忆（LRU + IndexedDB） ==========
  private lruCache: LRUCache<string, Conversation>;
  private db: IndexedDBManager;
  private longTermMemory: LongTermMemory | null = null;

  // ========== 状态管理 ==========
  private userId: string;
  private listeners: Set<(event: MemoryEvent) => void> = new Set();
  private syncInterval: number | null = null;

  // LRU 配置：最多缓存 50 条会话在内存
  private readonly LRU_MAX_SIZE = 50;

  private constructor(userId: string) {
    this.userId = userId;
    this.lruCache = new LRUCache(this.LRU_MAX_SIZE, this.handleEviction.bind(this));
    this.db = new IndexedDBManager();

    // 初始化长期记忆
    this.initLongTermMemory();

    // 启动自动同步（默认每30秒）
    this.startAutoSync();

    // 监听网络恢复
    window.addEventListener('online', this.handleOnline.bind(this));
  }

  static getInstance(userId: string): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager(userId);
    }
    return MemoryManager.instance;
  }

  // ========== 初始化 ==========
  private async initLongTermMemory(): Promise<void> {
    const saved = await this.db.getLongTermMemory<LongTermMemory>(`memory_${this.userId}`);
    if (saved) {
      this.longTermMemory = saved;
    } else {
      this.longTermMemory = {
        userId: this.userId,
        ...DEFAULT_LONG_TERM_MEMORY,
      };
      await this.persistLongTermMemory();
    }
  }

  private async persistLongTermMemory(): Promise<void> {
    if (this.longTermMemory) {
      await this.db.saveLongTermMemory(`memory_${this.userId}`, this.longTermMemory);
    }
  }

  // ========== 淘汰回调（LRU 删除时需要持久化到 IndexedDB进行存储） ==========
  private async handleEviction(id: string, conversation: Conversation): Promise<void> {
    console.log(`[LRU] 淘汰会话 ${id}，持久化到 IndexedDB`);
    await this.db.saveConversation(conversation);
  }

  // ========== 短期记忆 API ==========

  /**
   * 开始新会话
   */
  startNewSession(): string {
    const sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    this.currentSessionId = sessionId;
    this.sessionMessages = [];
    this.sessionContext.clear();
    this.emit({ type: 'session_changed', data: { sessionId } });
    return sessionId;
  }

  /**
   * 获取当前会话消息
   */
  getCurrentMessages(): Message[] {
    return [...this.sessionMessages];
  }

  /**
   * 添加消息到当前会话
   */
  addMessage(message: Omit<Message, 'id' | 'timestamp'>): Message {
    const newMessage: Message = {
      ...message,
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
    };
    this.sessionMessages.push(newMessage);
    this.emit({ type: 'message_added', data: { message: newMessage } });
    return newMessage;
  }

  /**
   * 更新会话上下文
   */
  updateSessionContext(key: string, value: unknown): void {
    this.sessionContext.set(key, value);
    this.emit({ type: 'context_updated', data: { key, value } });
  }

  /**
   * 获取会话上下文
   */
  getSessionContext<T>(key: string): T | undefined {
    return this.sessionContext.get(key) as T | undefined;
  }

  /**
   * 清空当前会话
   */
  clearCurrentSession(): void {
    this.sessionMessages = [];
    this.sessionContext.clear();
    this.emit({ type: 'session_cleared', data: null });
  }

  /**
   * 保存当前会话到长期记忆
   */
  async saveCurrentSession(title?: string): Promise<string> {
    if (!this.currentSessionId || this.sessionMessages.length === 0) {
      return this.startNewSession();
    }

    const conversation: Conversation = {
      id: this.currentSessionId,
      title: title || `会话 ${new Date().toLocaleString()}`,
      messages: [...this.sessionMessages],
      context: Object.fromEntries(this.sessionContext),
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      synced: false,
    };

    // 写入 LRU 缓存（自动处理淘汰）
    this.lruCache.set(conversation.id, conversation);

    // 添加到同步队列
    await this.db.addSyncTask({
      action: 'create',
      target: 'conversation',
      data: conversation,
      timestamp: Date.now(),
      retryCount: 0,
    });

    // 立即尝试同步
    this.syncWithServer();

    this.emit({ type: 'conversation_saved', data: { conversationId: conversation.id } });

    // 开始新会话
    return this.startNewSession();
  }

  // ========== 长期记忆 API（会话历史） ==========

  /**
   * 加载历史会话
   */
  async loadConversation(id: string): Promise<Conversation | null> {
    // 先查 LRU 缓存
    let conversation = this.lruCache.get(id);

    if (conversation) {
      // 更新访问时间
      conversation.lastAccessedAt = Date.now();
      this.lruCache.set(id, conversation);
      return conversation;
    }

    // 缓存未命中，从 IndexedDB 加载
    conversation = await this.db.getConversation(id);
    if (conversation) {
      conversation.lastAccessedAt = Date.now();
      this.lruCache.set(id, conversation);
    }

    return conversation || null;
  }

  /**
   * 恢复会话到当前活跃状态
   */
  async restoreConversation(id: string): Promise<boolean> {
    const conversation = await this.loadConversation(id);
    if (!conversation) return false;

    this.currentSessionId = conversation.id;
    this.sessionMessages = [...conversation.messages];
    this.sessionContext = new Map(Object.entries(conversation.context));

    this.emit({ type: 'session_restored', data: { conversationId: id } });
    return true;
  }

  /**
   * 获取最近的历史会话列表
   */
  async getRecentConversations(limit: number = 20): Promise<Conversation[]> {
    // 先从 LRU 缓存获取（最近使用的）
    const cached = this.lruCache.getRecent(limit);

    if (cached.length >= limit) {
      return cached;
    }

    // 缓存不够，从 IndexedDB 补充
    const all = await this.db.getAllConversations();
    const existingIds = new Set(cached.map(c => c.id));
    const fromDB = all.filter(c => !existingIds.has(c.id)).slice(0, limit - cached.length);

    return [...cached, ...fromDB];
  }

  /**
   * 删除历史会话
   */
  async deleteConversation(id: string): Promise<void> {
    this.lruCache.delete(id);
    await this.db.deleteConversation(id);
    await this.db.addSyncTask({
      action: 'delete',
      target: 'conversation',
      data: { id },
      timestamp: Date.now(),
      retryCount: 0,
    });
    this.emit({ type: 'conversation_deleted', data: { conversationId: id } });
  }

  // ========== 长期记忆 API（用户偏好/事实） ==========

  /**
   * 获取用户偏好
   */
  getPreferences(): UserPreferences {
    return this.longTermMemory?.preferences || DEFAULT_PREFERENCES;
  }

  /**
   * 更新用户偏好
   */
  async updatePreferences(preferences: Partial<UserPreferences>): Promise<void> {
    if (!this.longTermMemory) return;
    this.longTermMemory.preferences = { ...this.longTermMemory.preferences, ...preferences };
    await this.persistLongTermMemory();
    await this.db.addSyncTask({
      action: 'update',
      target: 'preference',
      data: this.longTermMemory.preferences,
      timestamp: Date.now(),
      retryCount: 0,
    });
    this.emit({ type: 'preferences_updated', data: preferences });
  }

  /**
   * 添加事实记忆
   */
  async addFact(key: string, value: unknown, source: FactMemory['source'] = 'user_declared'): Promise<void> {
    if (!this.longTermMemory) return;

    const existingIndex = this.longTermMemory.facts.findIndex(f => f.key === key);
    const newFact: FactMemory = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      key,
      value,
      createdAt: existingIndex >= 0 ? this.longTermMemory.facts[existingIndex].createdAt : Date.now(),
      updatedAt: Date.now(),
      source,
    };

    if (existingIndex >= 0) {
      this.longTermMemory.facts[existingIndex] = newFact;
    } else {
      this.longTermMemory.facts.push(newFact);
    }

    await this.persistLongTermMemory();
    await this.db.addSyncTask({
      action: existingIndex >= 0 ? 'update' : 'create',
      target: 'fact',
      data: newFact,
      timestamp: Date.now(),
      retryCount: 0,
    });
    this.emit({ type: 'fact_added', data: { key, value } });
  }

  /**
   * 获取所有事实记忆（用于记忆管理面板）
   */
  getAllFacts(): FactMemory[] {
    return this.longTermMemory?.facts || [];
  }

  /**
   * 删除事实记忆
   */
  async deleteFact(key: string): Promise<void> {
    if (!this.longTermMemory) return;
    this.longTermMemory.facts = this.longTermMemory.facts.filter(f => f.key !== key);
    await this.persistLongTermMemory();
    await this.db.addSyncTask({
      action: 'delete',
      target: 'fact',
      data: { key },
      timestamp: Date.now(),
      retryCount: 0,
    });
    this.emit({ type: 'fact_deleted', data: { key } });
  }

  /**
   * 获取事实值
   */
  getFact<T>(key: string): T | undefined {
    return this.longTermMemory?.facts.find(f => f.key === key)?.value as T | undefined;
  }

  /**
   * 获取所有记忆（用于管理面板）
   */
  getAllMemories(): {
    preferences: UserPreferences;
    facts: FactMemory[];
    savedQueries: SavedQuery[];
    recentTools: string[];
  } {
    return {
      preferences: this.getPreferences(),
      facts: this.getAllFacts(),
      savedQueries: this.longTermMemory?.savedQueries || [],
      recentTools: this.longTermMemory?.recentTools || [],
    };
  }

  /**
   * 清空所有记忆
   */
  async clearAllMemories(): Promise<void> {
    if (!this.longTermMemory) return;
    this.longTermMemory.preferences = { ...DEFAULT_PREFERENCES };
    this.longTermMemory.facts = [];
    this.longTermMemory.savedQueries = [];
    this.longTermMemory.recentTools = [];
    await this.persistLongTermMemory();
    await this.db.clearSyncQueue();
    this.emit({ type: 'all_memories_cleared', data: null });
  }

  // ========== 同步与网络 ==========

  private async syncWithServer(): Promise<void> {
    if (!navigator.onLine) {
      console.log('[Sync] 离线状态，等待网络恢复');
      return;
    }

    const pendingTasks = await this.db.getPendingSyncTasks();
    if (pendingTasks.length === 0) return;

    console.log(`[Sync] 开始同步 ${pendingTasks.length} 条任务`);

    for (const task of pendingTasks) {
      try {
        await this.sendToServer(task);
        await this.db.removeSyncTask(task.id);
      } catch (error) {
        console.error(`[Sync] 同步任务 ${task.id} 失败:`, error);
        // 重试次数超过3次则丢弃
        if (task.retryCount >= 3) {
          await this.db.removeSyncTask(task.id);
        } else {
          // 增加重试次数后重新入队
          await this.db.addSyncTask({
            ...task,
            retryCount: task.retryCount + 1,
            timestamp: Date.now(),
          });
          await this.db.removeSyncTask(task.id);
        }
      }
    }
  }

  private async sendToServer(task: SyncTask): Promise<void> {
    // 实际项目中替换为真实 API
    const response = await fetch('/api/memory/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: this.userId,
        action: task.action,
        target: task.target,
        data: task.data,
      }),
    });

    if (!response.ok) {
      throw new Error(`Sync failed: ${response.status}`);
    }
  }

  private startAutoSync(): void {
    this.syncInterval = window.setInterval(() => {
      this.syncWithServer();
    }, 30000); // 每30秒同步一次
  }

  private async handleOnline(): Promise<void> {
    console.log('[Sync] 网络已恢复，开始同步');
    await this.syncWithServer();
  }

  // ========== 事件系统 ==========

  on(event: MemoryEventType, callback: (event: MemoryEvent) => void): () => void {
    const wrapped = (event: MemoryEvent) => {
      if (event.type === event) {
        callback(event);
      }
    };
    this.listeners.add(wrapped);
    return () => this.listeners.delete(wrapped);
  }

  private emit(event: MemoryEvent): void {
    this.listeners.forEach(listener => listener(event));
  }

  // ========== 清理 ==========
  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    window.removeEventListener('online', this.handleOnline.bind(this));
  }
}

type MemoryEventType =
  | 'session_changed'
  | 'session_cleared'
  | 'session_restored'
  | 'conversation_saved'
  | 'conversation_deleted'
  | 'message_added'
  | 'context_updated'
  | 'preferences_updated'
  | 'fact_added'
  | 'fact_deleted'
  | 'all_memories_cleared';

interface MemoryEvent {
  type: MemoryEventType;
  data: unknown;
}
