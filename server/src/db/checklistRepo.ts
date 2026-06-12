import type { ConfirmedBug } from '../types.js';
import { ensureSchema, getDb, isDbEnabled } from './client.js';

export interface ChecklistWeekState {
  byDate: Record<string, string[]>;
  /** Rows explicitly unchecked on a day — blocks still-active carry-over from earlier days */
  carrySkips: Record<string, string[]>;
}

interface ChecklistCheckRow {
  check_date: string;
  row_id: string;
}

interface ConfirmedBugRow {
  row_id: string;
  event_name: string;
  placement: string;
  cdn_url: string | null;
  check_date: string;
}

const memoryChecks = new Map<string, Map<string, Set<string>>>();
const memoryCarrySkips = new Map<string, Map<string, Set<string>>>();
const memoryBugs = new Map<string, Map<string, ConfirmedBug[]>>();

function weekChecksKey(weekId: string): string {
  return weekId;
}

function getMemoryWeekChecks(weekId: string): Map<string, Set<string>> {
  let week = memoryChecks.get(weekId);
  if (!week) {
    week = new Map();
    memoryChecks.set(weekId, week);
  }
  return week;
}

function getMemoryWeekBugs(weekId: string): Map<string, ConfirmedBug[]> {
  let week = memoryBugs.get(weekId);
  if (!week) {
    week = new Map();
    memoryBugs.set(weekId, week);
  }
  return week;
}

