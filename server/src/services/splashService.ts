import { DateTime } from 'luxon';
import { config } from '../config.js';
import {
  clearSplashCache,
  getSplashCache,
  setSplashCache,
} from '../splashCache.js';

export { clearSplashCache };
import { fetchSplashSettingsGrid } from '../google/splashSheetsClient.js';
import {
  normalizeDescForLookup,
  parseSplashGrid,
} from '../parsing/splashParser.js';
import { WIB } from '../parsing/dateUtils.js';
import { getAllBannerRows } from './dataService.js';
import type {
  BannerRow,
  CanonicalPlacement,
  GoposLookupResult,
  SplashMonthDetailResponse,
  SplashMonthSummary,
  SplashMonthsResponse,
  SplashRecord,
} from '../types.js';

/** Gacha rows often reuse event names but use placement-specific GoPos — skip for splash lookup. */
const GOPOS_LOOKUP_EXCLUDED_PLACEMENTS = new Set<CanonicalPlacement>([
  'Gacha / Luck Royale',
]);

function isGoposLookupEligible(row: BannerRow): boolean {
  return !GOPOS_LOOKUP_EXCLUDED_PLACEMENTS.has(row.placement);
}

interface BannerCandidate {
  gopos: string;
  subGopos: string;
}

function bannerEventName(row: BannerRow): string {
  return (row.displayName || row.namaTab || '').trim();
}

function pairKey(gopos: string, subGopos: string): string {
  return `${gopos}::${subGopos}`;
}

function allAgree(items: BannerCandidate[]): boolean {
  if (items.length === 0) return false;
  const first = pairKey(items[0].gopos, items[0].subGopos);
  return items.every((item) => pairKey(item.gopos, item.subGopos) === first);
}

function toCandidate(row: BannerRow): BannerCandidate | null {
  const gopos = row.gopos ?? '';
  const subGopos = row.subGopos ?? '';
  if (!gopos && !subGopos) return null;
  return { gopos, subGopos };
}

export class BannerLookupIndex {
  private exactByName = new Map<string, BannerCandidate[]>();

  constructor(bannerRows: BannerRow[]) {
    for (const row of bannerRows) {
      if (!isGoposLookupEligible(row)) continue;
      const name = bannerEventName(row).trim().toLowerCase();
      if (!name) continue;
      const candidate = toCandidate(row);
      if (!candidate) continue;
      const list = this.exactByName.get(name) ?? [];
      list.push(candidate);
      this.exactByName.set(name, list);
    }
  }

  lookup(splashDesc: string): GoposLookupResult {
    const normalized = normalizeDescForLookup(splashDesc);
    if (!normalized) return { status: 'not_found' };

    const matches = this.exactByName.get(normalized) ?? [];
    if (matches.length < 1 || !allAgree(matches)) {
      return { status: 'not_found' };
    }

    return {
      status: 'suggested',
      gopos: matches[0].gopos,
      subGopos: matches[0].subGopos,
      matchCount: matches.length,
    };
  }
}

export function lookupGopos(
  splashDesc: string,
  bannerRows: BannerRow[],
): GoposLookupResult {
  return new BannerLookupIndex(bannerRows).lookup(splashDesc);
}

export function enrichWithGopos(
  records: SplashRecord[],
  lookup: BannerLookupIndex,
): SplashRecord[] {
  return records.map((record) => {
    if (record.sheetGopos || record.sheetSubGopos) {
      return record;
    }
    return {
      ...record,
      goposLookup: lookup.lookup(record.desc),
    };
  });
}

let bannerLookupIndex: BannerLookupIndex | null = null;

export async function getBannerLookupIndex(): Promise<BannerLookupIndex> {
  if (!bannerLookupIndex) {
    bannerLookupIndex = new BannerLookupIndex(await getAllBannerRows());
  }
  return bannerLookupIndex;
}

export function resetBannerLookupIndexForTests(): void {
  bannerLookupIndex = null;
}

export function filterRecentWeeks(
  records: SplashRecord[],
  weeks: number,
): SplashRecord[] {
  const cutoff = DateTime.now().setZone(WIB).minus({ weeks }).startOf('day');

  return records.filter((record) => {
    const end = record.end
      ? DateTime.fromISO(record.end, { zone: WIB })
      : null;
    const start = record.start
      ? DateTime.fromISO(record.start, { zone: WIB })
      : null;

    if (!start && !end) return true;
    if (end?.isValid && end >= cutoff) return true;
    if (start?.isValid && start >= cutoff) return true;
    return false;
  });
}

/** Fetches recent bottom rows (D:Z) from ID - Settings, parses, caches without GoPos. */
export async function loadParsedRecords(): Promise<SplashRecord[]> {
  const cached = getSplashCache();
  if (cached) return cached.records;

  const grid = await fetchSplashSettingsGrid();
  const parsed = filterRecentWeeks(
    parseSplashGrid(grid, config.cdnBaseUrl),
    config.splashRecentWeeks,
  );

  setSplashCache({ grid, records: parsed });
  return parsed;
}

async function recordsForMonth(
  monthId: string,
  withGopos: boolean,
): Promise<SplashRecord[]> {
  const all = await loadParsedRecords();
  let records = filterByMonth(all, monthId);
  if (!withGopos) return records;

  const lookup = await getBannerLookupIndex();
  records = enrichWithGopos(records, lookup);
  return records;
}

function monthLabel(monthId: string): string {
  const dt = DateTime.fromFormat(monthId, 'yyyy-MM', { zone: WIB });
  return dt.isValid ? dt.toFormat('MMMM yyyy') : monthId;
}

