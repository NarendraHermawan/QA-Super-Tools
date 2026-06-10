import type { SplashRecord } from '../types';
import { overlapsDate } from './date';
import {
  toolCSectionForRecord,
  type SplashUploadOverrides,
} from './splashUploadOverrides';

export function applySplashDayFilter(
  records: SplashRecord[],
  activeDate: string,
  viewAllWeek: boolean,
): SplashRecord[] {
  if (viewAllWeek) return records;
  return records.filter((record) => {
    const start = record.start ?? '';
    const end = record.end ?? start;
    if (!start && !end) return false;
    return overlapsDate(start, end, activeDate);
  });
}

export function applyToolCSplashFilters(
  records: SplashRecord[],
  {
    activeDate,
    viewAllWeek,
    includeUploaded,
    uploadOverrides,
  }: {
    activeDate: string;
    viewAllWeek: boolean;
    includeUploaded: boolean;
    uploadOverrides: SplashUploadOverrides;
  },
): SplashRecord[] {
  let result = applySplashDayFilter(records, activeDate, viewAllWeek);
  if (!includeUploaded) {
    result = result.filter(
      (record) =>
        toolCSectionForRecord(record, uploadOverrides) !== 'uploaded',
    );
  }
  return result;
}

export function countSplashMetrics(
  weekRecords: SplashRecord[],
  filteredRecords: SplashRecord[],
  uploadOverrides: SplashUploadOverrides,
) {
  const ready = weekRecords.filter(
    (r) => toolCSectionForRecord(r, uploadOverrides) === 'ready',
  ).length;
  const blocked = weekRecords.filter(
    (r) => toolCSectionForRecord(r, uploadOverrides) === 'blocked',
  ).length;
  const marked = weekRecords.filter(
    (r) => uploadOverrides[r.id] === true && r.status === 'trello_done',
  ).length;
  return {
    ready,
    blocked,
    marked,
    shown: filteredRecords.length,
  };
}
