class LRUCache<K, V> {
  private cache: Map<K, V>;
  private readonly maxSize: number;
  private onEvict?: (key: K, value: V) => void; // 淘汰回调（用于持久化到 IndexedDB）
  constructor(maxSize: number, onEvict?: (key: K, value: V) => void) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.onEvict = onEvict;
  }
  // 获取数据（同时更新为最近使用）
  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }

    // 关键：将当前 key 移到末尾（最近使用）
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);

    return value;
  }
  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    // 如果缓存已满，淘汰最久未使用的（第一个 key）
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      const oldestValue = this.cache.get(oldestKey);
      this.cache.delete(oldestKey);
    }
    // 触发淘汰回调，将淘汰的数据持久化到 IndexedDB
    if (this.onEvict && oldestValue !== undefined) {
      this.onEvict(oldestKey, oldestValue);
    }
    // 插入新数据（自动成为最近使用）
    this.cache.set(key, value);
  }
  has(key: K): boolean {
    return this.cache.has(key);
  }
  delete(key: K): boolean {
    return this.cache.delete(key);
  }
  clear(): void {
    this.cache.clear();
  }
  // 获取当前缓存大小
  size(): number {
    return this.cache.size;
  }

  // 获取所有 key（按最近使用顺序）
  keys(): K[] {
    return Array.from(this.cache.keys());
  }

  // 获取所有 value（按最近使用顺序）
  values(): V[] {
    return Array.from(this.cache.values());
  }
}

