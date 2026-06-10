import { config } from '../config.js';
import { clearCache, getCache, setCache } from '../cache.js';
import { SheetsClient } from '../google/sheetsClient.js';
import { getTabsToFetch } from '../parsing/tabNameParser.js';
import { buildWeekData } from '../parsing/sectionParser.js';
import { eachDayInRange } from '../parsing/dateUtils.js';
import {
  findSubWeekForDate,
  getLatestSubWeeks,
} from '../parsing/weekModel.js';
import type {
  BannerRow,
  SubWeek,
  WeekDetailResponse,
  WeeksResponse,
} from '../types.js';
import type { GridRow } from '../parsing/weekModel.js';

let sheetsClient: SheetsClient | null = null;

function getSheetsClient(): SheetsClient {
  if (!sheetsClient) sheetsClient = new SheetsClient();
  return sheetsClient;
}

async function loadCache(): Promise<{
  weeks: SubWeek[];
  grids: Record<string, GridRow[]>;
}> {
  const existing = getCache();
  if (existing) {
    return { weeks: existing.weeks, grids: existing.grids };
  }

  const client = getSheetsClient();
  const allTabNames = await client.listTabNames();
  const recentTabs = getTabsToFetch(allTabNames);
  const tabNames = recentTabs.map((tab) => tab.name);
  const grids = await client.getTabsValues(tabNames);

  const tabsWithGrids = tabNames.map((tabName) => ({
    tabName,
    grid: grids[tabName] ?? [],
  }));
  const weeks = getLatestSubWeeks(tabsWithGrids, 4);

  setCache({ tabNames, grids, weeks });
  return { weeks, grids };
}

export async function fetchWeeks(): Promise<WeeksResponse> {
  const { weeks } = await loadCache();
  return { weeks };
}

export async function fetchWeekById(
  weekId: string,
): Promise<WeekDetailResponse | null> {
  const { weeks, grids } = await loadCache();
  const week = weeks.find((item) => item.id === weekId);
  if (!week) return null;

  const grid = grids[week.tabName];
  if (!grid) return null;

  const weekData = buildWeekData(week, grid, config.cdnBaseUrl);
  return {
    week,
    sections: weekData.sections,
    days: eachDayInRange({ start: week.start, end: week.end }),
  };
}

export async function findWeekForDate(
  isoDate: string,
): Promise<SubWeek | null> {
  const { weeks } = await loadCache();
  return findSubWeekForDate(weeks, isoDate);
}

export async function refreshData(): Promise<WeeksResponse> {
  clearCache();
  return fetchWeeks();
}

export function resetSheetsClient(): void {
  sheetsClient = null;
}

export async function getAllBannerRows(): Promise<BannerRow[]> {
  const { weeks, grids } = await loadCache();
  const rows: BannerRow[] = [];

  for (const week of weeks) {
    const grid = grids[week.tabName];
    if (!grid) continue;
    const weekData = buildWeekData(week, grid, config.cdnBaseUrl);
    rows.push(...weekData.allRows);
  }

  return rows;
}
