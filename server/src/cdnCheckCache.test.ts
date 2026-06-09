import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearCdnCheckCache,
  getCdnCheckCache,
  setCdnCheckCache,
} from './cdnCheckCache.js';

afterEach(() => {
  clearCdnCheckCache();
  vi.useRealTimers();
});

describe('cdnCheckCache', () => {
  it('returns null for unknown URLs', () => {
    expect(getCdnCheckCache('https://example.com/a.jpg')).toBeNull();
  });

  it('stores and returns cached status', () => {
    const url = 'https://example.com/a.jpg';
    setCdnCheckCache(url, 'ok');
    expect(getCdnCheckCache(url)).toBe('ok');
  });

  it('expires entries after TTL', () => {
    vi.useFakeTimers();
    const url = 'https://example.com/a.jpg';
    setCdnCheckCache(url, 'broken');
    vi.advanceTimersByTime(10 * 60 * 1000 + 1);
    expect(getCdnCheckCache(url)).toBeNull();
  });
});