function getMemoryWeekCarrySkips(weekId: string): Map<string, Set<string>> {
  let week = memoryCarrySkips.get(weekId);
  if (!week) {
    week = new Map();
    memoryCarrySkips.set(weekId, week);
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

async function loadCarrySkips(
  weekId: string,
): Promise<Record<string, string[]>> {
  await ensureSchema();
  const db = getDb();

  if (!db) {
    const week = memoryCarrySkips.get(weekId);
    return week ? toByDate(week) : {};
  }

  const rows = (await db`
    SELECT check_date, row_id
    FROM checklist_carry_skips
    WHERE week_id = ${weekId}
    ORDER BY check_date, row_id
  `) as ChecklistCheckRow[];

  const byDate: Record<string, string[]> = {};
  for (const row of rows) {
    const date = String(row.check_date);
    const rowId = String(row.row_id);
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(rowId);
  }

  return byDate;
}

export async function getChecklistWeekState(
  weekId: string,
): Promise<ChecklistWeekState> {
  await ensureSchema();
  const db = getDb();

  if (!db) {
    const week = memoryChecks.get(weekId);
    const skips = memoryCarrySkips.get(weekId);
    return {
      byDate: week ? toByDate(week) : {},
      carrySkips: skips ? toByDate(skips) : {},
    };
  }

  const rows = (await db`
    SELECT check_date, row_id
    FROM checklist_checks
    WHERE week_id = ${weekId}
    ORDER BY check_date, row_id
  `) as ChecklistCheckRow[];

  const byDate: Record<string, string[]> = {};
  for (const row of rows) {
    const date = String(row.check_date);
    const rowId = String(row.row_id);
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(rowId);
  }

  const carrySkips = await loadCarrySkips(weekId);

  return { byDate, carrySkips };
}

export async function setChecklistItem(
  weekId: string,
  checkDate: string,
  rowId: string,
  checked: boolean,
): Promise<void> {
  await ensureSchema();
  const db = getDb();

  if (!db) {
    const week = getMemoryWeekChecks(weekId);
    const skips = getMemoryWeekCarrySkips(weekId);
    const dateSet = week.get(checkDate) ?? new Set<string>();
    const skipSet = skips.get(checkDate) ?? new Set<string>();

    if (checked) {
      dateSet.add(rowId);
      skipSet.delete(rowId);
    } else {
      dateSet.delete(rowId);
      skipSet.add(rowId);
    }

    if (dateSet.size === 0) week.delete(checkDate);
    else week.set(checkDate, dateSet);

    if (skipSet.size === 0) skips.delete(checkDate);
    else skips.set(checkDate, skipSet);
    return;
  }

  if (checked) {
    await db`
      INSERT INTO checklist_checks (week_id, check_date, row_id)
      VALUES (${weekId}, ${checkDate}, ${rowId})
      ON CONFLICT (week_id, check_date, row_id) DO UPDATE
      SET checked_at = NOW()
    `;
    await db`
      DELETE FROM checklist_carry_skips
      WHERE week_id = ${weekId}
        AND check_date = ${checkDate}
        AND row_id = ${rowId}
    `;
    return;
  }

  await db`
    DELETE FROM checklist_checks
    WHERE week_id = ${weekId}
      AND check_date = ${checkDate}
      AND row_id = ${rowId}
  `;
  await db`
    INSERT INTO checklist_carry_skips (week_id, check_date, row_id)
    VALUES (${weekId}, ${checkDate}, ${rowId})
    ON CONFLICT (week_id, check_date, row_id) DO UPDATE
    SET skipped_at = NOW()
  `;
}

export async function setChecklistBatch(
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
      INSERT INTO checklist_checks (week_id, check_date, row_id)
      VALUES (${weekId}, ${checkDate}, ${rowId})
      ON CONFLICT (week_id, check_date, row_id) DO UPDATE
      SET checked_at = NOW()
    `;
  }
}

export async function clearChecklistRowFromDates(
  weekId: string,
  rowId: string,
  dates: string[],
): Promise<void> {
  if (dates.length === 0) return;
  await ensureSchema();
  const db = getDb();

  if (!db) {
    const week = getMemoryWeekChecks(weekId);
    const skips = getMemoryWeekCarrySkips(weekId);
    for (const checkDate of dates) {
      const dateSet = week.get(checkDate);
      dateSet?.delete(rowId);
      if (dateSet?.size === 0) week.delete(checkDate);

      const skipSet = skips.get(checkDate);
      skipSet?.delete(rowId);
      if (skipSet?.size === 0) skips.delete(checkDate);
    }
    return;
  }

  for (const checkDate of dates) {
    await db`
      DELETE FROM checklist_checks
      WHERE week_id = ${weekId}
        AND check_date = ${checkDate}
        AND row_id = ${rowId}
    `;
    await db`
      DELETE FROM checklist_carry_skips
      WHERE week_id = ${weekId}
        AND check_date = ${checkDate}
        AND row_id = ${rowId}
    `;
  }
}

export async function getConfirmedBugs(
  weekId: string,
  checkDate: string,
): Promise<ConfirmedBug[]> {
  await ensureSchema();
  const db = getDb();

  if (!db) {
    const week = memoryBugs.get(weekId);
    return week?.get(checkDate) ?? [];
  }

  const rows = (await db`
    SELECT row_id, event_name, placement, cdn_url, check_date
    FROM confirmed_bugs
    WHERE week_id = ${weekId}
      AND check_date = ${checkDate}
    ORDER BY confirmed_at
  `) as ConfirmedBugRow[];

  return rows.map((row) => ({
    id: String(row.row_id),
    eventName: String(row.event_name),
    placement: String(row.placement) as ConfirmedBug['placement'],
    cdnUrl: row.cdn_url ? String(row.cdn_url) : null,
    date: String(row.check_date),
  }));
}

export async function addConfirmedBug(
  weekId: string,
  bug: ConfirmedBug,
): Promise<void> {
  await ensureSchema();
  const db = getDb();

  if (!db) {
    const week = getMemoryWeekBugs(weekId);
    const existing = week.get(bug.date) ?? [];
    if (existing.some((item) => item.id === bug.id)) return;
    week.set(bug.date, [...existing, bug]);
    return;
  }

  await db`
    INSERT INTO confirmed_bugs (
      week_id,
      check_date,
      row_id,
      event_name,
      placement,
      cdn_url
    )
    VALUES (
      ${weekId},
      ${bug.date},
      ${bug.id},
      ${bug.eventName},
      ${bug.placement},
      ${bug.cdnUrl}
    )
    ON CONFLICT (week_id, check_date, row_id) DO NOTHING
  `;
}

export function storageBackend(): 'neon' | 'memory' {
  return isDbEnabled() ? 'neon' : 'memory';
}

export function clearMemoryStorageForTests(): void {
  memoryChecks.clear();
  memoryCarrySkips.clear();
  memoryBugs.clear();
}
