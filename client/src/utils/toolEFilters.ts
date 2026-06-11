import type { SplashAssetType, SplashRecord } from '../types';

export type ToolEAssetTab = SplashAssetType | 'all';

export function hasNotionUrl(record: SplashRecord): boolean {
  return Boolean(record.trelloCard?.trim());
}

export function isAlreadyUploadedOnSheet(record: SplashRecord): boolean {
  return record.status === 'scheduled' && Boolean(record.cdnUrl);
}

export function applyToolEFilters(
  records: SplashRecord[],
  {
    assetTab,
    showAlreadyUploaded,
  }: {
    assetTab: ToolEAssetTab;
    showAlreadyUploaded: boolean;
  },
): SplashRecord[] {
  let result = records.filter(hasNotionUrl);

  if (!showAlreadyUploaded) {
    result = result.filter((record) => !isAlreadyUploadedOnSheet(record));
  }

  if (assetTab !== 'all') {
    result = result.filter((record) => record.assetType === assetTab);
  }

  return result;
}

export function countToolEMetrics(records: SplashRecord[]) {
  const eligible = records.filter(hasNotionUrl);
  const splash = eligible.filter((r) => r.assetType === 'splash').length;
  const anno = eligible.filter((r) => r.assetType === 'anno').length;
  return {
    total: eligible.length,
    splash,
    anno,
  };
}
