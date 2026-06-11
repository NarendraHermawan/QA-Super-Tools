import { describe, expect, it } from 'vitest';
import { detectObVersion, parseObVersionFromCdnUrl } from './obVersionDetector.js';

describe('parseObVersionFromCdnUrl', () => {
  it('parses OB version from full CDN URL', () => {
    expect(
      parseObVersionFromCdnUrl(
        'https://dl.dir.freefiremobile.com/common/OB53/ID/splash/file.png',
      ),
    ).toBe('OB53');
  });

  it('parses OB version from relative path', () => {
    expect(parseObVersionFromCdnUrl('OB52/ID/splash/file.png')).toBe('OB52');
  });

  it('returns null for invalid paths', () => {
    expect(parseObVersionFromCdnUrl('')).toBeNull();
    expect(parseObVersionFromCdnUrl('invalid/path')).toBeNull();
  });
});

describe('detectObVersion', () => {
  const records = [
    {
      assetType: 'splash' as const,
      cdnUrl: null,
    },
    {
      assetType: 'anno' as const,
      cdnUrl: 'https://dl.dir.freefiremobile.com/common/OB54/ID/splash/anno.png',
    },
  ];

  it('prefers splash CDN URLs before anno', () => {
    const withSplash = [
      {
        assetType: 'splash' as const,
        cdnUrl: 'https://dl.dir.freefiremobile.com/common/OB51/ID/splash/a.png',
      },
      ...records.slice(1),
    ];
    expect(detectObVersion(withSplash)).toBe('OB51');
  });

  it('falls back to anno then env', () => {
    expect(detectObVersion(records)).toBe('OB54');
    expect(detectObVersion([], 'OB99')).toBe('OB99');
    expect(detectObVersion([])).toBeNull();
  });
});
