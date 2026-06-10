import type { SplashRecord, SplashStatus } from '../types';

export type SplashUploadOverrides = Record<string, boolean>;

export function canMarkSplashUploaded(status: SplashStatus): boolean {
  return status === 'trello_done' || status === 'need_to_update_trello';
}

export function effectiveSplashUploaded(
  record: SplashRecord,
  overrides: SplashUploadOverrides,
): boolean {
  if (overrides[record.id] === true) return true;
  if (record.status === 'scheduled' || record.status === 'done') return true;
  return false;
}

export function countSplashMarkedUploaded(
  records: SplashRecord[],
  overrides: SplashUploadOverrides,
): number {
  return records.filter(
    (record) =>
      overrides[record.id] === true && canMarkSplashUploaded(record.status),
  ).length;
}

export function toolCSectionForRecord(
  record: SplashRecord,
  overrides: SplashUploadOverrides,
): SplashRecord['toolCSection'] {
  if (effectiveSplashUploaded(record, overrides)) return 'uploaded';
  return record.toolCSection;
}
