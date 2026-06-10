import { ensureSchema, getDb, isDbEnabled } from './client.js';

export type SplashUploadOverrides = Record<string, boolean>;

export interface SplashChecklistWeekState {
  byDate: Record<string, string[]>;
}

interface SplashCheckRow {
  check_date: string;
  row_id: string;
}

interface SplashUploadOverrideRow {
  row_id: string;
  uploaded: boolean;
}

const memoryChecks = new Map<string, Map<string, Set<string>>>();
const memoryOverrides = new Map<string, SplashUploadOverrides>();

function getMemoryWeekChecks(weekId: string): Map<string, Set<string>> {
  let week = memoryChecks.get(weekId);
  if (!week) {
    week = new Map();
    memoryChecks.set(weekId, week);
  }
  return week;
}

function getMemoryWeekOverrides(weekId: string): SplashUploadOverrides {
  let week = memoryOverrides.get(weekId);
  if (!week) {
    week = {};
    memoryOverrides.set(weekId, week);
  }
  return week;
}

function toByDate(week: Map<string, Set<string>>): Record<string, string[]> {
  const byDate: Record<string, string[]> = {};
  for (const [date, rowIds] of week.entries()) {
    byDate[date] = [...rowIds];
  }
  return byDate;
}

export async function getSplashChecklistState(
  weekId: string,
): Promise<SplashChecklistWeekState> {
  await ensureSchema();
  const db = getDb();

  if (!db) {
    const week = memoryChecks.get(weekId);
    return { byDate: week ? toByDate(week) : {} };
  }

  const rows = (await db`
    SELECT check_date, row_id
    FROM splash_checks
    WHERE week_id = ${weekId}
    ORDER BY check_date, row_id
  `) as SplashCheckRow[];

  const byDate: Record<string, string[]> = {};
  for (const row of rows) {
    const date = String(row.check_date);
    const rowId = String(row.row_id);
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(rowId);
  }

  return { byDate };
}

export async function setSplashChecklistItem(
  weekId: string,
  checkDate: string,
  rowId: string,
  checked: boolean,
): Promise<void> {
  await ensureSchema();
  const db = getDb();

  if (!db) {
    const week = getMemoryWeekChecks(weekId);
    const dateSet = week.get(checkDate) ?? new Set<string>();
    if (checked) dateSet.add(rowId);
    else dateSet.delete(rowId);
    if (dateSet.size === 0) week.delete(checkDate);
    else week.set(checkDate, dateSet);
    return;
  }

  if (checked) {
    await db`
      INSERT INTO splash_checks (week_id, check_date, row_id)
      VALUES (${weekId}, ${checkDate}, ${rowId})
      ON CONFLICT (week_id, check_date, row_id) DO UPDATE
      SET checked_at = NOW()
    `;
    return;
  }

  await db`
    DELETE FROM splash_checks
    WHERE week_id = ${weekId}
      AND check_date = ${checkDate}
      AND row_id = ${rowId}
  `;
}

export async function setSplashChecklistBatch(
  weekId: string,
  checkDate: string,
  rowIds: string[],
): Promise<void> {
  if (rowIds.length === 0) return;
  await ensureSchema();
  const db = getDb();

  if (!db) {
    const week = getMemoryWeekChecks(weekId);
    const dateSet = week.get(checkDate) ?? new Set<string>();
    for (const rowId of rowIds) dateSet.add(rowId);
    week.set(checkDate, dateSet);
    return;
  }

  for (const rowId of rowIds) {
    await db`
      INSERT INTO splash_checks (week_id, check_date, row_id)
      VALUES (${weekId}, ${checkDate}, ${rowId})
      ON CONFLICT (week_id, check_date, row_id) DO UPDATE
      SET checked_at = NOW()
    `;
  }
}

export async function getSplashUploadOverrides(
  weekId: string,
): Promise<SplashUploadOverrides> {
  await ensureSchema();
  const db = getDb();

  if (!db) {
    return { ...(memoryOverrides.get(weekId) ?? {}) };
  }

  const rows = (await db`
    SELECT row_id, uploaded
    FROM splash_upload_overrides
    WHERE week_id = ${weekId}
    ORDER BY row_id
  `) as SplashUploadOverrideRow[];

  const overrides: SplashUploadOverrides = {};
  for (const row of rows) {
    overrides[String(row.row_id)] = Boolean(row.uploaded);
  }
  return overrides;
}

export async function setSplashUploadOverride(
  weekId: string,
  rowId: string,
  uploaded: boolean,
): Promise<void> {
  await ensureSchema();
  const db = getDb();

  if (!db) {
    getMemoryWeekOverrides(weekId)[rowId] = uploaded;
    return;
  }

  await db`
    INSERT INTO splash_upload_overrides (week_id, row_id, uploaded)
    VALUES (${weekId}, ${rowId}, ${uploaded})
    ON CONFLICT (week_id, row_id) DO UPDATE
    SET uploaded = ${uploaded}, updated_at = NOW()
  `;
}

export function clearSplashMemoryStorageForTests(): void {
  memoryChecks.clear();
  memoryOverrides.clear();
}
