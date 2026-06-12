import { apiFetch, apiFetchJson } from './http';

export interface ToolFRunScope {
  tabName: string;
  subWeekLabel: string;
  weekLabel: string;
}

export interface ToolFConfig {
  available: boolean;
  activeJobId?: string | null;
  pythonConfigured?: boolean;
  sheetTitle?: string | null;
  targetTab?: string | null;
  error?: string;
}

export interface ToolFJob {
  id: string;
  triggeredAt: string;
  status: 'running' | 'completed' | 'cancelled' | 'failed';
  totalRows: number;
  succeeded: number;
  failed: number;
  skipped: number;
  completedAt: string | null;
}

export interface ToolFLogEntry {
  id: number;
  jobId: string;
  rowLabel: string | null;
  ffUrl: string | null;
  status: 'success' | 'failed' | 'skipped' | 'info';
  message: string | null;
  cdnUrl: string | null;
  loggedAt: string;
}

export type ToolFSseEvent =
  | { type: 'started' }
  | { type: 'jobId'; jobId: string }
  | { type: 'log'; message: string; kind?: string }
  | { type: 'error'; message: string }
  | { type: 'complete'; exitCode: number | null; status: string };

export function fetchToolFConfig(): Promise<ToolFConfig> {
  return apiFetchJson<ToolFConfig>('/api/tool-f/config');
}

export function fetchToolFJobs(): Promise<{ jobs: ToolFJob[] }> {
  return apiFetchJson<{ jobs: ToolFJob[] }>('/api/tool-f/jobs');
}

export function fetchToolFJobLog(
  jobId: string,
): Promise<{ logs: ToolFLogEntry[] }> {
  return apiFetchJson<{ logs: ToolFLogEntry[] }>(
    `/api/tool-f/jobs/${encodeURIComponent(jobId)}/log`,
  );
}

export function cancelToolFRun(): Promise<{ cancelled: boolean }> {
  return apiFetchJson<{ cancelled: boolean }>('/api/tool-f/cancel', {
    method: 'POST',
  });
}

export async function runToolFUpload(
  scope: ToolFRunScope,
  onEvent: (event: ToolFSseEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await apiFetch('/api/tool-f/run', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scope),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Upload run failed (${response.status})`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response stream from server');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      const line = part
        .split('\n')
        .find((l) => l.startsWith('data: '));
      if (!line) continue;
      try {
        const payload = JSON.parse(line.slice(6)) as ToolFSseEvent;
        onEvent(payload);
      } catch {
        // ignore malformed chunks
      }
    }
  }
}

export interface CdnConnectivityResult {
  reachable: boolean;
  status?: number;
  error?: string;
  scenario?: string;
  hint?: string;
  testedAt: string;
}

export function fetchCdnConnectivity(): Promise<CdnConnectivityResult> {
  return apiFetchJson<CdnConnectivityResult>('/api/test-cdn-connectivity');
}
