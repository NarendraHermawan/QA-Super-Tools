/**
 * Thin bridge to the web server's splash services.
 * Worker only reads cached sheet data — never mutates sheets.
 */
import { fetchSplashWeekById } from '../../../server/src/services/splashWeekService.js';
import { loadParsedRecords } from '../../../server/src/services/splashService.js';
import type { ObDetectionRecord } from '../pipeline/obVersionDetector.js';
import { detectObVersion } from '../pipeline/obVersionDetector.js';

export async function warmSplashCache(): Promise<void> {
  await loadParsedRecords();
}

export async function getWeekRecordsForObDetection(
  weekId: string,
): Promise<ObDetectionRecord[]> {
  const data = await fetchSplashWeekById(weekId);
  if (!data) return [];
  return data.records.map((record) => ({
    assetType: record.assetType,
    cdnUrl: record.cdnUrl,
  }));
}

export async function detectObVersionForWeek(
  weekId?: string,
): Promise<string | null> {
  await warmSplashCache();
  if (weekId) {
    const records = await getWeekRecordsForObDetection(weekId);
    if (records.length > 0) {
      const detected = detectObVersion(records);
      if (detected) return detected;
    }
  }
  const all = await loadParsedRecords();
  return detectObVersion(
    all.map((record) => ({
      assetType: record.assetType,
      cdnUrl: record.cdnUrl,
    })),
  );
}

export async function findRecordMeta(
  weekId: string,
  rowId: string,
): Promise<{ eventName: string | null; assetType: 'splash' | 'anno' } | null> {
  const data = await fetchSplashWeekById(weekId);
  if (!data) return null;
  const record = data.records.find((r) => r.id === rowId);
  if (!record) return null;
  return {
    eventName: record.descDisplay,
    assetType: record.assetType,
  };
}
