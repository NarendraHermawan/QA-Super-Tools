import type { SplashAssetType, SplashRecord } from '../types';
import { overlapsDate } from './date';
import {
  toolCSectionForRecord,
  canMarkSplashUploaded,
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

export function applySplashAssetTypeFilter(
  records: SplashRecord[],
  selectedAssetTypes: SplashAssetType[],
): SplashRecord[] {
  if (selectedAssetTypes.length === 0) return records;
  return records.filter((record) =>
    selectedAssetTypes.includes(record.assetType),
  );
}

export function applyToolCSplashFilters(
  records: SplashRecord[],
  {
    activeDate,
    viewAllWeek,
    includeUploaded,
    uploadOverrides,
    selectedAssetTypes = [],
  }: {
    activeDate: string;
    viewAllWeek: boolean;
    includeUploaded: boolean;
    uploadOverrides: SplashUploadOverrides;
    selectedAssetTypes?: SplashAssetType[];
  },
): SplashRecord[] {
  let result = applySplashDayFilter(records, activeDate, viewAllWeek);
  result = applySplashAssetTypeFilter(result, selectedAssetTypes);
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
  const assetNotReady = weekRecords.filter(
    (r) =>
      toolCSectionForRecord(r, uploadOverrides) === 'asset_not_ready',
  ).length;
  const marked = weekRecords.filter(
    (r) =>
      uploadOverrides[r.id] === true && canMarkSplashUploaded(r.status),
  ).length;
  return {
    ready,
    assetNotReady,
    marked,
    shown: filteredRecords.length,
  };
}
