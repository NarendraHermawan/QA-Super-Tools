import type { SplashChecklistGroups, SplashRecord } from '../types';
import {
  endsOnDate,
  isActiveOnDate,
  startsOnDate,
} from './date';

export function groupSplashChecklistRows(
  records: SplashRecord[],
  selectedDate: string,
): SplashChecklistGroups {
  const appear: SplashRecord[] = [];
  const disappear: SplashRecord[] = [];
  const active: SplashRecord[] = [];

  for (const record of records) {
    if (startsOnDate(record.start, selectedDate)) appear.push(record);
    if (endsOnDate(record.end, selectedDate)) disappear.push(record);
    if (isActiveOnDate(record.start, record.end, selectedDate)) {
      active.push(record);
    }
  }

  return { appear, disappear, active };
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

export function splashStatusLabel(status: SplashRecord['status']): string {
  switch (status) {
    case 'TRELLO DONE':
      return 'Trello done';
    case 'NEED TO UPDATE TRELLO':
      return 'Need Trello update';
    case 'SCHEDULED':
      return 'Scheduled';
    case 'DONE':
      return 'Done';
    default:
      return 'Unknown status';
  }
}

export function splashStatusVariant(
  status: SplashRecord['status'],
): 'ok' | 'warn' | 'error' | 'neutral' {
  switch (status) {
    case 'TRELLO DONE':
    case 'DONE':
      return 'ok';
    case 'NEED TO UPDATE TRELLO':
      return 'error';
    case 'SCHEDULED':
      return 'neutral';
    default:
      return 'warn';
  }
}

export type UploadAssetGroup = 'splash' | 'anno' | 'both';

export interface MergedUploadRow {
  key: string;
  sourceRowIndex: number;
  desc: string;
  group: UploadAssetGroup;
  splash?: SplashRecord;
  anno?: SplashRecord;
  record?: SplashRecord;
}

export function mergeUploadRowsForDisplay(
  records: SplashRecord[],
): MergedUploadRow[] {
  const bySource = new Map<number, SplashRecord[]>();
  for (const r of records) {
    const list = bySource.get(r.sourceRowIndex) ?? [];
    list.push(r);
    bySource.set(r.sourceRowIndex, list);
  }

  const merged: MergedUploadRow[] = [];

  for (const [sourceRowIndex, group] of bySource) {
    const splash = group.find((r) => r.assetType === 'splash');
    const anno = group.find((r) => r.assetType === 'anno');

    if (splash && anno && !splash.cdnUrl && !anno.cdnUrl) {
      merged.push({
        key: `both-${sourceRowIndex}`,
        sourceRowIndex,
        desc: splash.desc || anno.desc,
        group: 'both',
        splash,
        anno,
      });
      continue;
    }

    for (const record of group) {
      merged.push({
        key: record.recordId,
        sourceRowIndex,
        desc: record.desc,
        group: record.assetType,
        record,
        splash: record.assetType === 'splash' ? record : undefined,
        anno: record.assetType === 'anno' ? record : undefined,
      });
    }
  }

  return merged;
}

export function groupMergedUploadByAsset(
  rows: MergedUploadRow[],
): Record<UploadAssetGroup, MergedUploadRow[]> {
  const splash: MergedUploadRow[] = [];
  const anno: MergedUploadRow[] = [];
  const both: MergedUploadRow[] = [];

  for (const row of rows) {
    if (row.group === 'both') both.push(row);
    else if (row.group === 'splash') splash.push(row);
    else anno.push(row);
  }

  return { splash, anno, both };
}
