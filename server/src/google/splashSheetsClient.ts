import { config } from '../config.js';
import { findSplashHeaderIndex } from '../parsing/splashParser.js';
import type { GridRow } from '../parsing/weekModel.js';
import { SheetsClient } from './sheetsClient.js';

const SPLASH_TAB_NAME = 'ID - Settings';
/** Col B (Index / event name) through Z (Trello, GoPos, CDN, dates, status). */
const SPLASH_RANGE_START = 'B';
const SPLASH_RANGE_END = 'Z';
const HEADER_SCAN_ROWS = 20;

/** Offsets within a B:Z row where B is index 0. */
export const SPLASH_COL_ANNO_BANNER = 13; // O
export const SPLASH_COL_SPLASH_BANNER = 15; // Q

function splashA1Range(startRow: number, endRow: number): string {
  return `${SPLASH_RANGE_START}${startRow}:${SPLASH_RANGE_END}${endRow}`;
}

function columnRange(col: string, startRow: number, endRow: number): string {
  return `${col}${startRow}:${col}${endRow}`;
}

export function padGridRow(row: GridRow, width: number): GridRow {
  if (row.length >= width) return row;
  return [...row, ...Array(width - row.length).fill(null)];
}

/**
 * Google Sheets omits trailing empty cells in B:Z rows, so CDN URLs in col Q
 * are dropped when the row ends earlier (e.g. at Status in col N). Patch from
 * dedicated O and Q column fetches, which always align at index 0 per row.
 */
export function mergeSplashCdnColumns(
  mainRows: GridRow[],
  annoBannerCol: GridRow[],
  splashBannerCol: GridRow[],
  headerWidth: number,
): GridRow[] {
  return mainRows.map((row, index) => {
    const merged = padGridRow(row, headerWidth);
    const anno = annoBannerCol[index]?.[0];
    const splash = splashBannerCol[index]?.[0];
    const existingAnno = merged[SPLASH_COL_ANNO_BANNER];
    const existingSplash = merged[SPLASH_COL_SPLASH_BANNER];
    if (
      anno !== undefined &&
      anno !== null &&
      anno !== '' &&
      (existingAnno === undefined || existingAnno === null || existingAnno === '')
    ) {
      merged[SPLASH_COL_ANNO_BANNER] = anno;
    }
    if (
      splash !== undefined &&
      splash !== null &&
      splash !== '' &&
      (existingSplash === undefined ||
        existingSplash === null ||
        existingSplash === '')
    ) {
      merged[SPLASH_COL_SPLASH_BANNER] = splash;
    }
    return merged;
  });
}

let client: SheetsClient | null = null;

function getClient(): SheetsClient {
  if (!config.splashSheetId) {
    throw new Error('SPLASH_SHEET_ID not configured');
  }
  if (!client) {
    client = new SheetsClient(config.splashSheetId);
  }
  return client;
}

export async function fetchSplashSettingsGrid(): Promise<GridRow[]> {
  const sheets = getClient();
  const { rowCount } = await sheets.getTabGridProperties(SPLASH_TAB_NAME);

  const window = Math.max(config.splashRecentRowWindow, 50);
  const bottomStart = Math.max(HEADER_SCAN_ROWS + 1, rowCount - window + 1);
  const headerRange = splashA1Range(1, HEADER_SCAN_ROWS);
  const bottomRange =
    bottomStart <= rowCount ? splashA1Range(bottomStart, rowCount) : null;

  const headerRanges = [headerRange];
  const dataRanges = bottomRange
    ? [
        bottomRange,
        columnRange('O', bottomStart, rowCount),
        columnRange('Q', bottomStart, rowCount),
      ]
    : [];

  const [headerSlice, ...dataSlices] = await sheets.getTabRanges(
    SPLASH_TAB_NAME,
    [...headerRanges, ...dataRanges],
  );

  const headerIndex = findSplashHeaderIndex(headerSlice);
  if (headerIndex < 0) {
    throw new Error(`Splash header row not found in ${SPLASH_TAB_NAME}`);
  }
  const headerRow = padGridRow(headerSlice[headerIndex], headerSlice[headerIndex].length);
  const headerWidth = headerRow.length;

  if (!bottomRange) {
    return [headerRow];
  }

  const [bottomSlice = [], annoBannerCol = [], splashBannerCol = []] = dataSlices;
  const mergedBottom = mergeSplashCdnColumns(
    bottomSlice,
    annoBannerCol,
    splashBannerCol,
    headerWidth,
  );

  return [headerRow, ...mergedBottom];
}

export function resetSplashSheetsClient(): void {
  client = null;
}
