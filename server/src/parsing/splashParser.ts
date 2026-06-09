import { DateTime } from 'luxon';
import { parseCellDate, toIsoDateTime } from './dateUtils.js';
import type { GridRow } from './weekModel.js';

export type SplashAssetType = 'splash' | 'anno';
export type SplashStatus =
  | 'TRELLO DONE'
  | 'NEED TO UPDATE TRELLO'
  | 'SCHEDULED'
  | 'DONE'
  | 'unknown';

export interface SplashRecord {
  recordId: string;
  sourceRowIndex: number;
  assetType: SplashAssetType;
  desc: string;
  start: string;
  end: string;
  sortId: number | null;
  uniqueId: string;
  cdnUrl: string | null;
  status: SplashStatus;
  goPos: string | null;
  subGoPos: string | null;
}

interface ColMap {
  desc: number;
  startAnno: number;
  endAnno: number;
  startSplash: number;
  endSplash: number;
  sortAnno: number;
  uniqueAnno: number;
  sortSplash: number;
  uniqueSplash: number;
  status: number;
  annoUrl: number;
  splashUrl: number;
  goPos: number;
  subGoPos: number;
}

const FALLBACK_COL: ColMap = {
  desc: 3,
  startAnno: 5,
  endAnno: 6,
  startSplash: 7,
  endSplash: 8,
  sortAnno: 9,
  uniqueAnno: 10,
  sortSplash: 11,
  uniqueSplash: 12,
  status: 13,
  annoUrl: 14,
  splashUrl: 16,
  goPos: 22,
  subGoPos: 23,
};

function cellAt(row: GridRow, index: number): string | number | boolean | null {
  if (index < 0 || index >= row.length) return null;
  const value = row[index];
  return value === undefined ? null : value;
}

