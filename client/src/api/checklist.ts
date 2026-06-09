import type { ConfirmedBug } from '../types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function fetchChecklistWeek(
  weekId: string,
): Promise<{ byDate: Record<string, string[]> }> {
  return request(`/api/checklist/${encodeURIComponent(weekId)}`);
}

export function saveChecklistItem(
  weekId: string,
  date: string,
  rowId: string,
  checked: boolean,
): Promise<{ ok: boolean }> {
  return request(`/api/checklist/${encodeURIComponent(weekId)}/check`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, rowId, checked }),
  });
}

export function saveChecklistBatch(
  weekId: string,
  date: string,
  rowIds: string[],
): Promise<{ ok: boolean; saved: number }> {
  return request(`/api/checklist/${encodeURIComponent(weekId)}/check-batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, rowIds }),
  });
}

export function fetchConfirmedBugs(
  weekId: string,
  date: string,
): Promise<{ bugs: ConfirmedBug[] }> {
  return request(
    `/api/checklist/${encodeURIComponent(weekId)}/bugs?date=${encodeURIComponent(date)}`,
  );
}

export function saveConfirmedBug(
  weekId: string,
  bug: ConfirmedBug,
): Promise<{ ok: boolean }> {
  return request(`/api/checklist/${encodeURIComponent(weekId)}/bugs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bug),
  });
}

export function fetchStorageBackend(): Promise<{ backend: 'neon' | 'memory' }> {
  return request('/api/checklist/storage');
}
