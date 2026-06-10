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
  GoposLookupResult,
  SplashMonthDetailResponse,
  SplashMonthSummary,
  SplashMonthsResponse,
  SplashRecord,
} from '../types.js';

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[b.length][a.length];
}

function matchScore(splashName: string, bannerName: string): number {
  const a = splashName.trim().toLowerCase();
  const b = bannerName.trim().toLowerCase();
  if (!a || !b) return 0;
  if (a === b) return 2;
  if (a.includes(b) || b.includes(a)) return 1;
  if (levenshtein(a, b) <= 2) return 1;
  return 0;
}

interface BannerCandidate {
  gopos: string;
  subGopos: string;
  score: number;
}

function bannerEventName(row: BannerRow): string {
  return (row.displayName || row.namaTab || '').trim();
}

function pairKey(gopos: string, subGopos: string): string {
  return `${gopos}::${subGopos}`;
}

function majorityPair(
  items: BannerCandidate[],
): { gopos: string; subGopos: string; count: number } | null {
  const counts = new Map<string, { gopos: string; subGopos: string; count: number }>();
  for (const item of items) {
    const key = pairKey(item.gopos, item.subGopos);
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { gopos: item.gopos, subGopos: item.subGopos, count: 1 });
  }
  let best: { gopos: string; subGopos: string; count: number } | null = null;
  for (const entry of counts.values()) {
    if (!best || entry.count > best.count) best = entry;
  }
  return best;
}

function allAgree(items: BannerCandidate[]): boolean {
  if (items.length === 0) return false;
  const first = pairKey(items[0].gopos, items[0].subGopos);
  return items.every((item) => pairKey(item.gopos, item.subGopos) === first);
}

function toCandidate(row: BannerRow, score: number): BannerCandidate | null {
  const gopos = row.gopos ?? '';
  const subGopos = row.subGopos ?? '';
  if (!gopos && !subGopos) return null;
  return { gopos, subGopos, score };
}

export class BannerLookupIndex {
  private exactByName = new Map<string, BannerCandidate[]>();
  private fuzzySources: { name: string; row: BannerRow }[] = [];

  constructor(bannerRows: BannerRow[]) {
    for (const row of bannerRows) {
      const name = bannerEventName(row).trim().toLowerCase();
      if (!name) continue;
      const exact = toCandidate(row, 2);
      if (exact) {
        const list = this.exactByName.get(name) ?? [];
        list.push(exact);
        this.exactByName.set(name, list);
      }
      this.fuzzySources.push({ name, row });
    }
  }

  exactFor(normalized: string): BannerCandidate[] {
    return this.exactByName.get(normalized) ?? [];
  }

  fuzzyFor(normalized: string): BannerCandidate[] {
    const candidates: BannerCandidate[] = [];
    for (const { name, row } of this.fuzzySources) {
      if (name === normalized) continue;
      if (matchScore(normalized, name) !== 1) continue;
      const candidate = toCandidate(row, 1);
      if (candidate) candidates.push(candidate);
    }
    return candidates;
  }

  lookup(splashDesc: string): GoposLookupResult {
    const normalized = normalizeDescForLookup(splashDesc);
    if (!normalized) return { status: 'not_found' };

    const exactMatches = this.exactFor(normalized);
    const fuzzyMatches = this.fuzzyFor(normalized);
    if (exactMatches.length === 0 && fuzzyMatches.length === 0) {
      return { status: 'not_found' };
    }
    return resolveGoposCandidates(exactMatches, fuzzyMatches);
  }
}

export function lookupGopos(
  splashDesc: string,
  bannerRows: BannerRow[],
): GoposLookupResult {
  return new BannerLookupIndex(bannerRows).lookup(splashDesc);
}

function resolveGoposCandidates(
  exactMatches: BannerCandidate[],
  fuzzyMatches: BannerCandidate[],
): GoposLookupResult {
  const total = exactMatches.length + fuzzyMatches.length;
  if (total === 0) return { status: 'not_found' };

  if (total < 3) return { status: 'not_found' };

  if (exactMatches.length >= 3) {
    if (allAgree(exactMatches)) {
      return {
        status: 'suggested',
        gopos: exactMatches[0].gopos,
        subGopos: exactMatches[0].subGopos,
        matchType: 'exact',
        matchCount: exactMatches.length,
      };
    }
    const majority = majorityPair(exactMatches);
    if (majority) {
      return {
        status: 'conflict',
        gopos: majority.gopos,
        subGopos: majority.subGopos,
        conflictCount: majority.count,
      };
    }
  }

  if (exactMatches.length >= 1 && total >= 3) {
    const majorityExact = majorityPair(exactMatches);
    if (majorityExact) {
      return {
        status: 'suggested',
        gopos: majorityExact.gopos,
        subGopos: majorityExact.subGopos,
        matchType: 'exact',
        matchCount: exactMatches.length,
      };
    }
  }

  if (exactMatches.length === 0 && fuzzyMatches.length >= 3) {
    if (allAgree(fuzzyMatches)) {
      return {
        status: 'suggested',
        gopos: fuzzyMatches[0].gopos,
        subGopos: fuzzyMatches[0].subGopos,
        matchType: 'fuzzy',
        matchCount: fuzzyMatches.length,
      };
    }
    return { status: 'not_found' };
  }

  return { status: 'not_found' };
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
    blocked: records.filter((r) => r.toolCSection === 'blocked').length,
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
