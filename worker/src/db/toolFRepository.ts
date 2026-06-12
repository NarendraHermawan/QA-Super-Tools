import { getDb, isDbEnabled } from './client.js';

export type ToolFJobStatus = 'running' | 'completed' | 'cancelled' | 'failed';
export type ToolFLogStatus = 'success' | 'failed' | 'skipped' | 'info';

export interface ToolFJob {
  id: string;
  triggeredAt: string;
  status: ToolFJobStatus;
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
  status: ToolFLogStatus;
  message: string | null;
  cdnUrl: string | null;
  loggedAt: string;
}

const memoryJobs = new Map<string, ToolFJob>();
const memoryLogs = new Map<string, ToolFLogEntry[]>();
let memoryLogId = 1;
let activeJobId: string | null = null;

export function getActiveJobId(): string | null {
  return activeJobId;
}

export function setActiveJobId(jobId: string | null): void {
  activeJobId = jobId;
}

export async function createJob(): Promise<ToolFJob> {
  const db = getDb();
  if (db) {
    const rows = await db`
      INSERT INTO tool_f_jobs (status)
      VALUES ('running')
      RETURNING id, triggered_at, status, total_rows, succeeded, failed, skipped, completed_at
    `;
    const row = rows[0] as {
      id: string;
      triggered_at: string;
      status: ToolFJobStatus;
      total_rows: number;
      succeeded: number;
      failed: number;
      skipped: number;
      completed_at: string | null;
    };
    const job: ToolFJob = {
      id: String(row.id),
      triggeredAt: String(row.triggered_at),
      status: row.status,
      totalRows: Number(row.total_rows),
      succeeded: Number(row.succeeded),
      failed: Number(row.failed),
      skipped: Number(row.skipped),
      completedAt: row.completed_at,
    };
    setActiveJobId(job.id);
    return job;
  }

  const id = crypto.randomUUID();
  const job: ToolFJob = {
    id,
    triggeredAt: new Date().toISOString(),
    status: 'running',
    totalRows: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    completedAt: null,
  };
  memoryJobs.set(id, job);
  memoryLogs.set(id, []);
  setActiveJobId(id);
  return job;
}

export async function finishJob(
  jobId: string,
  status: ToolFJobStatus,
  counts: { succeeded: number; failed: number; skipped: number },
): Promise<void> {
  const db = getDb();
  if (db) {
    await db`
      UPDATE tool_f_jobs
      SET status = ${status},
          succeeded = ${counts.succeeded},
          failed = ${counts.failed},
          skipped = ${counts.skipped},
          completed_at = NOW()
      WHERE id = ${jobId}::uuid
    `;
    if (activeJobId === jobId) setActiveJobId(null);
    return;
  }

  const job = memoryJobs.get(jobId);
  if (job) {
    job.status = status;
    job.succeeded = counts.succeeded;
    job.failed = counts.failed;
    job.skipped = counts.skipped;
    job.completedAt = new Date().toISOString();
  }
  if (activeJobId === jobId) setActiveJobId(null);
}

export async function appendLog(
  jobId: string,
  entry: {
    rowLabel?: string | null;
    ffUrl?: string | null;
    status: ToolFLogStatus;
    message?: string | null;
    cdnUrl?: string | null;
  },
): Promise<void> {
  const db = getDb();
  if (db) {
    await db`
      INSERT INTO tool_f_log (job_id, row_label, ff_url, status, message, cdn_url)
      VALUES (
        ${jobId}::uuid,
        ${entry.rowLabel ?? null},
        ${entry.ffUrl ?? null},
        ${entry.status},
        ${entry.message ?? null},
        ${entry.cdnUrl ?? null}
      )
    `;
    return;
  }

  const list = memoryLogs.get(jobId) ?? [];
  list.push({
    id: memoryLogId++,
    jobId,
    rowLabel: entry.rowLabel ?? null,
    ffUrl: entry.ffUrl ?? null,
    status: entry.status,
    message: entry.message ?? null,
    cdnUrl: entry.cdnUrl ?? null,
    loggedAt: new Date().toISOString(),
  });
  memoryLogs.set(jobId, list);
}

export async function listJobs(limit = 10): Promise<ToolFJob[]> {
  const db = getDb();
  if (db) {
    const rows = await db`
      SELECT id, triggered_at, status, total_rows, succeeded, failed, skipped, completed_at
      FROM tool_f_jobs
      ORDER BY triggered_at DESC
      LIMIT ${limit}
    `;
    return rows.map((row) => ({
      id: String((row as { id: string }).id),
      triggeredAt: String((row as { triggered_at: string }).triggered_at),
      status: (row as { status: ToolFJobStatus }).status,
      totalRows: Number((row as { total_rows: number }).total_rows),
      succeeded: Number((row as { succeeded: number }).succeeded),
      failed: Number((row as { failed: number }).failed),
      skipped: Number((row as { skipped: number }).skipped),
      completedAt: (row as { completed_at: string | null }).completed_at,
    }));
  }

  return [...memoryJobs.values()]
    .sort((a, b) => b.triggeredAt.localeCompare(a.triggeredAt))
    .slice(0, limit);
}

export async function getJobLogs(jobId: string): Promise<ToolFLogEntry[]> {
  const db = getDb();
  if (db) {
    const rows = await db`
      SELECT id, job_id, row_label, ff_url, status, message, cdn_url, logged_at
      FROM tool_f_log
      WHERE job_id = ${jobId}::uuid
      ORDER BY logged_at ASC, id ASC
    `;
    return rows.map((row) => ({
      id: Number((row as { id: number }).id),
      jobId: String((row as { job_id: string }).job_id),
      rowLabel: (row as { row_label: string | null }).row_label,
      ffUrl: (row as { ff_url: string | null }).ff_url,
      status: (row as { status: ToolFLogStatus }).status,
      message: (row as { message: string | null }).message,
      cdnUrl: (row as { cdn_url: string | null }).cdn_url,
      loggedAt: String((row as { logged_at: string }).logged_at),
    }));
  }

  return memoryLogs.get(jobId) ?? [];
}

export async function findRunningJob(): Promise<ToolFJob | null> {
  const db = getDb();
  if (db) {
    const rows = await db`
      SELECT id, triggered_at, status, total_rows, succeeded, failed, skipped, completed_at
      FROM tool_f_jobs
      WHERE status = 'running'
      ORDER BY triggered_at DESC
      LIMIT 1
    `;
    if (rows.length === 0) return null;
    const row = rows[0] as {
      id: string;
      triggered_at: string;
      status: ToolFJobStatus;
      total_rows: number;
      succeeded: number;
      failed: number;
      skipped: number;
      completed_at: string | null;
    };
    return {
      id: String(row.id),
      triggeredAt: String(row.triggered_at),
      status: row.status,
      totalRows: Number(row.total_rows),
      succeeded: Number(row.succeeded),
      failed: Number(row.failed),
      skipped: Number(row.skipped),
      completedAt: row.completed_at,
    };
  }

  for (const job of memoryJobs.values()) {
    if (job.status === 'running') return job;
  }
  return null;
}

export function clearToolFMemoryForTests(): void {
  memoryJobs.clear();
  memoryLogs.clear();
  memoryLogId = 1;
  activeJobId = null;
}

export function isToolFDbEnabled(): boolean {
  return isDbEnabled();
}
