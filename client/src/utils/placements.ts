import type { BannerRow, CanonicalPlacement } from '../types';
import { PLACEMENTS } from '../types';
import { overlapsDate, sameCalendarDay } from './date';
import {
  effectiveCdnUploaded,
  type UploadOverrides,
} from './uploadOverrides';

export const CRAFTLAND_PLACEMENT: CanonicalPlacement = 'Craftland';

export const BANNER_PLACEMENTS = PLACEMENTS.filter(
  (p) => p !== CRAFTLAND_PLACEMENT,
);

export function isCraftlandRow(row: BannerRow): boolean {
  return row.placement === CRAFTLAND_PLACEMENT;
}

export function splitByCraftland(rows: BannerRow[]): {
  banner: BannerRow[];
  craftland: BannerRow[];
} {
  return {
    banner: rows.filter((r) => !isCraftlandRow(r)),
    craftland: rows.filter(isCraftlandRow),
  };
}

export interface ViewFilterOptions {
  activeDate: string;
  includeUploaded?: boolean;
  viewAllWeek?: boolean;
  selectedPlacements: CanonicalPlacement[];
  uploadOverrides?: UploadOverrides;
}

export function applyToolAFilters(
  rows: BannerRow[],
  {
    activeDate,
    includeUploaded = false,
    viewAllWeek = false,
    selectedPlacements,
    uploadOverrides = {},
  }: ViewFilterOptions,
): BannerRow[] {
  let result = viewAllWeek
    ? [...rows]
    : rows.filter((row) =>
        overlapsDate(row.startTime, row.endTime, activeDate),
      );
  if (!includeUploaded) {
    result = result.filter(
      (row) => !effectiveCdnUploaded(row, uploadOverrides),
    );
  }
  if (selectedPlacements.length > 0) {
    result = result.filter((row) =>
      selectedPlacements.includes(row.placement),
    );
  }
  return result;
}

export function applyToolBFilters(
  rows: BannerRow[],
  selectedPlacements: CanonicalPlacement[],
): BannerRow[] {
  if (selectedPlacements.length === 0) return rows;
  return rows.filter((row) => selectedPlacements.includes(row.placement));
}

export interface CdnMetrics {
  missingWeek: number;
  goLiveDay: number;
  rowsShown: number;
}

export function computeCdnMetrics(
  scopeRows: BannerRow[],
  filteredRows: BannerRow[],
  activeDate: string,
  viewAllWeek = false,
  weekRange?: { start: string; end: string },
  uploadOverrides: UploadOverrides = {},
): CdnMetrics {
  const isMissing = (row: BannerRow) =>
    !effectiveCdnUploaded(row, uploadOverrides);

  const goLiveDay = viewAllWeek && weekRange
    ? scopeRows.filter((r) => {
        if (!isMissing(r) || !r.startTime) return false;
        const start = r.startTime.slice(0, 10);
        return start >= weekRange.start && start <= weekRange.end;
      }).length
    : scopeRows.filter(
        (r) => isMissing(r) && sameCalendarDay(r.startTime, activeDate),
      ).length;

  return {
    missingWeek: scopeRows.filter(isMissing).length,
    goLiveDay,
    rowsShown: filteredRows.length,
  };
}

export function groupRowsByPlacement(
  rows: BannerRow[],
  placements: CanonicalPlacement[],
): Record<CanonicalPlacement, BannerRow[]> {
  const map = Object.fromEntries(
    placements.map((p) => [p, [] as BannerRow[]]),
  ) as Record<CanonicalPlacement, BannerRow[]>;
  for (const row of rows) {
    map[row.placement]?.push(row);
  }
  for (const placement of placements) {
    map[placement].sort((a, b) =>
      (a.startTime || '').localeCompare(b.startTime || ''),
    );
  }
  return map;
}
