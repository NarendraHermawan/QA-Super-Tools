import type { BannerRow, CanonicalPlacement } from '../types';
import { CRAFTLAND_PLACEMENT } from '../types';
import {
  effectiveCdnUploaded,
  type UploadOverrides,
} from './uploadOverrides';

export function rowsForEventSummary(
  rows: BannerRow[],
  includeCraftland: boolean,
): BannerRow[] {
  if (includeCraftland) return rows;
  return rows.filter((row) => row.placement !== CRAFTLAND_PLACEMENT);
}

export type EventSummaryFilter = 'uploaded' | 'not_uploaded';

export interface EventSummaryAsset {
  tag: string;
  placement: CanonicalPlacement;
}

export interface EventSummaryItem {
  eventName: string;
  assets: EventSummaryAsset[];
}

export interface EventSummaryCopyOptions {
  filter: EventSummaryFilter;
  weekLabel?: string;
  includeCraftland?: boolean;
}

function assetLabel(row: BannerRow): string | null {
  if (row.assetTag) return row.assetTag;
  const cdn = row.cdnUrl ?? row.cdnLink;
  if (!cdn) return null;
  const parts = cdn.split('/').filter(Boolean);
  if (parts.length >= 2) {
    return parts[parts.length - 2] ?? null;
  }
  return parts[parts.length - 1] ?? null;
}

function uniqueAssets(rows: BannerRow[]): EventSummaryAsset[] {
  const seen = new Set<string>();
  const result: EventSummaryAsset[] = [];

  for (const row of rows) {
    const tag = assetLabel(row);
    if (!tag) continue;
    const cdn = row.cdnUrl ?? row.cdnLink ?? '';
    const key = `${row.placement}::${tag}::${cdn}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ tag, placement: row.placement });
  }

  return result;
}

export function summarizeEvents(
  rows: BannerRow[],
  overrides: UploadOverrides,
  filter: EventSummaryFilter,
): EventSummaryItem[] {
  const byEvent = new Map<string, BannerRow[]>();

  for (const row of rows) {
    const name = row.displayName.trim();
    if (!name) continue;
    const group = byEvent.get(name) ?? [];
    group.push(row);
    byEvent.set(name, group);
  }

  const wantUploaded = filter === 'uploaded';
  const items: EventSummaryItem[] = [];

  for (const [eventName, groupRows] of byEvent.entries()) {
    const matching = groupRows.filter((row) => {
      const uploaded = effectiveCdnUploaded(row, overrides);
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

export function groupAssetsByPlacement(
  assets: EventSummaryAsset[],
): Map<CanonicalPlacement, string[]> {
  const grouped = new Map<CanonicalPlacement, string[]>();

  for (const { tag, placement } of assets) {
    const tags = grouped.get(placement) ?? [];
    tags.push(tag);
    grouped.set(placement, tags);
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

function formatPlacementAssets(placement: string, tags: string[]): string {
  if (tags.length === 1 && tags[0] === placement) {
    return `      • ${placement}`;
  }
  return `      • ${placement}: ${tags.join(', ')}`;
}

export function formatEventSummaryForCopy(
  items: EventSummaryItem[],
  options: EventSummaryCopyOptions,
): string {
  const { filter, weekLabel, includeCraftland = false } = options;
  const statusLabel = filter === 'uploaded' ? 'Uploaded' : 'Not uploaded';
  const scopeLabel = includeCraftland
    ? 'In-game banners + Craftland'
    : 'In-game banners only';

  const header = [
    'FFID CDN Event Summary',
    `Status: ${statusLabel}`,
    `Events: ${items.length}`,
    `Scope: ${scopeLabel}`,
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
      const byPlacement = groupAssetsByPlacement(item.assets);
      const placements = [...byPlacement.keys()].sort((a, b) =>
        a.localeCompare(b),
      );
      for (const placement of placements) {
        const tags = byPlacement.get(placement) ?? [];
        lines.push(formatPlacementAssets(placement, tags));
      }
    }

    return lines.join('\n');
  });

  return [...header, '', blocks.join('\n\n')].join('\n');
}
