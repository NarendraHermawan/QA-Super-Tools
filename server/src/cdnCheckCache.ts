import { config } from './config.js';

export type CdnCheckStatus = 'ok' | 'broken';

interface CdnCheckCacheEntry {
  status: CdnCheckStatus;
  checkedAt: number;
}

const cache = new Map<string, CdnCheckCacheEntry>();

export function getCdnCheckCache(url: string): CdnCheckStatus | null {
  const entry = cache.get(url);
  if (!entry) return null;
  if (Date.now() - entry.checkedAt > config.cdnCheckCacheTtlMs) {
    cache.delete(url);
    return null;
  }
  return entry.status;
}

export function setCdnCheckCache(url: string, status: CdnCheckStatus): void {
  cache.set(url, { status, checkedAt: Date.now() });
}

export function clearCdnCheckCache(): void {
  cache.clear();
}
