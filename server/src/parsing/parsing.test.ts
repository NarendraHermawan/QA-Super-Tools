import { describe, expect, it } from 'vitest';
import {
  assetTagFromCdn,
  cdnUrlForHealthCheck,
  eventFolderFromCdn,
  normalizeCdnLink,
} from './cdnLink.js';
import {
  isRelevantSubWeek,
  parseCellDate,
  parseDateRangeLabel,
  parseSubWeekInTabContext,
  parseTabNameRange,
} from './dateUtils.js';
import { getTabsNearToday, getTabsToFetch, parseTab, getRecentTabs } from './tabNameParser.js';
import {
  buildSubWeeksFromTab,
  getLatestSubWeeks,
} from './weekModel.js';
import {
  buildWeekData,
  disambiguateDuplicateEventTags,
  parseSheetGrid,
} from './sectionParser.js';
import { SAMPLE_TAB_NAME, sampleGrid } from '../fixtures/sampleGrid.js';

describe('dateUtils', () => {
  it('parses tab names with en-dash and year', () => {
    const range = parseTabNameRange('3 – 16 Jun 26');
    expect(range).toEqual({ start: '2026-06-03', end: '2026-06-16' });
  });

  it('parses biweekly cross-month tab names', () => {
    const range = parseTabNameRange('Biweekly 24 Jan – 06 Feb');
    expect(range?.start).toBe('2026-01-24');
    expect(range?.end).toBe('2026-02-06');
  });

  it('parses sub-week labels without year using fallback', () => {
    const range = parseDateRangeLabel('10 - 16 Jun', 2026);
    expect(range).toEqual({ start: '2026-06-10', end: '2026-06-16' });
  });

  it('parses cross-month labels where month token is the end month', () => {
    expect(parseDateRangeLabel('27 - 2 Jun', 2026)).toEqual({
      start: '2026-05-27',
      end: '2026-06-02',
    });
    expect(parseDateRangeLabel('29 - 5 Jun', 2026)).toEqual({
      start: '2026-05-29',
      end: '2026-06-05',
    });
    expect(parseDateRangeLabel('20 - 26 May', 2026)).toEqual({
      start: '2026-05-20',
      end: '2026-05-26',
    });
    expect(parseDateRangeLabel('17 - 24 Jun', 2026)).toEqual({
      start: '2026-06-17',
      end: '2026-06-24',
    });
  });

  it('parses biweekly tab names that end in the following month', () => {
    const range = parseTabNameRange('20 – 2 Jun 26');
    expect(range).toEqual({ start: '2026-05-20', end: '2026-06-02' });
  });

  it('parses tab names with Before Patch suffix without parentheses', () => {
    const range = parseTabNameRange('17 – 24 Jun 26 Before Patch');
    expect(range).toEqual({ start: '2026-06-17', end: '2026-06-24' });
  });

  it('parses excel serial and ISO dates', () => {
    const iso = parseCellDate('2026-06-03 00:00:00');
    const serial = parseCellDate(46176.416666666664);
    expect(iso?.toISODate()).toBe('2026-06-03');
    expect(serial?.toISODate()).toBe('2026-06-03');
  });
});

describe('tabNameParser', () => {
  it('filters non-week tabs', () => {
    const tabs = getRecentTabs([
      'Patch Note OB53',
      '3 – 16 Jun 26',
      '20 – 2 Jun 26',
      'Master Copy disini',
    ]);
    expect(tabs.map((t) => t.name)).toEqual(['3 – 16 Jun 26', '20 – 2 Jun 26']);
  });

  it('parses Indonesian month names', () => {
    expect(parseTab('29 Nov - 05 Des')?.range.end).toContain('-12-');
  });
});

describe('weekModel', () => {
  it('extracts sub-weeks from biweekly tab grid', () => {
    const subWeeks = buildSubWeeksFromTab(SAMPLE_TAB_NAME, sampleGrid);
    expect(subWeeks).toHaveLength(2);
    expect(subWeeks[0].label).toContain('Jun');
  });
});

