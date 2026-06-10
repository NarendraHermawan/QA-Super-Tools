import type { BannerRow, RowState } from '../types';

export type UploadOverrides = Record<string, boolean>;

export function effectiveCdnUploaded(
  row: BannerRow,
  overrides: UploadOverrides,
): boolean {
  if (row.id in overrides) return overrides[row.id];
  return row.cdnUploaded;
}

export function effectiveRowState(
  row: BannerRow,
  overrides: UploadOverrides,
): RowState {
  const uploaded = effectiveCdnUploaded(row, overrides);
  if (!row.assetDone && !uploaded) return 'asset_not_ready';
  if (row.assetDone && !uploaded) return 'ready_to_upload';
  if (row.assetDone && uploaded) return 'uploaded';
  return 'inconsistent';
}

export function countMarkedUploaded(overrides: UploadOverrides): number {
  return Object.values(overrides).filter(Boolean).length;
}
