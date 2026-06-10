import { DateTime } from 'luxon';
import { normalizeCdnLink } from './cdnLink.js';
import { parseCellDate, toIsoDateTime } from './dateUtils.js';
import type { GridRow } from './weekModel.js';
import type { SplashAssetType, SplashRecord, SplashStatus } from '../types.js';

interface SplashColumnMap {
  index?: number;
  desc?: number;
  startAnno?: number;
  endAnno?: number;
  startSplash?: number;
  endSplash?: number;
  orderAnno?: number;
  orderSplash?: number;
  uniqueIdAnno?: number;
  uniqueIdSplash?: number;
  status?: number;
  annoBanner?: number;
  splashBanner?: number;
  gopos?: number;
  subGopos?: number;
  trelloCard?: number;
}

const KNOWN_STATUSES: Record<string, SplashStatus> = {
  'need to update trello': 'need_to_update_trello',
  'trello done': 'trello_done',
  scheduled: 'scheduled',
  done: 'done',
};

function normalizeHeader(cell: unknown): string {
  return String(cell ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function buildColumnMap(headerRow: GridRow): SplashColumnMap {
  const map: SplashColumnMap = {};
  headerRow.forEach((cell, index) => {
    const key = normalizeHeader(cell);
    if (!key) return;

    if (key === 'index' || key === 'no' || key === 'no.') {
      map.index = index;
    } else if (key === 'desc' || key.includes('description') || key.includes('event name')) {
      map.desc = index;
    } else if (key === 'start anno') {
      map.startAnno = index;
    } else if (key === 'end anno') {
      map.endAnno = index;
    } else if (key === 'start splash') {
      map.startSplash = index;
    } else if (key === 'end splash') {
      map.endSplash = index;
    } else if (key === 'order anno') {
      map.orderAnno = index;
    } else if (key.includes('order splash') || key.includes('sort_id')) {
      map.orderSplash = index;
    } else if (key === 'unique id anno') {
      map.uniqueIdAnno = index;
    } else if (key === 'unique id splash') {
      map.uniqueIdSplash = index;
    } else if (key === 'status') {
      map.status = index;
    } else if (key.includes('anno banner')) {
      map.annoBanner = index;
    } else if (key.includes('splash banner')) {
      map.splashBanner = index;
    } else if (key.includes('splash gopos') || key === 'gopos') {
      map.gopos = index;
    } else if (key.includes('sub gopos') || key === 'subgopos') {
      map.subGopos = index;
    } else if (key.includes('trello card')) {
      map.trelloCard = index;
    }
  });
  return map;
}

function isHeaderRow(row: GridRow): boolean {
  const headers = row.map((cell) => normalizeHeader(cell));
  const hasName =
    headers.includes('index') ||
    headers.includes('desc') ||
    headers.some((h) => h.includes('event name'));
  return hasName && headers.includes('status');
}

function eventNameFromRow(row: GridRow, map: SplashColumnMap): string {
  return (
    cellText(getCell(row, map.index)) || cellText(getCell(row, map.desc))
  );
}

export function findSplashHeaderIndex(grid: GridRow[]): number {
  return grid.findIndex(isHeaderRow);
}

function getCell(row: GridRow, index: number | undefined): unknown {
  if (index === undefined) return undefined;
  return row[index];
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

export function normalizeSplashStatus(raw: unknown): SplashStatus {
  const text = cellText(raw).toLowerCase();
  if (!text) return 'unknown';
  return KNOWN_STATUSES[text] ?? 'unknown';
}

export function formatDescDisplay(desc: string): string {
  const trimmed = desc.trim();
  if (!trimmed || trimmed === '—' || trimmed === '-' || trimmed === '–') {
    return '— (no description)';
  }
  return trimmed;
}

export function normalizeDescForLookup(desc: string): string {
  return desc
    .replace(/^#\d+\s+/, '')
    .trim()
    .toLowerCase();
}

function parseDateTime(value: unknown): string | null {
  const dt = parseCellDate(value);
  if (!dt) return null;
  return toIsoDateTime(dt);
}

function parseSortId(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function hasTrelloCard(value: unknown): boolean {
  return cellText(value).length > 0;
}

function buildStatusHint(
  status: SplashStatus,
  trelloFilled: boolean,
): string | null {
  if (status === 'trello_done' && !trelloFilled) {
    return 'No Trello card on file — asset delivered directly';
  }
  if (status === 'need_to_update_trello' && trelloFilled) {
    return 'Card exists — chase designer to update status';
  }
  return null;
}

function classifyToolCSection(
  status: SplashStatus,
  cdnUrl: string | null,
  scheduledWithoutUrl: boolean,
): SplashRecord['toolCSection'] {
  if (status === 'done') return 'uploaded';
  if (status === 'scheduled') return scheduledWithoutUrl ? 'needs_review' : 'uploaded';
  if (status === 'trello_done') return 'ready';
  if (status === 'need_to_update_trello') return 'asset_not_ready';
  return 'needs_review';
}

function monthIdFromDate(isoDateTime: string | null): string | null {
  if (!isoDateTime) return null;
  const dt = DateTime.fromISO(isoDateTime);
  if (!dt.isValid) return null;
  return dt.toFormat('yyyy-MM');
}

interface RecordDraft {
  assetType: SplashAssetType;
  start: string | null;
  end: string | null;
  sortId: number | null;
  uniqueId: string;
  cdnUrl: string | null;
}

function buildRecord(
  draft: RecordDraft,
  shared: {
    desc: string;
    statusRaw: string;
    status: SplashStatus;
    trelloCard: string | null;
    sheetGopos: string | null;
    sheetSubGopos: string | null;
    rowIndex: number;
  },
  cdnBaseUrl: string,
): SplashRecord {
  const trelloFilled = hasTrelloCard(shared.trelloCard);
  const cdnUrl = draft.cdnUrl
    ? normalizeCdnLink(draft.cdnUrl, cdnBaseUrl)
    : null;
  const scheduledWithoutUrl =
    shared.status === 'scheduled' && !cdnUrl;
  const uniqueId =
    draft.uniqueId ||
    `row-${shared.rowIndex}-${draft.assetType}`;

  return {
    id: `${uniqueId}-${draft.assetType}`,
    assetType: draft.assetType,
    desc: shared.desc,
    descDisplay: formatDescDisplay(shared.desc),
    start: draft.start,
    end: draft.end,
    sortId: draft.sortId,
    uniqueId,
    status: shared.status,
    statusRaw: shared.statusRaw,
    statusHint: buildStatusHint(shared.status, trelloFilled),
    cdnUrl,
    trelloCard: shared.trelloCard,
    sheetGopos: shared.sheetGopos || null,
    sheetSubGopos: shared.sheetSubGopos || null,
    goposLookup: { status: 'not_found' },
    scheduledWithoutUrl,
    toolCSection: classifyToolCSection(
      shared.status,
      cdnUrl,
      scheduledWithoutUrl,
    ),
    monthId:
      monthIdFromDate(draft.start) ?? monthIdFromDate(draft.end),
  };
}

function hasSplashData(
  map: SplashColumnMap,
  row: GridRow,
): boolean {
  return (
    cellText(getCell(row, map.startSplash)).length > 0 ||
    cellText(getCell(row, map.endSplash)).length > 0 ||
    parseSortId(getCell(row, map.orderSplash)) !== null ||
    cellText(getCell(row, map.splashBanner)).length > 0 ||
    cellText(getCell(row, map.uniqueIdSplash)).length > 0
  );
}

function hasAnnoData(map: SplashColumnMap, row: GridRow): boolean {
  return (
    cellText(getCell(row, map.startAnno)).length > 0 ||
    cellText(getCell(row, map.endAnno)).length > 0 ||
    parseSortId(getCell(row, map.orderAnno)) !== null ||
    cellText(getCell(row, map.annoBanner)).length > 0 ||
    cellText(getCell(row, map.uniqueIdAnno)).length > 0
  );
}

export function parseSplashGrid(
  grid: GridRow[],
  cdnBaseUrl: string,
): SplashRecord[] {
  const headerIndex = grid.findIndex(isHeaderRow);
  if (headerIndex < 0) return [];

  const columnMap = buildColumnMap(grid[headerIndex]);
  const records: SplashRecord[] = [];

  for (let i = headerIndex + 1; i < grid.length; i++) {
    const row = grid[i];
    const desc = eventNameFromRow(row, columnMap);
    const statusRaw = cellText(getCell(row, columnMap.status));
    const status = normalizeSplashStatus(statusRaw);

    if (!desc && !statusRaw) continue;

    const shared = {
      desc,
      statusRaw,
      status,
      trelloCard: cellText(getCell(row, columnMap.trelloCard)) || null,
      sheetGopos: cellText(getCell(row, columnMap.gopos)) || null,
      sheetSubGopos: cellText(getCell(row, columnMap.subGopos)) || null,
      rowIndex: i,
    };

    if (hasSplashData(columnMap, row)) {
      records.push(
        buildRecord(
          {
            assetType: 'splash',
            start: parseDateTime(getCell(row, columnMap.startSplash)),
            end: parseDateTime(getCell(row, columnMap.endSplash)),
            sortId: parseSortId(getCell(row, columnMap.orderSplash)),
            uniqueId: cellText(getCell(row, columnMap.uniqueIdSplash)),
            cdnUrl: cellText(getCell(row, columnMap.splashBanner)) || null,
          },
          shared,
          cdnBaseUrl,
        ),
      );
    }

    if (hasAnnoData(columnMap, row)) {
      records.push(
        buildRecord(
          {
            assetType: 'anno',
            start: parseDateTime(getCell(row, columnMap.startAnno)),
            end: parseDateTime(getCell(row, columnMap.endAnno)),
            sortId: parseSortId(getCell(row, columnMap.orderAnno)),
            uniqueId: cellText(getCell(row, columnMap.uniqueIdAnno)),
            cdnUrl: cellText(getCell(row, columnMap.annoBanner)) || null,
          },
          shared,
          cdnBaseUrl,
        ),
      );
    }
  }

  return records;
}