describe('sectionParser', () => {
  it('parses rows from both sub-week blocks', () => {
    const rows = parseSheetGrid(SAMPLE_TAB_NAME, sampleGrid, 'https://dl.dir.freefiremobile.com/common/');
    expect(rows.length).toBeGreaterThan(3);
    expect(rows.some((r) => r.rowState === 'asset_not_ready')).toBe(true);
    expect(rows.some((r) => r.displayName === 'LobbyBG.png')).toBe(true);
  });

  it('maps col M QA checkbox using the QA header after CDN Uploaded', () => {
    const rows = parseSheetGrid(
      SAMPLE_TAB_NAME,
      sampleGrid,
      'https://dl.dir.freefiremobile.com/common/',
    );
    const followUs = rows.find((row) => row.displayName === 'Follow Us!');
    expect(followUs?.qaColumnIndex).toBe(12);
    expect(followUs?.sheetRowNumber).toBe(3);
    expect(followUs?.qaDone).toBe(false);
  });

  it('parses single-week tabs where section headers omit the date in column B', () => {
    const tabName = '17 – 24 Jun 26 Before Patch';
    const grid = [
      ['Overview'],
      [
        'Nama tab',
        'CDN Link',
        '',
        '',
        '',
        'Start Time',
        'End Time',
        '',
        '',
        '',
        'Asset Done',
        'CDN Uploaded',
      ],
      [
        'Token Ring Bundle',
        'https://dl.dir.freefiremobile.com/common/OB53/ID/example/overview.ff_extend',
        '',
        '',
        '',
        '2026-06-17 00:00:00',
        '2026-06-23 23:59:59',
        '',
        '',
        '',
        1,
        0,
      ],
      ['NEW Shopping mall'],
      [
        'Nama tab',
        'CDN Link',
        '',
        '',
        '',
        'Start Time',
        'End Time',
        '',
        '',
        '',
        'Asset Done',
        'CDN Uploaded',
      ],
      [
        'Mall Banner',
        'https://dl.dir.freefiremobile.com/common/OB53/ID/example/mallsmall.png',
        '',
        '',
        '',
        '2026-06-17 00:00:00',
        '2026-06-23 23:59:59',
        '',
        '',
        '',
        1,
        0,
      ],
    ];

    const rows = parseSheetGrid(
      tabName,
      grid,
      'https://dl.dir.freefiremobile.com/common/',
    );
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.subWeekLabel === '17 - 24 Jun')).toBe(true);

    const subWeeks = buildSubWeeksFromTab(tabName, grid);
    const weekData = buildWeekData(subWeeks[0], grid, 'https://dl.dir.freefiremobile.com/common/');
    expect(weekData.allRows).toHaveLength(2);
  });

  it('skips empty section break rows (e.g. blank A35/A36)', () => {
    const gridWithBreaks = [
      ['Overview', '10 - 16 Jun'],
      [
        'Nama tab',
        'CDN Link',
        '',
        '',
        '',
        'Start Time',
        'End Time',
        '',
        '',
        '',
        'Asset Done',
        'CDN Uploaded',
      ],
      [
        'Emote Protes Pinalti',
        'https://dl.dir.freefiremobile.com/common/OB53/ID/example/overview.ff_extend',
        '',
        '',
        '',
        '2026-06-15 00:00:00',
        '2026-06-21 23:59:59',
        '',
        '',
        '',
        1,
        0,
      ],
      [],
      ['', '', '', '', '', 0, 0, '', '', '', 0, 0],
      ['NEW Shopping mall', '10 - 16 Jun'],
      [
        'Nama tab',
        'CDN Link',
        '',
        '',
        '',
        'Start Time',
        'End Time',
        '',
        '',
        '',
        'Asset Done',
        'CDN Uploaded',
      ],
      [
        'Token Ring Bundle',
        'https://dl.dir.freefiremobile.com/common/OB53/ID/example/mallsmall.png',
        '',
        '',
        '',
        '2026-06-10 00:00:00',
        '2026-06-16 23:59:59',
        '',
        '',
        '',
        1,
        0,
      ],
    ];

    const rows = parseSheetGrid(
      SAMPLE_TAB_NAME,
      gridWithBreaks,
      'https://dl.dir.freefiremobile.com/common/',
    );
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.displayName)).toEqual([
      'Emote Protes Pinalti',
      'Token Ring Bundle',
    ]);
  });

  it('inherits Nama tab from merged cells to subsequent CDN rows', () => {
    const mergedName =
      'Token Ring - [UNIVERSAL] Super Fusion (710045103), Super Void (710045104)';
    const grid = [
      ['Gacha', '10 - 16 Jun'],
      [
        'Nama tab',
        'CDN Link',
        '',
        '',
        '',
        'Start Time',
        'End Time',
        '',
        '',
        '',
        'Asset Done',
        'CDN Uploaded',
      ],
      [
        mergedName,
        'https://dl.dir.freefiremobile.com/common/OB53/CSH/gacha/NUTSANGEROVNRLKIEI_100626_LobbyBGID_ind.ff_extend',
        '',
        '',
        '',
        '2026-06-10 00:00:00',
        '2026-06-16 23:59:59',
        '',
        '',
        '',
        1,
        1,
      ],
      [
        '',
        'https://dl.dir.freefiremobile.com/common/OB53/CSH/gacha/NUTSANGEROVNRLKIEI_100626_TabID_ind.ff_extend',
        '',
        '',
        '',
        '2026-06-10 00:00:00',
        '2026-06-16 23:59:59',
        '',
        '',
        '',
        1,
        1,
      ],
      [
        '',
        'https://dl.dir.freefiremobile.com/common/OB53/CSH/gacha/NUTSANGEROVNRLKIEI_100626_TitleID_ind.png',
        '',
        '',
        '',
        '2026-06-10 00:00:00',
        '2026-06-16 23:59:59',
        '',
        '',
        '',
        1,
        1,
      ],
    ];

    const rows = parseSheetGrid(
      SAMPLE_TAB_NAME,
      grid,
      'https://dl.dir.freefiremobile.com/common/',
    );

    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.displayName === mergedName)).toBe(true);
    expect(rows.every((r) => r.namaTab === mergedName)).toBe(true);
    expect(rows.map((r) => r.assetTag)).toEqual(['Lobby BG', 'Tab', 'Title']);
  });

  it('tags shopping mall assets under one merged event name', () => {
    const eventName = 'New Web Event - PIGGY BANK';
    const grid = [
      ['NEW Shopping mall', '10 - 16 Jun'],
      [
        'Nama tab',
        'CDN Link',
        '',
        '',
        '',
        'Start Time',
        'End Time',
        '',
        '',
        '',
        'Asset Done',
        'CDN Uploaded',
      ],
      [
        eventName,
        'https://dl.dir.freefiremobile.com/common/OB53/ID/130626_WNBENVEETEW/mallsmall.png',
        '',
        '',
        '',
        '2026-06-13 00:00:00',
        '2026-06-19 23:59:59',
        '',
        '',
        '',
        1,
        1,
      ],
      [
        '',
        'https://dl.dir.freefiremobile.com/common/OB53/ID/130626_WNBENVEETEW/titlemall.png',
        '',
        '',
        '',
        '2026-06-13 00:00:00',
        '2026-06-19 23:59:59',
        '',
        '',
        '',
        1,
        1,
      ],
      [
        '',
        'https://dl.dir.freefiremobile.com/common/OB53/ID/130626_WNBENVEETEW/bgmall.ff_extend',
        '',
        '',
        '',
        '2026-06-13 00:00:00',
        '2026-06-19 23:59:59',
        '',
        '',
        '',
        1,
        1,
      ],
    ];

    const rows = parseSheetGrid(
      SAMPLE_TAB_NAME,
      grid,
      'https://dl.dir.freefiremobile.com/common/',
    );

    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.displayName === eventName)).toBe(true);
    expect(rows.map((r) => r.assetTag)).toEqual([
      'Mall small',
      'Title mall',
      'Mall background',
    ]);
  });

  it('builds week data for a selected sub-week only', () => {
    const subWeeks = buildSubWeeksFromTab(SAMPLE_TAB_NAME, sampleGrid);
    const week = subWeeks.find((w) => w.start === '2026-06-10');
    expect(week).toBeDefined();
    const data = buildWeekData(week!, sampleGrid, 'https://dl.dir.freefiremobile.com/common/');
    expect(data.allRows.every((r) => r.subWeekLabel === '10 - 16 Jun')).toBe(true);
  });
});

