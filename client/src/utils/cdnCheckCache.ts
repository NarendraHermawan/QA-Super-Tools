type CdnCheckStatus = 'ok' | 'broken';

interface CdnCheckCacheEntry {
  status: CdnCheckStatus;
  checkedAt: number;
}

/** Matches server default CDN_CHECK_CACHE_TTL_MS (10 min). */
const CACHE_TTL_MS = 10 * 60 * 1000;

const cache = new Map<string, CdnCheckCacheEntry>();

export function getClientCdnCheckCache(url: string): CdnCheckStatus | null {
  const entry = cache.get(url);
  if (!entry) return null;
  if (Date.now() - entry.checkedAt > CACHE_TTL_MS) {
    cache.delete(url);
    return null;
  }
  return entry.status;
}

export function setClientCdnCheckCache(url: string, status: CdnCheckStatus): void {
  cache.set(url, { status, checkedAt: Date.now() });
}
