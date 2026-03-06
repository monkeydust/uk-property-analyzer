/**
 * Disk persistence layer for in-memory TTL caches.
 *
 * Writes cache contents to /app/data/cache/ (Docker volume) so they survive
 * container restarts. In development, falls back to .cache/ in the project root.
 *
 * Usage:
 *   export const myCache = makePersistentCache<MyType>('my-cache');
 */

import fs from 'fs';
import path from 'path';

// ── Cache directory ──────────────────────────────────────────────────────────

function getCacheDir(): string {
    // In Docker production, /app/data is volume-mounted and survives restarts.
    // In development, use a local .cache directory (gitignored).
    if (process.env.NODE_ENV === 'production') {
        return '/app/data/cache';
    }
    return path.join(process.cwd(), '.cache');
}

function ensureCacheDir(dir: string): void {
    try {
        fs.mkdirSync(dir, { recursive: true });
    } catch {
        // Already exists or permission error — fail silently
    }
}

// ── Serialisable cache shape ─────────────────────────────────────────────────

interface SerializedEntry<T> {
    value: T;
    expiresAt: number;
}

type SerializedCache<T> = Record<string, SerializedEntry<T>>;

// ── Simple TTL cache with disk persistence ───────────────────────────────────

export class PersistentTTLCache<T> {
    private store = new Map<string, { value: T; expiresAt: number }>();
    private readonly filePath: string;
    private debounceTimer: ReturnType<typeof setTimeout> | null = null;
    private readonly DEBOUNCE_MS = 200;

    constructor(filename: string) {
        const dir = getCacheDir();
        this.filePath = path.join(dir, `${filename}.json`);
        this.loadFromDisk();
    }

    // ── Public API (mirrors TTLCache) ──────────────────────────────────────────

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
        this.schedulePersist();
    }

    has(key: string): boolean {
        return this.get(key) !== null;
    }

    delete(key: string): void {
        this.store.delete(key);
        this.schedulePersist();
    }

    deleteMatching(substring: string): number {
        let count = 0;
        for (const key of this.store.keys()) {
            if (key.includes(substring)) {
                this.store.delete(key);
                count++;
            }
        }
        if (count > 0) this.schedulePersist();
        return count;
    }

    clear(): void {
        this.store.clear();
        this.schedulePersist();
    }

    // ── Disk I/O ───────────────────────────────────────────────────────────────

    private loadFromDisk(): void {
        try {
            const raw = fs.readFileSync(this.filePath, 'utf-8');
            const parsed = JSON.parse(raw) as SerializedCache<T>;
            const now = Date.now();
            let loaded = 0;
            for (const [key, entry] of Object.entries(parsed)) {
                if (entry.expiresAt > now) {
                    this.store.set(key, entry);
                    loaded++;
                }
            }
            if (loaded > 0) {
                console.log(`[cache-persist] Loaded ${loaded} entries from ${path.basename(this.filePath)}`);
            }
        } catch {
            // File doesn't exist yet — normal on first run
        }
    }

    private schedulePersist(): void {
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => this.writeToDisk(), this.DEBOUNCE_MS);
    }

    private writeToDisk(): void {
        try {
            ensureCacheDir(path.dirname(this.filePath));
            const obj: SerializedCache<T> = {};
            for (const [key, entry] of this.store.entries()) {
                obj[key] = entry;
            }
            fs.writeFileSync(this.filePath, JSON.stringify(obj), 'utf-8');
        } catch (err) {
            // Non-fatal — in-memory cache still works
            console.warn('[cache-persist] Failed to write cache to disk:', err);
        }
    }
}
