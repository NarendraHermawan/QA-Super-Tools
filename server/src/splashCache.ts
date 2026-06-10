import { config } from './config.js';
import type { GridRow } from './parsing/weekModel.js';
import type { SplashRecord } from './types.js';

interface SplashCacheEntry {
  fetchedAt: number;
  grid: GridRow[];
  records: SplashRecord[];
}

let cache: SplashCacheEntry | null = null;

export function getSplashCache(): SplashCacheEntry | null {
  if (!cache) return null;
  if (Date.now() - cache.fetchedAt > config.splashCacheTtlMs) {
    cache = null;
    return null;
  }
  return cache;
}

export function setSplashCache(
  entry: Omit<SplashCacheEntry, 'fetchedAt'>,
): SplashCacheEntry {
  cache = { ...entry, fetchedAt: Date.now() };
  return cache;
}

export function clearSplashCache(): void {
  cache = null;
}
