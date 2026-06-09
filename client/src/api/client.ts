import type { WeekDetailResponse, WeeksResponse } from '../types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'include',
  });
  if (response.status === 401 && !path.startsWith('/api/auth/')) {
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

export function fetchWeeks(): Promise<WeeksResponse> {
  return request<WeeksResponse>('/api/weeks');
}

export function fetchWeek(weekId: string): Promise<WeekDetailResponse> {
  return request<WeekDetailResponse>(`/api/week/${encodeURIComponent(weekId)}`);
}

export function fetchWeekForDate(date: string): Promise<{ week: WeeksResponse['weeks'][0] }> {
  return request(`/api/week-for-date/${date}`);
}

export function refreshWeeks(): Promise<WeeksResponse> {
  return request<WeeksResponse>('/api/refresh', { method: 'POST' });
}

export function checkCdn(url: string): Promise<{ status: 'ok' | 'broken'; url: string }> {
  return request(`/api/cdn-check?url=${encodeURIComponent(url)}`);
}
