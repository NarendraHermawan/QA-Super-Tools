import { describe, expect, it } from 'vitest';
import type { GridRow } from '../parsing/weekModel.js';
import {
  mergeSplashCdnColumns,
  padGridRow,
  SPLASH_COL_ANNO_BANNER,
  SPLASH_COL_SPLASH_BANNER,
} from './splashSheetsClient.js';

describe('splashSheetsClient', () => {
  it('pads short rows to header width', () => {
    expect(padGridRow(['a', 'b'], 5)).toEqual(['a', 'b', null, null, null]);
  });

  it('patches CDN columns from dedicated O/Q fetches onto truncated B:Z rows', () => {
    const truncated: GridRow[] = [
      ['#1 Event', '', '', '', '', '', '', '', '', '', '', '', 'TRELLO DONE'],
    ];
    const annoCol: GridRow[] = [['']];
    const splashCol: GridRow[] = [
      ['https://dl.dir.freefiremobile.com/common/OB53/ID/splash/test.jpg'],
    ];

    const [merged] = mergeSplashCdnColumns(truncated, annoCol, splashCol, 25);

    expect(merged[SPLASH_COL_SPLASH_BANNER]).toBe(
      'https://dl.dir.freefiremobile.com/common/OB53/ID/splash/test.jpg',
    );
    expect(merged.length).toBe(25);
  });

  it('does not overwrite existing CDN cells in the main row', () => {
    const main: GridRow[] = [Array(SPLASH_COL_SPLASH_BANNER + 1).fill('')];
    main[0][SPLASH_COL_SPLASH_BANNER] = 'https://existing/splash.jpg';
    const splashCol: GridRow[] = [['https://patched/splash.jpg']];

    const [merged] = mergeSplashCdnColumns(main, [[]], splashCol, 25);
    expect(merged[SPLASH_COL_SPLASH_BANNER]).toBe('https://existing/splash.jpg');
  });

  it('patches anno banner from col O fetch', () => {
    const main: GridRow[] = [['#2 Anno event']];
    const annoCol: GridRow[] = [['https://cdn.example/anno.jpg']];

    const [merged] = mergeSplashCdnColumns(main, annoCol, [[]], 20);
    expect(merged[SPLASH_COL_ANNO_BANNER]).toBe('https://cdn.example/anno.jpg');
  });
});
