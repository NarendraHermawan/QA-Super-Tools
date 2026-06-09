import { CANONICAL_PLACEMENTS, SECTION_ALIASES } from './constants.js';
import {
  displayNameFromCdn,
  isHttpUrl,
  normalizeCdnLink,
} from './cdnLink.js';
import {
  parseCellDate,
  parseDateRangeLabel,
  toIsoDateTime,
} from './dateUtils.js';
import type {
  BannerRow,
  CanonicalPlacement,
  RowState,
  WeekData,
} from '../types.js';
import type { GridRow } from './weekModel.js';
import type { SubWeek } from '../types.js';

type ColumnMap = Record<string, number>;

function parseBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const text = String(value ?? '').trim().toLowerCase();
  return text === 'true' || text === '1' || text === 'yes';
}

function computeRowState(assetDone: boolean, cdnUploaded: boolean): RowState {
  if (!assetDone && !cdnUploaded) return 'asset_not_ready';
  if (assetDone && !cdnUploaded) return 'ready_to_upload';
  if (assetDone && cdnUploaded) return 'uploaded';
  return 'inconsistent';
}

function isSectionHeaderRow(row: GridRow): boolean {
  const colA = String(row[0] ?? '').trim();
  const colB = String(row[1] ?? '').trim();
  if (!colA || !colB) return false;
  if (!(colA in SECTION_ALIASES)) return false;
  return (
    parseDateRangeLabel(colB) !== null || /\d{1,2}\s*-\s*\d{1,2}/.test(colB)
  );
}

function isColumnHeaderRow(row: GridRow): boolean {
  const headers = row.map((cell) => String(cell ?? '').trim().toLowerCase());
  return headers.includes('nama tab') || headers.includes('nam maps');
}

function buildColumnMap(headerRow: GridRow): ColumnMap {
  const map: ColumnMap = {};
  headerRow.forEach((cell, index) => {
    const key = String(cell ?? '').trim().toLowerCase();
    if (!key) return;
    if (key === 'cdn link' || key === 'cdn link (if needed)') {
      map.cdnLink = index;
    } else if (key === 'nama tab' || key === 'nam maps') {
      map.namaTab = index;
    } else if (key === 'start time') {
      map.startTime = index;
    } else if (key === 'end time') {
      map.endTime = index;
    } else if (key === 'asset done') {
      map.assetDone = index;
    } else if (key === 'cdn uploaded') {
      map.cdnUploaded = index;
    }
  });
  return map;
}

function getCell(row: GridRow, index: number | undefined): unknown {
  if (index === undefined) return undefined;
  return row[index];
}

/** True when the grid row has no non-empty cells (section spacing / break). */
function isBlankGridRow(row: GridRow): boolean {
  return row.every(
    (cell) => cell === null || cell === undefined || String(cell).trim() === '',
  );
}

function parseDataRow(
  row: GridRow,
  columns: ColumnMap,
  placement: CanonicalPlacement,
  subWeekLabel: string,
  rowIndex: number,
  cdnBaseUrl: string,
): BannerRow | null {
  const rawCdn = String(getCell(row, columns.cdnLink) ?? '').trim();
  const rawName = String(getCell(row, columns.namaTab) ?? '').trim();
  const startDt = parseCellDate(getCell(row, columns.startTime));
  const endDt = parseCellDate(getCell(row, columns.endTime));

  // Section breaks (e.g. empty A35/A36) must never become banner rows.
  if (isBlankGridRow(row)) return null;
  if (!rawName && !rawCdn) return null;
  if (rawName.toLowerCase() === 'nama tab' || rawName.toLowerCase() === 'nam maps') {
    return null;
  }

  const cdnUrl = normalizeCdnLink(rawCdn, cdnBaseUrl);
  const assetDone = parseBool(getCell(row, columns.assetDone));
  const cdnUploaded = parseBool(getCell(row, columns.cdnUploaded));

  const displayName =
    rawName || displayNameFromCdn(cdnUrl ?? (isHttpUrl(rawCdn) ? rawCdn : rawCdn));

  return {
    id: `${placement}-${subWeekLabel}-${rowIndex}`,
    namaTab: rawName,
    displayName,
    cdnLink: rawCdn || null,
    cdnUrl,
    startTime: startDt ? toIsoDateTime(startDt) : '',
    endTime: endDt ? toIsoDateTime(endDt) : '',
    assetDone,
    cdnUploaded,
    placement,
    rowState: computeRowState(assetDone, cdnUploaded),
    subWeekLabel,
  };
}

export function parseSheetGrid(
  tabName: string,
  grid: GridRow[],
  cdnBaseUrl: string,
): BannerRow[] {
  const rows: BannerRow[] = [];
  let i = 0;

  while (i < grid.length) {
    const row = grid[i];
    if (!isSectionHeaderRow(row)) {
      i += 1;
      continue;
    }

    const sectionName = String(row[0]).trim();
    const subWeekLabel = String(row[1]).trim();
    const placement = SECTION_ALIASES[sectionName];
    i += 1;

    if (i >= grid.length || !isColumnHeaderRow(grid[i])) {
      continue;
    }

    const columns = buildColumnMap(grid[i]);
    i += 1;

    while (i < grid.length && !isSectionHeaderRow(grid[i])) {
      const dataRow = grid[i];
      if (!isBlankGridRow(dataRow) && !isColumnHeaderRow(dataRow)) {
        const parsed = parseDataRow(
          dataRow,
          columns,
          placement,
          subWeekLabel,
          i,
          cdnBaseUrl,
        );
        if (parsed) rows.push(parsed);
      }
      i += 1;
    }
  }

  return rows;
}

export function filterRowsForSubWeek(
  rows: BannerRow[],
  subWeek: SubWeek,
): BannerRow[] {
  return rows.filter((row) => row.subWeekLabel === subWeek.id.split('::')[1]);
}

export function groupByPlacement(
  rows: BannerRow[],
): Record<CanonicalPlacement, BannerRow[]> {
  const grouped = Object.fromEntries(
    CANONICAL_PLACEMENTS.map((p) => [p, [] as BannerRow[]]),
  ) as Record<CanonicalPlacement, BannerRow[]>;

  for (const row of rows) {
    grouped[row.placement].push(row);
  }

  for (const placement of CANONICAL_PLACEMENTS) {
    grouped[placement].sort((a, b) =>
      (a.startTime || '').localeCompare(b.startTime || ''),
    );
  }

  return grouped;
}

export function buildWeekData(
  subWeek: SubWeek,
  grid: GridRow[],
  cdnBaseUrl: string,
): WeekData {
  const allParsed = parseSheetGrid(subWeek.tabName, grid, cdnBaseUrl);
  const subWeekLabel = subWeek.id.split('::')[1];
  const filtered = allParsed.filter((row) => row.subWeekLabel === subWeekLabel);
  return {
    week: subWeek,
    sections: groupByPlacement(filtered),
    allRows: filtered,
  };
}
