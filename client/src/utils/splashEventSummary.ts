import type { SplashAssetType, SplashRecord } from '../types';
import {
  effectiveSplashUploaded,
  type SplashUploadOverrides,
} from './splashUploadOverrides';

export type SplashEventSummaryFilter = 'uploaded' | 'not_uploaded';

export interface SplashEventSummaryAsset {
  tag: string;
  assetType: SplashAssetType;
}

export interface SplashEventSummaryItem {
  eventName: string;
  assets: SplashEventSummaryAsset[];
}

export interface SplashEventSummaryCopyOptions {
  filter: SplashEventSummaryFilter;
  weekLabel?: string;
}

function assetTypeLabel(assetType: SplashAssetType): string {
  return assetType === 'splash' ? 'Splash' : 'Announcement';
}

function eventNameFromRecord(record: SplashRecord): string | null {
  const name = record.desc.trim();
  if (!name || name === '—' || name === '-' || name === '–') return null;
  return name;
}

function assetLabel(record: SplashRecord): string | null {
  if (!record.cdnUrl) return null;
  const parts = record.cdnUrl.split('/');
  const filename = parts[parts.length - 1];
  return filename || null;
}

function uniqueAssets(records: SplashRecord[]): SplashEventSummaryAsset[] {
  const seen = new Set<string>();
  const result: SplashEventSummaryAsset[] = [];

  for (const record of records) {
    const tag = assetLabel(record);
    if (!tag) continue;
    const key = `${record.assetType}::${tag}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ tag, assetType: record.assetType });
  }

  return result;
}

export function summarizeSplashEvents(
  records: SplashRecord[],
  overrides: SplashUploadOverrides,
  filter: SplashEventSummaryFilter,
): SplashEventSummaryItem[] {
  const byEvent = new Map<string, SplashRecord[]>();

  for (const record of records) {
    const name = eventNameFromRecord(record);
    if (!name) continue;
    const group = byEvent.get(name) ?? [];
    group.push(record);
    byEvent.set(name, group);
  }

  const wantUploaded = filter === 'uploaded';
  const items: SplashEventSummaryItem[] = [];

  for (const [eventName, groupRecords] of byEvent.entries()) {
    const matching = groupRecords.filter((record) => {
      const uploaded = effectiveSplashUploaded(record, overrides);
      return wantUploaded ? uploaded : !uploaded;
    });

    if (matching.length === 0) continue;

    items.push({
      eventName,
      assets: uniqueAssets(matching),
    });
  }

  return items.sort((a, b) => a.eventName.localeCompare(b.eventName));
}

export function groupAssetsByType(
  assets: SplashEventSummaryAsset[],
): Map<string, string[]> {
  const grouped = new Map<string, string[]>();

  for (const { tag, assetType } of assets) {
    const label = assetTypeLabel(assetType);
    const tags = grouped.get(label) ?? [];
    tags.push(tag);
    grouped.set(label, tags);
  }

  return grouped;
}

function formatEventNameBlock(eventName: string, index: number): string[] {
  const parts = eventName
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (parts.length === 0) return [`[${index}] (unnamed)`];

  const lines = [`[${index}] ${parts[0]}`];
  for (let i = 1; i < parts.length; i++) {
    lines.push(`    ${parts[i]}`);
  }
  return lines;
}

function formatTypeAssets(typeLabel: string, tags: string[]): string {
  if (tags.length === 1 && tags[0] === typeLabel) {
    return `      • ${typeLabel}`;
  }
  return `      • ${typeLabel}: ${tags.join(', ')}`;
}

export function formatSplashEventSummaryForCopy(
  items: SplashEventSummaryItem[],
  options: SplashEventSummaryCopyOptions,
): string {
  const { filter, weekLabel } = options;
  const statusLabel = filter === 'uploaded' ? 'Uploaded' : 'Not uploaded';

  const header = [
    'FFID Splash & Anno Event Summary',
    `Status: ${statusLabel}`,
    `Events: ${items.length}`,
    'Scope: Splash + Announcement',
    ...(weekLabel ? [`Week: ${weekLabel}`] : []),
    '',
    '========================================',
  ];

  if (items.length === 0) {
    return [...header, '', '(no events)'].join('\n');
  }

  const blocks = items.map((item, index) => {
    const lines = [...formatEventNameBlock(item.eventName, index + 1)];

    if (item.assets.length > 0) {
      lines.push('    Assets:');
      const byType = groupAssetsByType(item.assets);
      const types = [...byType.keys()].sort((a, b) => a.localeCompare(b));
      for (const typeLabel of types) {
        const tags = byType.get(typeLabel) ?? [];
        lines.push(formatTypeAssets(typeLabel, tags));
      }
    }

    return lines.join('\n');
  });

  return [...header, '', blocks.join('\n\n')].join('\n');
}
