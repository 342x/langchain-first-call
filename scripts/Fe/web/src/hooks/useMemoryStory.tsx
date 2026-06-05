import { useMemo } from 'react';
import { MemoryStore } from '../stores/MemoryStore';

// 全局单例（按 userId 缓存）
const storeInstances = new Map<string, MemoryStore>();

export function useMemoryStore(userId: string) {
  const store = useMemo(() => {
    if (!storeInstances.has(userId)) {
      storeInstances.set(userId, new MemoryStore(userId));
    }
    return storeInstances.get(userId)!;
  }, [userId]);

  return store;
}
