import type { ChecklistGroup, SplashRecord } from '../types';
import {
  endsOnDate,
  isActiveOnDate,
  sameCalendarDay,
  startsOnDate,
} from './date';

export interface GroupedSplashChecklist {
  appear: SplashRecord[];
  disappear: SplashRecord[];
  active: SplashRecord[];
}

export function groupSplashChecklistRows(
  rows: SplashRecord[],
  selectedDate: string,
): GroupedSplashChecklist {
  const appear: SplashRecord[] = [];
  const disappear: SplashRecord[] = [];
  const active: SplashRecord[] = [];

  for (const row of rows) {
    if (!row.start && !row.end) continue;
    const start = row.start ?? '';
    const end = row.end ?? start;
    const starts = startsOnDate(start, selectedDate);
    const ends = endsOnDate(end, selectedDate);
    const stillActive = isActiveOnDate(start, end, selectedDate);

    if (starts) appear.push(row);
    if (ends) disappear.push(row);
    if (stillActive) active.push(row);
  }

  return { appear, disappear, active };
}

export function sortBySortId(rows: SplashRecord[]): SplashRecord[] {
  return [...rows].sort((a, b) => {
    const aSort = a.sortId ?? Number.MAX_SAFE_INTEGER;
    const bSort = b.sortId ?? Number.MAX_SAFE_INTEGER;
    if (aSort !== bSort) return aSort - bSort;
    return a.descDisplay.localeCompare(b.descDisplay);
  });
}

export function duplicateSortIds(rows: SplashRecord[]): Set<number> {
  const counts = new Map<number, number>();
  for (const row of rows) {
    if (row.sortId === null) continue;
    counts.set(row.sortId, (counts.get(row.sortId) ?? 0) + 1);
  }
  const dupes = new Set<number>();
  for (const [sortId, count] of counts.entries()) {
    if (count > 1) dupes.add(sortId);
  }
  return dupes;
}

export function isSameDaySplash(row: SplashRecord): boolean {
  if (!row.start || !row.end) return false;
  return sameCalendarDay(row.start, row.end);
}

export function resolveSplashCheckedForDate(
  byDate: Record<string, string[]>,
  selectedDate: string,
  monthDays: string[],
  activeRowIds: string[],
): { checkedIds: Set<string>; carryOverIds: string[] } {
  const checkedIds = new Set(byDate[selectedDate] ?? []);
  const carryOverIds: string[] = [];
  const previousDays = monthDays.filter((day) => day < selectedDate);

  for (const rowId of activeRowIds) {
    if (checkedIds.has(rowId)) continue;
    const carried = previousDays.some((day) => byDate[day]?.includes(rowId));
    if (carried) {
      checkedIds.add(rowId);
      carryOverIds.push(rowId);
    }
  }

  return { checkedIds, carryOverIds };
}

export function splashGroupTitle(group: ChecklistGroup): string {
  switch (group) {
    case 'appear':
      return 'Should APPEAR today';
    case 'disappear':
      return 'Should DISAPPEAR today';
    case 'active':
      return 'Still active';
  }
}

export function currentMonthId(): string {
  const now = new Date();
  const parts = now.toLocaleDateString('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
  });
  return parts.slice(0, 7);
}

export function shiftMonthId(monthId: string, delta: number): string {
  const [year, month] = monthId.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function formatMonthLabel(monthId: string): string {
  const [year, month] = monthId.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function defaultDateForMonth(days: string[]): string {
  const today = new Date().toLocaleDateString('en-CA', {
    timeZone: 'Asia/Jakarta',
  });
  if (days.includes(today)) return today;
  return days[0] ?? today;
}
