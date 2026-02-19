/**
 * Simple in-memory TTL cache.
 * Module-level singleton — survives multiple requests within a server instance.
 * Resets on cold start (acceptable trade-off; no external dependencies needed).
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class TTLCache<T> {
  private store = new Map<string, CacheEntry<T>>();

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlSeconds: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }
}

// One cache instance per data type — TTLs chosen to balance freshness vs cost
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const propertyCache = new TTLCache<any>();   // 24h — Rightmove listings rarely change intraday
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const schoolsCache  = new TTLCache<any>();   // 7 days — school data is static per academic year
export const aiCache       = new TTLCache<string>();   // 24h — AI reports are expensive; same property = same report

export const TTL = {
  PROPERTY: 60 * 60 * 24,       // 24 hours
  SCHOOLS:  60 * 60 * 24 * 7,   // 7 days
  AI:       60 * 60 * 24,       // 24 hours
};
