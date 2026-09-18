/**
 * A small in-process LRU cache with per-entry TTL, used to memoize the
 * expensive aggregate queries (pagination totals, facet counts, gallery
 * totals) on top of `unstable_cache` in `src/lib/db/queries.ts`.
 *
 * `unstable_cache` already caches across requests, but it still round-trips
 * through Next.js's cache machinery; this LRU sits in front of it so that a
 * burst of requests within the TTL window resolves entirely in memory.
 *
 * Cached on `globalThis` for the same reason as the connection pool: the
 * Next.js dev server reloads modules on every change, and we want cache
 * state (and hit/miss counters) to survive that.
 */

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  maxEntries: number;
  hitRate: number;
}

export class QueryCache {
  private readonly store = new Map<string, CacheEntry>();
  private hits = 0;
  private misses = 0;

  constructor(private readonly maxEntries: number = 200) {}

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      this.misses++;
      return undefined;
    }
    // Refresh recency for LRU eviction.
    this.store.delete(key);
    this.store.set(key, entry);
    this.hits++;
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) this.store.delete(oldestKey);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  /** Returns the cached value for `key`, or computes and caches it via `fn`. */
  async wrap<T>(key: string, ttlMs: number, fn: () => Promise<T> | T): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) return cached;
    const value = await fn();
    this.set(key, value, ttlMs);
    return value;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
  }

  stats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.store.size,
      maxEntries: this.maxEntries,
      hitRate: total === 0 ? 0 : this.hits / total,
    };
  }
}

const globalForCache = globalThis as unknown as {
  __sgsmQueryCache?: QueryCache;
};

/** Shared singleton cache for aggregate/facet queries. */
export const queryCache: QueryCache =
  globalForCache.__sgsmQueryCache ?? (globalForCache.__sgsmQueryCache = new QueryCache(200));
