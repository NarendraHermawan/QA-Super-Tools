import { ensureSchema, getDb, isDbEnabled } from './client.js';

export type UploadOverrides = Record<string, boolean>;

interface UploadOverrideRow {
  row_id: string;
  uploaded: boolean;
}

const memoryOverrides = new Map<string, UploadOverrides>();

function getMemoryWeek(weekId: string): UploadOverrides {
  let week = memoryOverrides.get(weekId);
  if (!week) {
    week = {};
    memoryOverrides.set(weekId, week);
  }
  return week;
}

export async function getUploadOverrides(
  weekId: string,
): Promise<UploadOverrides> {
  await ensureSchema();
  const db = getDb();

  if (!db) {
    return { ...(memoryOverrides.get(weekId) ?? {}) };
  }

  const rows = (await db`
    SELECT row_id, uploaded
    FROM cdn_upload_overrides
    WHERE week_id = ${weekId}
    ORDER BY row_id
  `) as UploadOverrideRow[];

  const overrides: UploadOverrides = {};
  for (const row of rows) {
    overrides[String(row.row_id)] = Boolean(row.uploaded);
  }
  return overrides;
}

export async function setUploadOverride(
  weekId: string,
  rowId: string,
  uploaded: boolean,
): Promise<void> {
  await ensureSchema();
  const db = getDb();

  if (!db) {
    getMemoryWeek(weekId)[rowId] = uploaded;
    return;
  }

  await db`
    INSERT INTO cdn_upload_overrides (week_id, row_id, uploaded)
    VALUES (${weekId}, ${rowId}, ${uploaded})
    ON CONFLICT (week_id, row_id) DO UPDATE
    SET uploaded = ${uploaded}, updated_at = NOW()
  `;
}

export function clearMemoryUploadOverridesForTests(): void {
  memoryOverrides.clear();
}
