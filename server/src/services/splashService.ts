import { config, isSplashConfigured } from '../config.js';
import { SplashSheetsClient } from '../google/splashSheetsClient.js';
import {
  filterRecordsByMonth,
  findActiveCohortSortIds,
  findDuplicateSortIds,
  parseSplashGrid,
  recordActiveOnDate,
  recordMonthKey,
  type SplashAssetType,
  type SplashRecord,
  type SplashStatus,
} from '../parsing/splashParser.js';

interface MonthCacheEntry {
  records: SplashRecord[];
  fetchedAt: number;
}

const monthCache = new Map<string, MonthCacheEntry>();
let allRecordsCache: { records: SplashRecord[]; fetchedAt: number } | null =
  null;

function isFresh(fetchedAt: number): boolean {
  return Date.now() - fetchedAt < config.splashCacheTtlMs;
}

async function fetchAllRecords(): Promise<SplashRecord[]> {
  if (allRecordsCache && isFresh(allRecordsCache.fetchedAt)) {
    return allRecordsCache.records;
  }

  const client = new SplashSheetsClient();
  const grid = await client.getSettingsTabValues();
  const records = parseSplashGrid(grid);
  allRecordsCache = { records, fetchedAt: Date.now() };
  monthCache.clear();
  return records;
}

export async function getSplashRecordsForMonth(
  monthId: string,
): Promise<SplashRecord[]> {
  const cached = monthCache.get(monthId);
  if (cached && isFresh(cached.fetchedAt)) {
    return cached.records;
  }

  const all = await fetchAllRecords();
  const records = filterRecordsByMonth(all, monthId);
  monthCache.set(monthId, { records, fetchedAt: Date.now() });
  return records;
}

export async function listSplashMonths(): Promise<string[]> {
  const all = await fetchAllRecords();
  const months = new Set<string>();
  for (const r of all) {
    const key = recordMonthKey(r);
    if (key) months.add(key);
  }
  return [...months].sort();
}

export function filterByDate(
  records: SplashRecord[],
  dateIso: string,
): SplashRecord[] {
  return records.filter((r) => recordActiveOnDate(r, dateIso));
}

export function filterByAssetType(
  records: SplashRecord[],
  assetType: SplashAssetType,
): SplashRecord[] {
  return records.filter((r) => r.assetType === assetType);
}

export function filterByStatus(
  records: SplashRecord[],
  statuses: SplashStatus[],
): SplashRecord[] {
  const set = new Set(statuses);
  return records.filter((r) => set.has(r.status));
}

export function excludeStatuses(
  records: SplashRecord[],
  statuses: SplashStatus[],
): SplashRecord[] {
  const set = new Set(statuses);
  return records.filter((r) => !set.has(r.status));
}

export function getDuplicateSortIds(
  records: SplashRecord[],
  dateIso: string,
): number[] {
  return [...findDuplicateSortIds(records, dateIso)];
}

export function getActiveCohortSortIds(
  records: SplashRecord[],
  dateIso: string,
): number[] {
  return [...findActiveCohortSortIds(records, dateIso)];
}

export async function refreshSplashCache(): Promise<void> {
  allRecordsCache = null;
  monthCache.clear();
  await fetchAllRecords();
}

export function splashServiceStatus(): {
  configured: boolean;
  cacheTtlMs: number;
} {
  return {
    configured: isSplashConfigured(),
    cacheTtlMs: config.splashCacheTtlMs,
  };
}
