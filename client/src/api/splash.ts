import type {
  SplashAssetType,
  SplashChecklistGroups,
  SplashConfirmedBug,
  SplashRecord,
  SplashUploadSections,
} from '../types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'include',
  });
  if (response.status === 401) {
    if (window.location.pathname !== '/login') {
      window.location.assign(
        `/login?from=${encodeURIComponent(window.location.pathname)}`,
      );
    }
    throw new Error('Authentication required');
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function fetchSplashConfig(): Promise<{
  configured: boolean;
  cacheTtlMs: number;
  storage: 'neon' | 'memory';
}> {
  return request('/api/splash/config');
}

export function fetchSplashMonths(): Promise<{ months: string[] }> {
  return request('/api/splash/months');
}

export function fetchSplashMonth(monthId: string): Promise<{
  monthId: string;
  records: SplashRecord[];
  days: string[];
}> {
  return request(`/api/splash/${encodeURIComponent(monthId)}`);
}

export function fetchSplashUpload(
  monthId: string,
  date: string,
  showAll = false,
): Promise<{
  monthId: string;
  date: string;
  showAll: boolean;
  records: SplashRecord[];
  sections: SplashUploadSections;
  duplicateSortIds: number[];
  activeCohortSortIds: number[];
}> {
  const params = new URLSearchParams({ date, showAll: String(showAll) });
  return request(
    `/api/splash/${encodeURIComponent(monthId)}/upload?${params}`,
  );
}

export function fetchSplashChecklist(
  monthId: string,
  date: string,
  assetType: SplashAssetType,
): Promise<{
  monthId: string;
  date: string;
  assetType: SplashAssetType;
  groups: SplashChecklistGroups;
  duplicateSortIds: number[];
  activeCohortSortIds: number[];
}> {
  const params = new URLSearchParams({ date, assetType });
  return request(
    `/api/splash/${encodeURIComponent(monthId)}/checklist?${params}`,
  );
}

export function fetchSplashSummary(
  monthId: string,
  date: string,
): Promise<{
  monthId: string;
  date: string;
  activeCount: number;
  readyCount: number;
  blockedCount: number;
}> {
  const params = new URLSearchParams({ date });
  return request(
    `/api/splash/${encodeURIComponent(monthId)}/summary?${params}`,
  );
}

export function fetchSplashChecks(
  monthId: string,
): Promise<{ byDate: Record<string, string[]> }> {
  return request(`/api/splash/${encodeURIComponent(monthId)}/checks`);
}

export function saveSplashCheck(
  monthId: string,
  date: string,
  rowId: string,
  checked: boolean,
): Promise<{ ok: boolean }> {
  return request(`/api/splash/${encodeURIComponent(monthId)}/check`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, rowId, checked }),
  });
}

export function saveSplashCheckBatch(
  monthId: string,
  date: string,
  rowIds: string[],
): Promise<{ ok: boolean; saved: number }> {
  return request(`/api/splash/${encodeURIComponent(monthId)}/check-batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, rowIds }),
  });
}

export function fetchSplashBugs(
  monthId: string,
  date: string,
): Promise<{ bugs: SplashConfirmedBug[] }> {
  return request(
    `/api/splash/${encodeURIComponent(monthId)}/bugs?date=${encodeURIComponent(date)}`,
  );
}

export function saveSplashBug(
  monthId: string,
  bug: SplashConfirmedBug,
): Promise<{ ok: boolean }> {
  return request(`/api/splash/${encodeURIComponent(monthId)}/bugs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bug),
  });
}

export function refreshSplashData(): Promise<{ ok: boolean; months: string[] }> {
  return request('/api/splash/refresh', { method: 'POST' });
}
