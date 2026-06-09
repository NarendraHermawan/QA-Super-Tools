import { DateTime } from 'luxon';
import { parseTabNameRange, todayWib, WIB } from './dateUtils.js';
import type { ParsedTab } from '../types.js';

export function isValidWeekTab(tabName: string): boolean {
  return parseTabNameRange(tabName) !== null;
}

export function parseTab(tabName: string): ParsedTab | null {
  const range = parseTabNameRange(tabName);
  if (!range) return null;
  return { name: tabName, range };
}

export function sortTabsByRecency(tabs: ParsedTab[]): ParsedTab[] {
  return [...tabs].sort((a, b) => b.range.end.localeCompare(a.range.end));
}

export function getRecentTabs(tabNames: string[], limit = 6): ParsedTab[] {
  const parsed = tabNames
    .map(parseTab)
    .filter((tab): tab is ParsedTab => tab !== null);
  return sortTabsByRecency(parsed).slice(0, limit);
}

/** Tabs whose date range overlaps a window around today (avoids far-future year-end tabs). */
export function getTabsNearToday(
  tabNames: string[],
  weeksBefore = 8,
  weeksAfter = 2,
  todayIso: string = todayWib(),
): ParsedTab[] {
  const today = DateTime.fromISO(todayIso, { zone: WIB });
  const windowStart = today.minus({ weeks: weeksBefore }).toISODate()!;
  const windowEnd = today.plus({ weeks: weeksAfter }).toISODate()!;

  return tabNames
    .map(parseTab)
    .filter((tab): tab is ParsedTab => tab !== null)
    .filter(
      (tab) =>
        tab.range.end >= windowStart && tab.range.start <= windowEnd,
    )
    .sort((a, b) => b.range.end.localeCompare(a.range.end));
}