describe('disambiguateDuplicateEventTags', () => {
  it('tags same event name on different days with go-live date', () => {
    const rows = [
      {
        id: 'a',
        namaTab: 'FF x ShopeePay',
        displayName: 'FF x ShopeePay',
        assetTag: 'Overview',
        cdnLink:
          'https://dl.dir.freefiremobile.com/common/OB53/ID/120605_sopipaylagi/overview.ff_extend',
        cdnUrl:
          'https://dl.dir.freefiremobile.com/common/OB53/ID/120605_sopipaylagi/overview.ff_extend',
        startTime: '2026-06-12 00:00:00',
        endTime: '2026-06-12 23:59:59',
        assetDone: true,
        cdnUploaded: true,
        qaDone: false,
        sheetRowNumber: 1,
        placement: 'Event' as const,
        rowState: 'uploaded' as const,
        subWeekLabel: '10 - 16 Jun',
        gopos: null,
        subGopos: null,
      },
      {
        id: 'b',
        namaTab: 'FF x ShopeePay',
        displayName: 'FF x ShopeePay',
        assetTag: 'Overview',
        cdnLink:
          'https://dl.dir.freefiremobile.com/common/OB53/ID/140605_sopipaylagi/overview.ff_extend',
        cdnUrl:
          'https://dl.dir.freefiremobile.com/common/OB53/ID/140605_sopipaylagi/overview.ff_extend',
        startTime: '2026-06-14 00:00:00',
        endTime: '2026-06-14 23:59:59',
        assetDone: true,
        cdnUploaded: false,
        qaDone: false,
        sheetRowNumber: 2,
        placement: 'Event' as const,
        rowState: 'ready_to_upload' as const,
        subWeekLabel: '10 - 16 Jun',
        gopos: null,
        subGopos: null,
      },
    ];

    disambiguateDuplicateEventTags(rows);

    expect(rows[0].assetTag).toBe('Overview · 2026-06-12');
    expect(rows[1].assetTag).toBe('Overview · 2026-06-14');
  });
});

