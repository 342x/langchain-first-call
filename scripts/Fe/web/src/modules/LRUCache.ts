/**
 * LRU 缓存 - 基于 Map 实现
 * @template K 键类型
 * @template V 值类型
 */

export class LRUCache<K, V> {
  private cache: Map<K, V>;
  private readonly maxSize: number;
  private onEvict?: (key: K, value: V) => void;
  constructor(maxSize: number, onEvict?: (key: K, value: V) => void) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.onEvict = onEvict;
  }
  /**
   * 获取值，同时将该 key 标记为最近使用
   */
  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }
    const value = this.cache.get(key)!;
    // 删除后重新插入，使其移动到末尾（最近使用位置）
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }
  /** 设置值，并检测是否有需要删除淘汰的 */
  set(key: K, value: V): void {
    // 如果已存在，先删除（后续会重新插入到末尾）
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // 检查是否需要淘汰
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      const oldestValue = this.cache.get(oldestKey);
      this.cache.delete(oldestKey);

      if (this.onEvict && oldestValue !== undefined) {
        this.onEvict(oldestKey, oldestValue);
      }
    }

    // 插入新值（自动成为最近使用）
    this.cache.set(key, value);
  }
  /**检查是否存在*/
  has(key: K): boolean {
    return this.cache.has(key);
  }
  /** 删除指定 key*/
  delete(key: K): boolean {
    return this.cache.delete(key);
  }
  /**清空所有*/
  clear(): void {
    this.cache.clear();
  }
  /** 获取当前缓存大小 */
  size(): number {
    return this.cache.size;
  }
  /** 获取所有值*/
  values(): V[] {
    return Array.from(this.cache.values());
  }

  /** 获取所有键*/
  keys(): K[] {
    return Array.from(this.cache.keys());
  }
  /** 获取最近使用的 N 个值*/
  getRecent(n: number): V[] {
    const allValues = Array.from(this.cache.values());
    return allValues.slice(-n).reverse();
  }
}