function summarizeMonth(
  records: SplashRecord[],
): Omit<SplashMonthSummary, 'monthId' | 'label'> {
  return {
    total: records.length,
    trelloDone: records.filter((r) => r.status === 'trello_done').length,
    needToUpdate: records.filter((r) => r.status === 'need_to_update_trello')
      .length,
    scheduled: records.filter((r) => r.status === 'scheduled').length,
  };
}

function monthsRecordSpans(record: SplashRecord): string[] {
  if (!record.start && !record.end) {
    return record.monthId ? [record.monthId] : [];
  }

  const startDt = record.start
    ? DateTime.fromISO(record.start, { zone: WIB })
    : null;
  const endDt = record.end ? DateTime.fromISO(record.end, { zone: WIB }) : null;
  const rangeStart = (startDt?.isValid ? startDt : endDt)?.startOf('month');
  const rangeEnd = (endDt?.isValid ? endDt : startDt)?.startOf('month');
  if (!rangeStart?.isValid || !rangeEnd?.isValid) {
    return record.monthId ? [record.monthId] : [];
  }

  const months: string[] = [];
  let cursor = rangeStart;
  while (cursor <= rangeEnd) {
    months.push(cursor.toFormat('yyyy-MM'));
    cursor = cursor.plus({ months: 1 });
  }
  return months;
}

export function recordOverlapsMonth(
  record: SplashRecord,
  monthId: string,
): boolean {
  if (monthId === 'undated') {
    return monthsRecordSpans(record).length === 0;
  }
  return monthsRecordSpans(record).includes(monthId);
}

function isValidMonthId(monthId: string): boolean {
  if (monthId === 'undated') return true;
  return DateTime.fromFormat(monthId, 'yyyy-MM', { zone: WIB }).isValid;
}

function buildMonthSummaries(records: SplashRecord[]): SplashMonthSummary[] {
  const byMonth = new Map<string, SplashRecord[]>();
  const undated: SplashRecord[] = [];

  for (const record of records) {
    const spans = monthsRecordSpans(record);
    if (spans.length === 0) {
      undated.push(record);
      continue;
    }
    for (const monthKey of spans) {
      const list = byMonth.get(monthKey) ?? [];
      list.push(record);
      byMonth.set(monthKey, list);
    }
  }

  const months = [...byMonth.entries()]
    .map(([monthId, monthRecords]) => ({
      monthId,
      label: monthLabel(monthId),
      ...summarizeMonth(monthRecords),
    }))
    .sort((a, b) => b.monthId.localeCompare(a.monthId));

  if (undated.length > 0) {
    months.push({
      monthId: 'undated',
      label: 'Undated',
      ...summarizeMonth(undated),
    });
  }

  return months;
}

function daysInMonth(monthId: string): string[] {
  if (monthId === 'undated') return [];
  const start = DateTime.fromFormat(monthId, 'yyyy-MM', { zone: WIB }).startOf(
    'month',
  );
  if (!start.isValid) return [];
  const end = start.endOf('month');
  const days: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    days.push(cursor.toISODate()!);
    cursor = cursor.plus({ days: 1 });
  }
  return days;
}

export function recordOverlapsDate(record: SplashRecord, isoDate: string): boolean {
  if (!record.start && !record.end) return false;
  const dayStart = DateTime.fromISO(isoDate, { zone: WIB }).startOf('day');
  const dayEnd = dayStart.endOf('day');
  const start = record.start
    ? DateTime.fromISO(record.start, { zone: WIB })
    : null;
  const end = record.end ? DateTime.fromISO(record.end, { zone: WIB }) : null;

  if (start && end) {
    return start <= dayEnd && end >= dayStart;
  }
  if (start) return start <= dayEnd;
  if (end) return end >= dayStart;
  return false;
}

function filterByMonth(
  records: SplashRecord[],
  monthId: string,
): SplashRecord[] {
  return records.filter((r) => recordOverlapsMonth(r, monthId));
}

function buildDetailSummary(records: SplashRecord[]) {
  const base = summarizeMonth(records);
  return {
    ...base,
    ready: records.filter((r) => r.toolCSection === 'ready').length,
    assetNotReady: records.filter((r) => r.toolCSection === 'asset_not_ready')
      .length,
    needsReview: records.filter((r) => r.toolCSection === 'needs_review').length,
  };
}

export function isSplashConfigured(): boolean {
  return Boolean(config.splashSheetId);
}

export async function fetchSplashMonths(): Promise<SplashMonthsResponse> {
  const records = await loadParsedRecords();
  return { months: buildMonthSummaries(records) };
}

export async function fetchSplashMonth(
  monthId: string,
  dateFilter?: string,
): Promise<SplashMonthDetailResponse | null> {
  if (!isValidMonthId(monthId)) {
    return null;
  }

  let records = await recordsForMonth(monthId, true);
  if (dateFilter) {
    records = records.filter((r) => recordOverlapsDate(r, dateFilter));
  }

  return {
    monthId,
    label: monthLabel(monthId),
    days: daysInMonth(monthId),
    records,
    summary: buildDetailSummary(records),
  };
}

export async function findSplashMonthForDate(
  isoDate: string,
): Promise<string | null> {
  const dt = DateTime.fromISO(isoDate, { zone: WIB });
  if (!dt.isValid) return null;
  return dt.toFormat('yyyy-MM');
}

export async function refreshSplashData(): Promise<SplashMonthsResponse> {
  clearSplashCache();
  resetBannerLookupIndexForTests();
  return fetchSplashMonths();
}

export function resetSplashServiceForTests(): void {
  clearSplashCache();
  resetBannerLookupIndexForTests();
}
