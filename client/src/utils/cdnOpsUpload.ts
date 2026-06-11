import { isHttpUrl, normalizeCdnLink } from './cdnLink';

export const CDNOPS_UPLOAD_BASE = 'https://cdnops.jingle.cn/upload';

const CDN_BASE_URL =
  import.meta.env.VITE_CDN_BASE_URL ?? 'https://dl.dir.freefiremobile.com/common/';

function stripCommonPrefix(pathname: string): string {
  const normalized = pathname.replace(/^\/+/, '');
  if (normalized.startsWith('common/')) {
    return normalized.slice('common/'.length);
  }
  return normalized;
}

export function parseCdnOpsPathCandidates(
  rawCdnUrl: string,
  cdnBaseUrl: string = CDN_BASE_URL,
): { eventFolderPath: string } | null {
  const trimmed = rawCdnUrl.trim();
  if (!trimmed) return null;

  const fullUrl = isHttpUrl(trimmed)
    ? trimmed
    : normalizeCdnLink(trimmed, cdnBaseUrl);
  if (!fullUrl) return null;

  let assetPath: string;
  try {
    const url = new URL(fullUrl);
    assetPath = stripCommonPrefix(url.pathname);
  } catch {
    assetPath = stripCommonPrefix(trimmed);
  }

  const segments = assetPath.split('/').filter(Boolean);
  if (segments.length < 2) return null;

  const eventFolderPath = segments.slice(0, -1).join('/');
  if (!eventFolderPath) return null;

  return { eventFolderPath };
}

export function resolveCdnOpsUploadUrl(rawCdnUrl: string): string | null {
  const candidates = parseCdnOpsPathCandidates(rawCdnUrl);
  if (!candidates) return null;

  const clean = candidates.eventFolderPath.replace(/^\/+/, '').replace(/\/+$/, '');
  return `${CDNOPS_UPLOAD_BASE}/${clean}`;
}

export function cdnOpsSplashFolderUrl(obVersion: string): string {
  const ob = obVersion.trim() || 'OB53';
  return `${CDNOPS_UPLOAD_BASE}/${ob}/ID/splash`;
}
