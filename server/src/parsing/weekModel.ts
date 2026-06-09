import {
  defaultSelectedDate,
  formatWeekLabel,
  isRelevantSubWeek,
  parseDateRangeLabel,
  parseSubWeekInTabContext,
  parseTabNameRange,
  todayWib,
} from './dateUtils.js';
import { SECTION_ALIASES } from './constants.js';
import type { SubWeek } from '../types.js';

export type GridRow = (string | number | boolean | null | undefined)[];

function isSectionHeaderRow(row: GridRow): boolean {
  const colA = String(row[0] ?? '').trim();
  const colB = String(row[1] ?? '').trim();
  if (!colA || !colB) return false;
  if (!(colA in SECTION_ALIASES)) return false;
  return parseDateRangeLabel(colB) !== null || /\d{1,2}\s*-\s*\d{1,2}/.test(colB);
}

export function extractSubWeekLabels(grid: GridRow[]): string[] {
  const labels = new Set<string>();
  for (const row of grid) {
    if (isSectionHeaderRow(row)) {
      labels.add(String(row[1]).trim());
    }
  }
  return [...labels];
}

export function buildSubWeeksFromTab(tabName: string, grid: GridRow[]): SubWeek[] {
  const tabRange = parseTabNameRange(tabName);
  if (!tabRange) return [];

  const labels = extractSubWeekLabels(grid);
  const subWeeks: SubWeek[] = [];

  for (const label of labels) {
    const range = parseSubWeekInTabContext(label, tabRange);
    if (!range || !isRelevantSubWeek(range)) continue;
    const id = `${tabName}::${label}`;
    subWeeks.push({
      id,
      label: formatWeekLabel(range),
      tabName,
      start: range.start,
      end: range.end,
    });
  }

  return subWeeks.sort((a, b) => b.start.localeCompare(a.start));
}

export function getLatestSubWeeks(
  tabsWithGrids: Array<{ tabName: string; grid: GridRow[] }>,
  count = 4,
  todayIso: string = todayWib(),
): SubWeek[] {
  const all: SubWeek[] = [];
  for (const { tabName, grid } of tabsWithGrids) {
    all.push(...buildSubWeeksFromTab(tabName, grid));
  }

  const unique = new Map<string, SubWeek>();
  for (const week of all.sort((a, b) => b.start.localeCompare(a.start))) {
    const key = `${week.start}|${week.end}`;
    if (!unique.has(key)) unique.set(key, week);
  }

  return [...unique.values()]
    .filter((week) => isRelevantSubWeek(week, todayIso))
    .sort((a, b) => b.start.localeCompare(a.start))
    .slice(0, count);
}

export function findSubWeekForDate(
  weeks: SubWeek[],
  isoDate: string,
): SubWeek | null {
  return (
    weeks.find((week) => isoDate >= week.start && isoDate <= week.end) ?? null
  );
}

export function getDefaultDateForWeek(week: SubWeek): string {
  return defaultSelectedDate({ start: week.start, end: week.end });
}
