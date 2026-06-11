export interface AutoUploadConfig {
  available: boolean;
  obVersion: string | null;
  error?: string;
}

export interface AutoUploadHistoryRecord {
  rowId: string;
  eventName: string | null;
  assetType: 'splash' | 'anno';
  originalName: string | null;
  tokenName: string | null;
  cdnUrl: string | null;
  status: 'uploading' | 'success' | 'failed';
  errorReason: string | null;
  uploadedAt: string;
}

interface AutoUploadHistoryApiRecord {
  rowId: string;
  eventName: string | null;
  assetType: 'splash' | 'anno';
  originalName: string | null;
  tokenName: string | null;
  cdnUrl: string | null;
  status: 'uploading' | 'success' | 'failed';
  errorReason: string | null;
  uploadedAt: string;
}

export interface AutoUploadHistoryResponse {
  records: AutoUploadHistoryApiRecord[];
}

export interface UploadFileResponse {
  status: 'success' | 'failed';
  tokenName?: string;
  cdnUrl?: string;
  error?: string;
}

async function autoUploadRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
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

  const payload = await response.json().catch(() => ({}));

  if (response.status === 503) {
    return {
      available: false,
      obVersion: null,
      error: payload.error ?? 'Auto upload unavailable',
    } as T;
  }

  if (!response.ok) {
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }

  return payload as T;
}

export async function fetchAutoUploadConfig(
  weekId?: string,
): Promise<AutoUploadConfig> {
  const params = weekId ? `?weekId=${encodeURIComponent(weekId)}` : '';
  try {
    const data = await autoUploadRequest<AutoUploadConfig>(
      `/api/auto-upload/config${params}`,
    );
    return { ...data, available: data.available ?? true };
  } catch (err) {
    return {
      available: false,
      obVersion: null,
      error: err instanceof Error ? err.message : 'Auto upload unavailable',
    };
  }
}

function mapHistoryRecord(row: AutoUploadHistoryApiRecord): AutoUploadHistoryRecord {
  return {
    rowId: row.rowId,
    eventName: row.eventName,
    assetType: row.assetType,
    originalName: row.originalName,
    tokenName: row.tokenName,
    cdnUrl: row.cdnUrl,
    status: row.status,
    errorReason: row.errorReason,
    uploadedAt: row.uploadedAt,
  };
}

export async function fetchAutoUploadHistory(
  weekId: string,
): Promise<AutoUploadHistoryRecord[]> {
  try {
    const data = await autoUploadRequest<AutoUploadHistoryResponse>(
      `/api/auto-upload/history?weekId=${encodeURIComponent(weekId)}`,
    );
    return (data.records ?? []).map(mapHistoryRecord);
  } catch {
    return [];
  }
}

export async function clearUploadHistory(
  weekId: string,
  rowId: string,
): Promise<void> {
  await autoUploadRequest(
    `/api/auto-upload/history/${encodeURIComponent(rowId)}?weekId=${encodeURIComponent(weekId)}`,
    { method: 'DELETE' },
  );
}

export async function uploadFile(
  file: File,
  {
    rowId,
    assetType,
    weekId,
  }: {
    rowId: string;
    assetType: 'splash' | 'anno';
    weekId: string;
  },
): Promise<UploadFileResponse> {
  const form = new FormData();
  form.append('file', file);
  form.append('rowId', rowId);
  form.append('assetType', assetType);
  form.append('weekId', weekId);

  const response = await fetch('/api/auto-upload/upload', {
    method: 'POST',
    body: form,
    credentials: 'include',
  });

  const payload = (await response.json().catch(() => ({}))) as UploadFileResponse;

  if (response.status === 503) {
    return {
      status: 'failed',
      error:
        (payload as { error?: string }).error ??
        'Auto upload is only available when running locally via Docker with office WiFi.',
    };
  }

  if (!response.ok && payload.status !== 'failed') {
    return {
      status: 'failed',
      error: (payload as { error?: string }).error ?? 'Upload failed',
    };
  }

  return payload;
}
