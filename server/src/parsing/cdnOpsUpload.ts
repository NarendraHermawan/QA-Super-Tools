import { isHttpUrl, normalizeCdnLink } from './cdnLink.js';

export const CDNOPS_UPLOAD_BASE = 'https://cdnops.jingle.cn/upload';

export interface CdnOpsPathCandidates {
  eventFolderPath: string;
  parentFolderPath: string;
}

function stripCommonPrefix(pathname: string): string {
  const normalized = pathname.replace(/^\/+/, '');
  if (normalized.startsWith('common/')) {
    return normalized.slice('common/'.length);
  }
  return normalized;
}

export function parseCdnOpsPathCandidates(
  rawCdnUrl: string,
  cdnBaseUrl: string,
): CdnOpsPathCandidates | null {
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

  const dirSegments = segments.slice(0, -1);
  const eventFolderPath = dirSegments.join('/');
  const parentFolderPath = dirSegments.slice(0, -1).join('/');

  if (!eventFolderPath) return null;

  return { eventFolderPath, parentFolderPath };
}

export function cdnOpsUploadUrlForPath(folderPath: string): string {
  const clean = folderPath.replace(/^\/+/, '').replace(/\/+$/, '');
  return `${CDNOPS_UPLOAD_BASE}/${clean}`;
}

export function resolveCdnOpsUploadUrlSync(
  rawCdnUrl: string,
  cdnBaseUrl: string,
): string | null {
  const candidates = parseCdnOpsPathCandidates(rawCdnUrl, cdnBaseUrl);
  if (!candidates) return null;
  return cdnOpsUploadUrlForPath(candidates.eventFolderPath);
}

async function probeUrl(
  url: string,
  method: 'HEAD' | 'GET',
  timeoutMs: number,
): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method,
      signal: controller.signal,
      redirect: 'follow',
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function headReachable(url: string, timeoutMs = 5000): Promise<boolean> {
  if (await probeUrl(url, 'HEAD', timeoutMs)) return true;
  return probeUrl(url, 'GET', timeoutMs);
}

export async function resolveCdnOpsUploadUrl(
  rawCdnUrl: string,
  cdnBaseUrl: string,
): Promise<string | null> {
  const candidates = parseCdnOpsPathCandidates(rawCdnUrl, cdnBaseUrl);
  if (!candidates) return null;

  const eventUrl = cdnOpsUploadUrlForPath(candidates.eventFolderPath);
  if (!candidates.parentFolderPath) {
    return eventUrl;
  }

  const eventReachable = await headReachable(eventUrl);
  if (eventReachable) return eventUrl;

  return cdnOpsUploadUrlForPath(candidates.parentFolderPath);
}
