import { ensureSchema, getDb, isDbEnabled } from './client.js';

export interface SplashConfirmedBug {
  id: string;
  eventName: string;
  assetType: 'splash' | 'anno';
  cdnUrl: string | null;
  date: string;
}

export interface SplashChecklistState {
  byDate: Record<string, string[]>;
}

interface SplashCheckRow {
  check_date: string;
  row_id: string;
}

interface SplashBugRow {
  row_id: string;
  event_name: string;
  asset_type: string;
  cdn_url: string | null;
  check_date: string;
}

const memoryChecks = new Map<string, Map<string, Set<string>>>();
const memoryBugs = new Map<string, Map<string, SplashConfirmedBug[]>>();

function getMemoryMonthChecks(monthId: string): Map<string, Set<string>> {
  let month = memoryChecks.get(monthId);
  if (!month) {
    month = new Map();
    memoryChecks.set(monthId, month);
  }
  return month;
}

function getMemoryMonthBugs(monthId: string): Map<string, SplashConfirmedBug[]> {
  let month = memoryBugs.get(monthId);
  if (!month) {
    month = new Map();
    memoryBugs.set(monthId, month);
  }
  return month;
}

function toByDate(month: Map<string, Set<string>>): Record<string, string[]> {
  const byDate: Record<string, string[]> = {};
  for (const [date, rowIds] of month.entries()) {
    byDate[date] = [...rowIds];
  }
  return byDate;
}

export async function getSplashChecklistState(
  monthId: string,
): Promise<SplashChecklistState> {
  await ensureSchema();
  const db = getDb();

  if (!db) {
    const month = memoryChecks.get(monthId);
    return { byDate: month ? toByDate(month) : {} };
  }

  const rows = (await db`
    SELECT check_date, row_id
    FROM splash_checks
    WHERE month_id = ${monthId}
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
  monthId: string,
  checkDate: string,
  rowId: string,
  checked: boolean,
): Promise<void> {
  await ensureSchema();
  const db = getDb();

  if (!db) {
    const month = getMemoryMonthChecks(monthId);
    const dateSet = month.get(checkDate) ?? new Set<string>();
    if (checked) dateSet.add(rowId);
    else dateSet.delete(rowId);
    if (dateSet.size === 0) month.delete(checkDate);
    else month.set(checkDate, dateSet);
    return;
  }

  if (checked) {
    await db`
      INSERT INTO splash_checks (month_id, check_date, row_id)
      VALUES (${monthId}, ${checkDate}, ${rowId})
      ON CONFLICT (month_id, check_date, row_id) DO UPDATE
      SET checked_at = NOW()
    `;
    return;
  }

  await db`
    DELETE FROM splash_checks
    WHERE month_id = ${monthId}
      AND check_date = ${checkDate}
      AND row_id = ${rowId}
  `;
}

export async function setSplashChecklistBatch(
  monthId: string,
  checkDate: string,
  rowIds: string[],
): Promise<void> {
  if (rowIds.length === 0) return;
  await ensureSchema();
  const db = getDb();

  if (!db) {
    const month = getMemoryMonthChecks(monthId);
    const dateSet = month.get(checkDate) ?? new Set<string>();
    for (const rowId of rowIds) dateSet.add(rowId);
    month.set(checkDate, dateSet);
    return;
  }

  for (const rowId of rowIds) {
    await db`
      INSERT INTO splash_checks (month_id, check_date, row_id)
      VALUES (${monthId}, ${checkDate}, ${rowId})
      ON CONFLICT (month_id, check_date, row_id) DO UPDATE
      SET checked_at = NOW()
    `;
  }
}

export async function getSplashConfirmedBugs(
  monthId: string,
  checkDate: string,
): Promise<SplashConfirmedBug[]> {
  await ensureSchema();
  const db = getDb();

  if (!db) {
    const month = memoryBugs.get(monthId);
    return month?.get(checkDate) ?? [];
  }

  const rows = (await db`
    SELECT row_id, event_name, asset_type, cdn_url, check_date
    FROM splash_bugs
    WHERE month_id = ${monthId}
      AND check_date = ${checkDate}
    ORDER BY confirmed_at
  `) as SplashBugRow[];

  return rows.map((row) => ({
    id: String(row.row_id),
    eventName: String(row.event_name),
    assetType: String(row.asset_type) as SplashConfirmedBug['assetType'],
    cdnUrl: row.cdn_url ? String(row.cdn_url) : null,
    date: String(row.check_date),
  }));
}

export async function addSplashConfirmedBug(
  monthId: string,
  bug: SplashConfirmedBug,
): Promise<void> {
  await ensureSchema();
  const db = getDb();

  if (!db) {
    const month = getMemoryMonthBugs(monthId);
    const existing = month.get(bug.date) ?? [];
    if (existing.some((item) => item.id === bug.id)) return;
    month.set(bug.date, [...existing, bug]);
    return;
  }

  await db`
    INSERT INTO splash_bugs (
      month_id,
      check_date,
      row_id,
      event_name,
      asset_type,
      cdn_url
    )
    VALUES (
      ${monthId},
      ${bug.date},
      ${bug.id},
      ${bug.eventName},
      ${bug.assetType},
      ${bug.cdnUrl}
    )
    ON CONFLICT (month_id, check_date, row_id) DO NOTHING
  `;
}

export function splashStorageBackend(): 'neon' | 'memory' {
  return isDbEnabled() ? 'neon' : 'memory';
}

export function clearSplashMemoryStorageForTests(): void {
  memoryChecks.clear();
  memoryBugs.clear();
}
