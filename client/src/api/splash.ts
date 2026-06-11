import type { SplashWeekDetailResponse, SubWeek, WeeksResponse } from '../types';

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

export function fetchSplashWeeks(): Promise<WeeksResponse> {
  return request('/api/splash/weeks');
}

export function fetchSplashWeek(
  weekId: string,
  date?: string,
): Promise<SplashWeekDetailResponse> {
  const params = date ? `?date=${encodeURIComponent(date)}` : '';
  return request(`/api/splash/week/${encodeURIComponent(weekId)}${params}`);
}

export function fetchSplashWeekForDate(
  date: string,
): Promise<{ week: SubWeek }> {
  return request(`/api/splash/week-for-date/${encodeURIComponent(date)}`);
}

export function refreshSplashWeeks(): Promise<WeeksResponse> {
  return request('/api/splash/refresh', { method: 'POST' });
}

export function fetchSplashSheetUrl(): Promise<{ url: string }> {
  return request('/api/splash/sheet-url');
}

export function fetchSplashUploadOverrides(
  weekId: string,
): Promise<{ overrides: Record<string, boolean> }> {
  return request(
    `/api/splash/upload-overrides/${encodeURIComponent(weekId)}`,
  );
}

export function saveSplashUploadOverride(
  weekId: string,
  rowId: string,
  uploaded: boolean,
): Promise<{ ok: boolean }> {
  return request(`/api/splash/upload-overrides/${encodeURIComponent(weekId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rowId, uploaded }),
  });
}

export function fetchSplashChecklist(
  weekId: string,
): Promise<{ byDate: Record<string, string[]> }> {
  return request(`/api/splash/checklist/${encodeURIComponent(weekId)}`);
}

export function saveSplashChecklistItem(
  weekId: string,
  date: string,
  rowId: string,
  checked: boolean,
): Promise<{ ok: boolean }> {
  return request(`/api/splash/checklist/${encodeURIComponent(weekId)}/check`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, rowId, checked }),
  });
}

export function saveSplashChecklistBatch(
  weekId: string,
  date: string,
  rowIds: string[],
): Promise<{ ok: boolean; saved: number }> {
  return request(
    `/api/splash/checklist/${encodeURIComponent(weekId)}/check-batch`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, rowIds }),
    },
  );
}
