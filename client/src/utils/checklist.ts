import type { BannerRow, ChecklistGroup } from '../types';
import {
  endsOnDate,
  isActiveOnDate,
  sameCalendarDay,
  startsOnDate,
} from './date';

export interface GroupedChecklist {
  appear: BannerRow[];
  disappear: BannerRow[];
  active: BannerRow[];
}

export function groupChecklistRows(
  rows: BannerRow[],
  selectedDate: string,
): GroupedChecklist {
  const appear: BannerRow[] = [];
  const disappear: BannerRow[] = [];
  const active: BannerRow[] = [];

  for (const row of rows) {
    const starts = startsOnDate(row.startTime, selectedDate);
    const ends = endsOnDate(row.endTime, selectedDate);
    const stillActive = isActiveOnDate(
      row.startTime,
      row.endTime,
      selectedDate,
    );

    if (starts) appear.push(row);
    if (ends) disappear.push(row);
    if (stillActive) active.push(row);
  }

  return { appear, disappear, active };
}

export function isSingleDayBanner(row: BannerRow): boolean {
  return sameCalendarDay(row.startTime, row.endTime);
}

export function rowStateLabel(state: BannerRow['rowState']): string {
  switch (state) {
    case 'asset_not_ready':
      return 'Asset not ready';
    case 'ready_to_upload':
      return 'Ready to upload';
    case 'uploaded':
      return 'Uploaded';
    case 'inconsistent':
      return 'Inconsistent state';
  }
}

export function rowStateVariant(
  state: BannerRow['rowState'],
): 'error' | 'warn' | 'ok' | 'neutral' {
  switch (state) {
    case 'asset_not_ready':
      return 'error';
    case 'ready_to_upload':
      return 'warn';
    case 'uploaded':
      return 'ok';
    case 'inconsistent':
      return 'warn';
  }
}

export function countCheckedUnique(
  rows: BannerRow[],
  activeDate: string,
  checkedIds: Set<string>,
  viewAllWeek = false,
): { total: number; checked: number } {
  if (viewAllWeek) {
    return {
      total: rows.length,
      checked: rows.filter((r) => checkedIds.has(r.id)).length,
    };
  }
  const grouped = groupChecklistRows(rows, activeDate);
  const all = [
    ...grouped.appear,
    ...grouped.disappear,
    ...grouped.active,
  ];
  const unique = [...new Map(all.map((r) => [r.id, r])).values()];
  return {
    total: unique.length,
    checked: unique.filter((r) => checkedIds.has(r.id)).length,
  };
}

export function groupTitle(group: ChecklistGroup): string {
  switch (group) {
    case 'appear':
      return 'Should APPEAR today';
    case 'disappear':
      return 'Should DISAPPEAR today';
    case 'active':
      return 'Still active';
  }
}
