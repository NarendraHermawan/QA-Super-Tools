import { CANONICAL_PLACEMENTS, SECTION_ALIASES } from './constants.js';
import {
  assetTagFromCdn,
  displayNameFromCdn,
  isHttpUrl,
  normalizeCdnLink,
} from './cdnLink.js';
import {
  parseCellDate,
  parseDateRangeLabel,
  formatSubWeekLabelFromRange,
  isSingleWeekTabRange,
  parseTabNameRange,
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

function defaultSubWeekLabelForTab(tabName: string): string | null {
  const tabRange = parseTabNameRange(tabName);
  if (!tabRange || !isSingleWeekTabRange(tabRange)) return null;
  return formatSubWeekLabelFromRange(tabRange);
}

function resolveSectionStart(
  row: GridRow,
  tabName: string,
): { placement: CanonicalPlacement; subWeekLabel: string } | null {
  const colA = String(row[0] ?? '').trim();
  const colB = String(row[1] ?? '').trim();
  if (!colA || !(colA in SECTION_ALIASES)) return null;

  if (
    colB &&
    (parseDateRangeLabel(colB) !== null || /\d{1,2}\s*-\s*\d{1,2}/.test(colB))
  ) {
    return { placement: SECTION_ALIASES[colA], subWeekLabel: colB };
  }

  const fallbackLabel = defaultSubWeekLabelForTab(tabName);
  if (!fallbackLabel) return null;
  return { placement: SECTION_ALIASES[colA], subWeekLabel: fallbackLabel };
}

function isSectionStartRow(row: GridRow, tabName: string): boolean {
  return resolveSectionStart(row, tabName) !== null;
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
    } else if (key === 'qa') {
      // Standard layout: Asset Done (K) → CDN Uploaded (L) → QA (M)
      if (map.cdnUploaded !== undefined && index > map.cdnUploaded) {
        map.qaDone = index;
      } else if (map.qaDone === undefined) {
        map.qaDone = index;
      }
    } else if (key === 'gopos') {
      map.gopos = index;
    } else if (key === 'subgopos' || key === 'sub gopos') {
      map.subGopos = index;
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
  inheritedNamaTab: string,
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
  const qaDone =
    columns.qaDone !== undefined
      ? parseBool(getCell(row, columns.qaDone))
      : false;

  const effectiveName = rawName || inheritedNamaTab;
  const cdnSource = cdnUrl ?? (isHttpUrl(rawCdn) ? rawCdn : rawCdn);
  const displayName =
    effectiveName || displayNameFromCdn(cdnSource);
  const assetTag =
    effectiveName && rawCdn ? assetTagFromCdn(cdnSource) : null;

  const rawGopos = String(getCell(row, columns.gopos) ?? '').trim();
  const rawSubGopos = String(getCell(row, columns.subGopos) ?? '').trim();

  return {
    id: `${placement}-${subWeekLabel}-${rowIndex}`,
    namaTab: effectiveName,
    displayName,
    assetTag,
    cdnLink: rawCdn || null,
    cdnUrl,
    startTime: startDt ? toIsoDateTime(startDt) : '',
    endTime: endDt ? toIsoDateTime(endDt) : '',
    assetDone,
    cdnUploaded,
    qaDone,
    sheetRowNumber: rowIndex + 1,
    qaColumnIndex: columns.qaDone,
    placement,
    rowState: computeRowState(assetDone, cdnUploaded),
    subWeekLabel,
    gopos: rawGopos || null,
    subGopos: rawSubGopos || null,
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
    const section = resolveSectionStart(row, tabName);
    if (!section) {
      i += 1;
      continue;
    }

    const { placement, subWeekLabel } = section;
    i += 1;

    if (i >= grid.length || !isColumnHeaderRow(grid[i])) {
      continue;
    }

    const columns = buildColumnMap(grid[i]);
    i += 1;

    let lastNamaTab = '';
    while (i < grid.length && !isSectionStartRow(grid[i], tabName)) {
      const dataRow = grid[i];
      if (!isBlankGridRow(dataRow) && !isColumnHeaderRow(dataRow)) {
        const rawName = String(getCell(dataRow, columns.namaTab) ?? '').trim();
        if (rawName) lastNamaTab = rawName;

        const parsed = parseDataRow(
          dataRow,
          columns,
          placement,
          subWeekLabel,
          i,
          cdnBaseUrl,
          lastNamaTab,
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

/** Same event name on different days often uses different CDN folders — tag by go-live date. */
export function disambiguateDuplicateEventTags(rows: BannerRow[]): void {
  const groups = new Map<string, BannerRow[]>();

  for (const row of rows) {
    const key = `${row.placement}\0${row.displayName.trim().toLowerCase()}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  for (const group of groups.values()) {
    if (group.length <= 1) continue;
    for (const row of group) {
      const base = row.assetTag ?? 'Asset';
      const day = row.startTime?.slice(0, 10);
      row.assetTag = day ? `${base} · ${day}` : base;
    }
  }
}

export function buildWeekData(
  subWeek: SubWeek,
  grid: GridRow[],
  cdnBaseUrl: string,
): WeekData {
  const allParsed = parseSheetGrid(subWeek.tabName, grid, cdnBaseUrl);
  const subWeekLabel = subWeek.id.split('::')[1];
  const filtered = allParsed.filter((row) => row.subWeekLabel === subWeekLabel);
  disambiguateDuplicateEventTags(filtered);
  return {
    week: subWeek,
    sections: groupByPlacement(filtered),
    allRows: filtered,
  };
}
