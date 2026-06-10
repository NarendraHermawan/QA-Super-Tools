import { eachDayInRange } from '../parsing/dateUtils.js';
import { clearCache } from '../cache.js';
import {
  fetchWeeks,
  findWeekForDate,
} from './dataService.js';
import type {
  SplashRecord,
  SplashWeekDetailResponse,
  SplashWeekSummary,
  SubWeek,
  WeeksResponse,
} from '../types.js';
import {
  clearSplashCache,
  enrichWithGopos,
  getBannerLookupIndex,
  loadParsedRecords,
  recordOverlapsDate,
  resetBannerLookupIndexForTests,
} from './splashService.js';

export function recordOverlapsWeekRange(
  record: SplashRecord,
  weekStart: string,
  weekEnd: string,
): boolean {
  if (!record.start && !record.end) return false;
  const start = (record.start ?? record.end)!.slice(0, 10);
  const end = (record.end ?? record.start)!.slice(0, 10);
  return start <= weekEnd && end >= weekStart;
}

function buildDetailSummary(records: SplashRecord[]): SplashWeekSummary {
  return {
    total: records.length,
    trelloDone: records.filter((r) => r.status === 'trello_done').length,
    needToUpdate: records.filter((r) => r.status === 'need_to_update_trello')
      .length,
    scheduled: records.filter((r) => r.status === 'scheduled').length,
    ready: records.filter((r) => r.toolCSection === 'ready').length,
    assetNotReady: records.filter((r) => r.toolCSection === 'asset_not_ready')
      .length,
    needsReview: records.filter((r) => r.toolCSection === 'needs_review').length,
  };
}

async function findWeekById(weekId: string): Promise<SubWeek | null> {
  const { weeks } = await fetchWeeks();
  return weeks.find((week) => week.id === weekId) ?? null;
}

export async function fetchSplashWeeks(): Promise<WeeksResponse> {
  return fetchWeeks();
}

export async function fetchSplashWeekForDate(
  isoDate: string,
): Promise<{ week: SubWeek } | null> {
  const week = await findWeekForDate(isoDate);
  if (!week) return null;
  return { week };
}

export async function fetchSplashWeekById(
  weekId: string,
  dateFilter?: string,
): Promise<SplashWeekDetailResponse | null> {
  const week = await findWeekById(weekId);
  if (!week) return null;

  const all = await loadParsedRecords();
  let records = all.filter((record) =>
    recordOverlapsWeekRange(record, week.start, week.end),
  );

  if (dateFilter) {
    records = records.filter((record) => recordOverlapsDate(record, dateFilter));
  }

  const lookup = await getBannerLookupIndex();
  records = enrichWithGopos(records, lookup);

  return {
    week,
    days: eachDayInRange({ start: week.start, end: week.end }),
    records,
    summary: buildDetailSummary(records),
  };
}

export async function refreshSplashWeekData(): Promise<WeeksResponse> {
  clearSplashCache();
  clearCache();
  resetBannerLookupIndexForTests();
  return fetchSplashWeeks();
}
