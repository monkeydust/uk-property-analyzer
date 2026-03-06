/**
 * TTL caches — in-memory for speed with optional disk persistence.
 *
 * marketDataCache and plotSizeCache are persisted to /app/data/cache/ (Docker
 * volume) so they survive container restarts. Other caches stay in-memory.
 */
import { PersistentTTLCache } from '@/lib/cache-persist';

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

  delete(key: string): void {
    this.store.delete(key);
  }

  /** Delete all entries whose key contains the given substring */
  deleteMatching(substring: string): number {
    let count = 0;
    for (const key of this.store.keys()) {
      if (key.includes(substring)) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  clear(): void {
    this.store.clear();
  }
}

// One cache instance per data type — TTLs chosen to balance freshness vs cost
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const propertyCache = new TTLCache<any>();   // 24h — Rightmove listings rarely change intraday
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const schoolsCache = new TTLCache<any>();   // 7 days — school data is static per academic year
export const aiCache = new TTLCache<string>();   // 24h — AI reports are expensive; same property = same report
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const plotSizeCache = new PersistentTTLCache<any>('plot-size');   // 30 days — persisted across restarts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const marketDataCache = new PersistentTTLCache<any>('market-data'); // 7 days — persisted across restarts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const stationsCache = new TTLCache<any>();   // 7 days — station proximity is static
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const commuteCache = new TTLCache<any>();    // 7 days — commute times are stable

export const TTL = {
  PROPERTY: 60 * 60 * 24,       // 24 hours
  SCHOOLS: 60 * 60 * 24 * 7,   // 7 days
  AI: 60 * 60 * 24,       // 24 hours
  PLOT_SIZE: 60 * 60 * 24 * 30, // 30 days
  MARKET_DATA: 60 * 60 * 24 * 7, // 7 days
  STATIONS: 60 * 60 * 24 * 7,   // 7 days
  COMMUTE: 60 * 60 * 24 * 7,   // 7 days
};
