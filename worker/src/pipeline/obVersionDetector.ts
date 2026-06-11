import { config } from '../config.js';

const CDN_DL_BASE = 'https://dl.dir.freefiremobile.com/common/';

function stripCommonPrefix(pathname: string): string {
  const normalized = pathname.replace(/^\/+/, '');
  if (normalized.startsWith('common/')) {
    return normalized.slice('common/'.length);
  }
  return normalized;
}

export function parseObVersionFromCdnUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  let assetPath: string;
  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `${CDN_DL_BASE}${trimmed}`);
    assetPath = stripCommonPrefix(url.pathname);
  } catch {
    assetPath = stripCommonPrefix(trimmed);
  }

  const firstSegment = assetPath.split('/').filter(Boolean)[0];
  if (!firstSegment || !/^OB\d+/i.test(firstSegment)) return null;
  return firstSegment.toUpperCase().startsWith('OB')
    ? firstSegment.toUpperCase()
    : firstSegment;
}

export interface ObDetectionRecord {
  assetType: 'splash' | 'anno';
  cdnUrl: string | null;
}

export function detectObVersion(
  weekRecords: ObDetectionRecord[],
  envFallback?: string,
): string | null {
  const splashUrls = weekRecords
    .filter((r) => r.assetType === 'splash')
    .map((r) => r.cdnUrl)
    .filter(Boolean) as string[];

  for (const url of splashUrls) {
    const ob = parseObVersionFromCdnUrl(url);
    if (ob) return ob;
  }

  const annoUrls = weekRecords
    .filter((r) => r.assetType === 'anno')
    .map((r) => r.cdnUrl)
    .filter(Boolean) as string[];

  for (const url of annoUrls) {
    const ob = parseObVersionFromCdnUrl(url);
    if (ob) return ob;
  }

  for (const record of weekRecords) {
    if (!record.cdnUrl) continue;
    const ob = parseObVersionFromCdnUrl(record.cdnUrl);
    if (ob) return ob;
  }

  const fallback = (envFallback ?? config.cdnObVersion).trim();
  return fallback || null;
}

export const OB_DETECTION_ERROR =
  'Cannot detect OB version — set CDN_OB_VERSION in .env';