describe('cdnLink', () => {
  it('extracts event folder from CDN asset URL', () => {
    expect(
      eventFolderFromCdn(
        'https://dl.dir.freefiremobile.com/common/OB53/ID/140605_sopipaylagi/overview.ff_extend',
      ),
    ).toBe('140605_sopipaylagi');
  });

  it('derives asset tags from CDN filenames for merged event rows', () => {
    expect(
      assetTagFromCdn(
        'https://dl.dir.freefiremobile.com/common/OB53/ID/130626_WNBENVEETEW/mallsmall.png',
      ),
    ).toBe('Mall small');
    expect(
      assetTagFromCdn(
        'https://dl.dir.freefiremobile.com/common/OB53/ID/130626_WNBENVEETEW/titlemall.png',
      ),
    ).toBe('Title mall');
    expect(
      assetTagFromCdn(
        'https://dl.dir.freefiremobile.com/common/OB53/ID/130626_WNBENVEETEW/bgmall.ff_extend',
      ),
    ).toBe('Mall background');
    expect(
      assetTagFromCdn(
        'https://dl.dir.freefiremobile.com/common/OB53/CSH/gacha/NUTSANGEROVNRLKIEI_100626_LobbyBGID_ind.ff_extend',
      ),
    ).toBe('Lobby BG');
  });

  it('normalizes relative and skips non-url values', () => {
    expect(
      normalizeCdnLink('OB53/ID/foo/overview.jpg', 'https://dl.dir.freefiremobile.com/common/'),
    ).toBe('https://dl.dir.freefiremobile.com/common/OB53/ID/foo/overview.jpg');
    expect(normalizeCdnLink('embed', 'https://dl.dir.freefiremobile.com/common/')).toBeNull();
    expect(normalizeCdnLink('Rekomendasi Official', 'https://x/')).toBeNull();
  });

  it('rewrites .ff_extend to .jpg for health checks', () => {
    expect(
      cdnUrlForHealthCheck(
        'https://dl.dir.freefiremobile.com/common/OB53/ID/100626_foo/overview1.ff_extend',
      ),
    ).toBe(
      'https://dl.dir.freefiremobile.com/common/OB53/ID/100626_foo/overview1.jpg',
    );
    expect(
      cdnUrlForHealthCheck(
        'https://dl.dir.freefiremobile.com/common/OB53/ID/foo/overview.jpg',
      ),
    ).toBe('https://dl.dir.freefiremobile.com/common/OB53/ID/foo/overview.jpg');
  });
});

