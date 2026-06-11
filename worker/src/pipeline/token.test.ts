import { describe, expect, it } from 'vitest';
import { buildCdnUrl, generateUploadToken } from './token.js';

describe('upload token', () => {
  it('generates 10-character url-safe tokens', () => {
    const token = generateUploadToken();
    expect(token).toHaveLength(10);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('builds CDN path with OB version and token filename', () => {
    expect(buildCdnUrl('OB53', 'aB3xK9mPqR.png')).toBe(
      'https://dl.dir.freefiremobile.com/common/OB53/ID/splash/aB3xK9mPqR.png',
    );
  });
});
