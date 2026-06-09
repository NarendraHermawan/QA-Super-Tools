import { config } from './config.js';
import type { GridRow } from './parsing/weekModel.js';
import type { SubWeek } from './types.js';

interface CacheEntry {
  fetchedAt: number;
  tabNames: string[];
  grids: Record<string, GridRow[]>;
  weeks: SubWeek[];
}

let cache: CacheEntry | null = null;

export function getCache(): CacheEntry | null {
  if (!cache) return null;
  if (Date.now() - cache.fetchedAt > config.cacheTtlMs) {
    cache = null;
    return null;
  }
  return cache;
}

export function setCache(entry: Omit<CacheEntry, 'fetchedAt'>): CacheEntry {
  cache = { ...entry, fetchedAt: Date.now() };
  return cache;
}

export function clearCache(): void {
  cache = null;
}