function cellStr(row: GridRow, index: number): string {
  const v = cellAt(row, index);
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function normalizeStatus(raw: string): SplashStatus {
  const upper = raw.trim().toUpperCase();
  if (upper === 'TRELLO DONE') return 'TRELLO DONE';
  if (upper === 'NEED TO UPDATE TRELLO') return 'NEED TO UPDATE TRELLO';
  if (upper === 'SCHEDULED') return 'SCHEDULED';
  if (upper === 'DONE') return 'DONE';
  return 'unknown';
}

function parseSortId(raw: string): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function buildColumnMap(headerRow: GridRow): Record<string, number> {
  const map: Record<string, number> = {};
  for (let i = 0; i < headerRow.length; i++) {
    const label = cellStr(headerRow, i).toLowerCase();
    if (!label) continue;
    if (label.includes('desc')) map.desc = i;
    if (label.includes('start anno')) map.startAnno = i;
    if (label.includes('end anno')) map.endAnno = i;
    if (label.includes('start splash')) map.startSplash = i;
    if (label.includes('end splash')) map.endSplash = i;
    if (label.includes('order anno') || label === 'sort anno') map.sortAnno = i;
    if (label.includes('unique id anno') || label === 'unique id anno')
      map.uniqueAnno = i;
    if (
      label.includes('order splash') ||
      label.includes('sort splash') ||
      label.includes('sort_id') ||
      label === 'sort id splash'
    )
      map.sortSplash = i;
    if (label.includes('unique id splash') || label === 'unique id splash')
      map.uniqueSplash = i;
    if (label === 'status' || label.includes('status')) map.status = i;
    if (label.includes('anno banner') || label.includes('265x595'))
      map.annoUrl = i;
    if (label.includes('splash banner') || label.includes('880x520'))
      map.splashUrl = i;
    if (label.includes('gopos') && !label.includes('sub')) map.goPos = i;
    if (label.includes('sub gopos') || label.includes('sub gopos / url'))
      map.subGoPos = i;
  }
  return map;
}

function resolveCols(headerRow: GridRow | null): ColMap {
  if (!headerRow) return { ...FALLBACK_COL };
  const mapped = buildColumnMap(headerRow);
  return {
    desc: mapped.desc ?? FALLBACK_COL.desc,
    startAnno: mapped.startAnno ?? FALLBACK_COL.startAnno,
    endAnno: mapped.endAnno ?? FALLBACK_COL.endAnno,
    startSplash: mapped.startSplash ?? FALLBACK_COL.startSplash,
    endSplash: mapped.endSplash ?? FALLBACK_COL.endSplash,
    sortAnno: mapped.sortAnno ?? FALLBACK_COL.sortAnno,
    uniqueAnno: mapped.uniqueAnno ?? FALLBACK_COL.uniqueAnno,
    sortSplash: mapped.sortSplash ?? FALLBACK_COL.sortSplash,
    uniqueSplash: mapped.uniqueSplash ?? FALLBACK_COL.uniqueSplash,
    status: mapped.status ?? FALLBACK_COL.status,
    annoUrl: mapped.annoUrl ?? FALLBACK_COL.annoUrl,
    splashUrl: mapped.splashUrl ?? FALLBACK_COL.splashUrl,
    goPos: mapped.goPos ?? FALLBACK_COL.goPos,
    subGoPos: mapped.subGoPos ?? FALLBACK_COL.subGoPos,
  };
}

function hasHeaderRow(firstRow: GridRow): boolean {
  const joined = firstRow.map((c) => String(c ?? '').toLowerCase()).join(' ');
  return joined.includes('desc') || joined.includes('status');
}

function parseDateCell(cell: string | number | boolean | null): string {
  if (cell === null || cell === undefined) return '';
  const parsed = parseCellDate(cell);
  return parsed ? toIsoDateTime(parsed) : '';
}

function hasSplashFields(row: GridRow, cols: ColMap): boolean {
  return Boolean(
    cellStr(row, cols.startSplash) ||
      cellStr(row, cols.endSplash) ||
      cellStr(row, cols.uniqueSplash) ||
      cellStr(row, cols.splashUrl),
  );
}

function hasAnnoFields(row: GridRow, cols: ColMap): boolean {
  return Boolean(
    cellStr(row, cols.startAnno) ||
      cellStr(row, cols.endAnno) ||
      cellStr(row, cols.uniqueAnno) ||
      cellStr(row, cols.annoUrl),
  );
}

function makeRecordId(
  assetType: SplashAssetType,
  uniqueId: string,
  sourceRowIndex: number,
): string {
  const base = uniqueId || `row-${sourceRowIndex}`;
  return `${assetType}:${base}`;
}

export function parseSplashGrid(grid: GridRow[]): SplashRecord[] {
  if (grid.length === 0) return [];

  const header = hasHeaderRow(grid[0]) ? grid[0] : null;
  const cols = resolveCols(header);
  const dataRows = header ? grid.slice(1) : grid;
  const records: SplashRecord[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const sourceRowIndex = header ? i + 1 : i;
    const desc = cellStr(row, cols.desc);
    const status = normalizeStatus(cellStr(row, cols.status));
    const goPos = cellStr(row, cols.goPos) || null;
    const subGoPos = cellStr(row, cols.subGoPos) || null;

    if (hasSplashFields(row, cols)) {
      const uniqueId = cellStr(row, cols.uniqueSplash);
      records.push({
        recordId: makeRecordId('splash', uniqueId, sourceRowIndex),
        sourceRowIndex,
        assetType: 'splash',
        desc,
        start: parseDateCell(cellAt(row, cols.startSplash)),
        end: parseDateCell(cellAt(row, cols.endSplash)),
        sortId: parseSortId(cellStr(row, cols.sortSplash)),
        uniqueId,
        cdnUrl: cellStr(row, cols.splashUrl) || null,
        status,
        goPos,
        subGoPos,
      });
    }

    if (hasAnnoFields(row, cols)) {
      const uniqueId = cellStr(row, cols.uniqueAnno);
      records.push({
        recordId: makeRecordId('anno', uniqueId, sourceRowIndex),
        sourceRowIndex,
        assetType: 'anno',
        desc,
        start: parseDateCell(cellAt(row, cols.startAnno)),
        end: parseDateCell(cellAt(row, cols.endAnno)),
        sortId: parseSortId(cellStr(row, cols.sortAnno)),
        uniqueId,
        cdnUrl: cellStr(row, cols.annoUrl) || null,
        status,
        goPos,
        subGoPos,
      });
    }
  }

  return records;
}

export function recordMonthKey(record: SplashRecord): string | null {
  const iso = record.start || record.end;
  if (!iso) return null;
  const dt = DateTime.fromISO(iso, { zone: 'Asia/Jakarta' });
  if (!dt.isValid) return null;
  return dt.toFormat('yyyy-MM');
}

export function filterRecordsByMonth(
  records: SplashRecord[],
  monthId: string,
): SplashRecord[] {
  return records.filter((r) => recordMonthKey(r) === monthId);
}

export function recordActiveOnDate(
  record: SplashRecord,
  dateIso: string,
): boolean {
  if (!record.start && !record.end) return false;
  const day = DateTime.fromISO(dateIso, { zone: 'Asia/Jakarta' }).startOf('day');
  if (!day.isValid) return false;

  const start = record.start
    ? DateTime.fromISO(record.start, { zone: 'Asia/Jakarta' }).startOf('day')
    : null;
  const end = record.end
    ? DateTime.fromISO(record.end, { zone: 'Asia/Jakarta' }).startOf('day')
    : null;

  if (start?.isValid && day < start) return false;
  if (end?.isValid && day > end) return false;
  return true;
}

export function findDuplicateSortIds(
  records: SplashRecord[],
  dateIso: string,
): Set<number> {
  const bySortId = new Map<number, SplashAssetType[]>();
  for (const r of records) {
    if (!recordActiveOnDate(r, dateIso) || r.sortId === null) continue;
    const list = bySortId.get(r.sortId) ?? [];
    list.push(r.assetType);
    bySortId.set(r.sortId, list);
  }

  const dupes = new Set<number>();
  for (const [sortId, types] of bySortId) {
    if (types.length > 1) dupes.add(sortId);
  }
  return dupes;
}

export function findActiveCohortSortIds(
  records: SplashRecord[],
  dateIso: string,
): Set<number> {
  const active = new Set<number>();
  for (const r of records) {
    if (recordActiveOnDate(r, dateIso) && r.sortId !== null) {
      active.add(r.sortId);
    }
  }
  return active;
}
