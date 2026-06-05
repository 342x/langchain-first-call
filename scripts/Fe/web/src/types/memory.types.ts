// 定义消息类型
export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  metadata?: {
    model?: string;
    tokens?: number;
    sources?: Source[];
  };
}

export interface Source {
  id: string;
  title: string;
  content: string;
  relevance: number;
}

//  ======= 会话类型 =======
export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  context: Record<string, unknown>;
  createdAt: number;
  lastAccessedAt: number;
  synced: boolean; // 是否已同步后端
}

// ===== 用户记忆类型====
export interface UserPreferences {
  theme: "light" | "dark";
  defaultModel: "gpt-4" | "claude" | "deepseek";
  language: string;
  outputStyle: "concise" | "detailed" | "professional";
  reportTemplate?: string;
}

export interface FactMemory {
  id: string;
  key: string;
  value: unknown;
  createdAt: number;
  updatedAt: number;
  source: "user_declared" | "ai_inferred" | "system";
}

export interface SavedQuery {
  id: string;
  name: string;
  query: string;
  tags: string[];
  createdAt: number;
}

// ==================== 长期记忆根结构 ====================
export interface LongTermMemory {
  version: number;
  userId: string;
  preferences: UserPreferences;
  facts: FactMemory[];
  savedQueries: SavedQuery[];
  recentTools: string[]; // 最近使用的工具/技能
}

// ==================== 同步相关 ====================
export interface SyncTask {
  id: number;
  action: "create" | "update" | "delete";
  target: "conversation" | "preference" | "fact" | "query";
  data: unknown;
  timestamp: number;
  retryCount: number;
}
