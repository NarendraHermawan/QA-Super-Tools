import { getDb, isDbEnabled } from './client.js';

export interface AutoUploadLogRecord {
  id: number;
  weekId: string;
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

export interface UpsertAutoUploadInput {
  weekId: string;
  rowId: string;
  eventName?: string | null;
  assetType: 'splash' | 'anno';
  originalName?: string | null;
  tokenName?: string | null;
  cdnUrl?: string | null;
  status: 'uploading' | 'success' | 'failed';
  errorReason?: string | null;
}

function mapRow(row: Record<string, unknown>): AutoUploadLogRecord {
  return {
    id: Number(row.id),
    weekId: String(row.week_id),
    rowId: String(row.row_id),
    eventName: row.event_name ? String(row.event_name) : null,
    assetType: row.asset_type as 'splash' | 'anno',
    originalName: row.original_name ? String(row.original_name) : null,
    tokenName: row.token_name ? String(row.token_name) : null,
    cdnUrl: row.cdn_url ? String(row.cdn_url) : null,
    status: row.status as 'uploading' | 'success' | 'failed',
    errorReason: row.error_reason ? String(row.error_reason) : null,
    uploadedAt: String(row.uploaded_at),
  };
}

export async function upsertLog(input: UpsertAutoUploadInput): Promise<void> {
  if (!isDbEnabled()) return;
  const db = getDb();
  if (!db) return;

  await db`
    INSERT INTO auto_upload_log (
      week_id, row_id, event_name, asset_type, original_name,
      token_name, cdn_url, status, error_reason, uploaded_at
    ) VALUES (
      ${input.weekId},
      ${input.rowId},
      ${input.eventName ?? null},
      ${input.assetType},
      ${input.originalName ?? null},
      ${input.tokenName ?? null},
      ${input.cdnUrl ?? null},
      ${input.status},
      ${input.errorReason ?? null},
      NOW()
    )
    ON CONFLICT (week_id, row_id) DO UPDATE SET
      event_name = EXCLUDED.event_name,
      asset_type = EXCLUDED.asset_type,
      original_name = EXCLUDED.original_name,
      token_name = EXCLUDED.token_name,
      cdn_url = EXCLUDED.cdn_url,
      status = EXCLUDED.status,
      error_reason = EXCLUDED.error_reason,
      uploaded_at = NOW()
  `;
}

export async function getHistoryByWeek(
  weekId: string,
): Promise<AutoUploadLogRecord[]> {
  if (!isDbEnabled()) return [];
  const db = getDb();
  if (!db) return [];

  const rows = await db`
    SELECT *
    FROM auto_upload_log
    WHERE week_id = ${weekId}
    ORDER BY uploaded_at DESC
  `;

  return (rows as Record<string, unknown>[]).map(mapRow);
}

export async function deleteLog(
  weekId: string,
  rowId: string,
): Promise<boolean> {
  if (!isDbEnabled()) return false;
  const db = getDb();
  if (!db) return false;

  const rows = await db`
    DELETE FROM auto_upload_log
    WHERE week_id = ${weekId} AND row_id = ${rowId}
    RETURNING id
  `;

  return (rows as unknown[]).length > 0;
}