describe('getLatestSubWeeks', () => {
  it('returns distinct latest weeks across tabs', () => {
    const weeks = getLatestSubWeeks(
      [{ tabName: SAMPLE_TAB_NAME, grid: sampleGrid }],
      4,
      '2026-06-09',
    );
    expect(weeks).toHaveLength(2);
    expect(weeks.every((w) => w.start.startsWith('2026-06'))).toBe(true);
  });

  it('returns the four most recent Tuesday-cycle sub-weeks', () => {
    const mayJunTab = '20 – 2 Jun 26';
    const junTab = '3 – 16 Jun 26';
    const jun2Tab = '17 – 24 Jun 26';

    const mayJunGrid = [
      ['Overview', '20 - 26 May'],
      ['Overview', '27 - 2 Jun'],
    ];
    const junGrid = [
      ['Overview', '3 - 9 Jun'],
      ['Overview', '10 - 16 Jun'],
    ];
    const jun2Grid = [['Overview', '17 - 24 Jun']];

    const weeksBeforeNewTab = getLatestSubWeeks(
      [
        { tabName: mayJunTab, grid: mayJunGrid },
        { tabName: junTab, grid: junGrid },
      ],
      4,
      '2026-06-09',
    );
    expect(weeksBeforeNewTab.map((w) => w.start)).toEqual([
      '2026-06-10',
      '2026-06-03',
      '2026-05-27',
      '2026-05-20',
    ]);

    const weeksAfterNewTab = getLatestSubWeeks(
      [
        { tabName: mayJunTab, grid: mayJunGrid },
        { tabName: junTab, grid: junGrid },
        { tabName: jun2Tab, grid: jun2Grid },
      ],
      4,
      '2026-06-17',
    );
    expect(weeksAfterNewTab.map((w) => w.start)).toEqual([
      '2026-06-17',
      '2026-06-10',
      '2026-06-03',
      '2026-05-27',
    ]);
  });

  it('derives sub-week from tab name when a new single-week tab has no grid headers yet', () => {
    const weeks = getLatestSubWeeks(
      [{ tabName: '17 – 24 Jun 26 Before Patch', grid: [] }],
      4,
      '2026-06-10',
    );
    expect(weeks).toHaveLength(1);
    expect(weeks[0].start).toBe('2026-06-17');
    expect(weeks[0].end).toBe('2026-06-24');
  });

  it('ignores generic weekly tabs without a year or patch suffix', () => {
    const weeks = getLatestSubWeeks(
      [
        { tabName: '7 - 13 Jun', grid: [['Overview', '7 - 13 Jun']] },
        {
          tabName: '3 – 16 Jun 26',
          grid: [
            ['Overview', '3 - 9 Jun'],
            ['Overview', '10 - 16 Jun'],
          ],
        },
      ],
      4,
      '2026-06-10',
    );
    expect(weeks.map((w) => w.start)).toEqual(['2026-06-10', '2026-06-03']);
  });
});

describe('relevance and year inference', () => {
  it('parses December sub-weeks inside cross-year tab as 2026 not 2027', () => {
    const tabRange = parseTabNameRange('17 Dec – 6 Jan 26');
    expect(tabRange).toEqual({
      start: '2026-12-17',
      end: '2027-01-06',
    });
    const subWeek = parseSubWeekInTabContext('24 - 31 Dec', tabRange!);
    expect(subWeek?.start).toBe('2026-12-24');
    expect(subWeek?.end).toBe('2026-12-31');
  });

  it('excludes far-future and stale 2025 weeks relative to today', () => {
    const today = '2026-06-09';
    expect(
      isRelevantSubWeek({ start: '2026-12-24', end: '2026-12-31' }, today),
    ).toBe(false);
    expect(
      isRelevantSubWeek({ start: '2025-12-17', end: '2025-12-23' }, today),
    ).toBe(false);
    expect(
      isRelevantSubWeek({ start: '2026-06-03', end: '2026-06-09' }, today),
    ).toBe(true);
    expect(
      isRelevantSubWeek({ start: '2026-06-17', end: '2026-06-24' }, today),
    ).toBe(true);
    expect(
      isRelevantSubWeek({ start: '2026-06-21', end: '2026-06-27' }, today),
    ).toBe(false);
  });

  it('prefers tabs near today over far-future year-end tabs', () => {
    const tabs = getTabsNearToday(
      ['17 Dec – 6 Jan 26', '3 – 16 Jun 26', '29 Nov - 05 Des'],
      8,
      4,
      '2026-06-09',
    );
    expect(tabs.map((t) => t.name)).toEqual(['3 – 16 Jun 26']);
  });

  it('includes globally newest tabs even when slightly outside the near-today window', () => {
    const tabs = getTabsToFetch(
      ['20 – 2 Jun 26', '3 – 16 Jun 26', '17 – 24 Jun 26', '17 Dec – 6 Jan 26'],
      '2026-06-10',
    );
    expect(tabs.map((t) => t.name)).toEqual([
      '17 – 24 Jun 26',
      '3 – 16 Jun 26',
      '20 – 2 Jun 26',
    ]);
  });
});
