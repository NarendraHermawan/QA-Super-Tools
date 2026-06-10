import { describe, expect, it } from 'vitest';
import type { BannerRow } from '../types';
import {
  formatEventSummaryForCopy,
  groupAssetsByPlacement,
  rowsForEventSummary,
  summarizeEvents,
} from './eventSummary';

function makeRow(
  overrides: Partial<BannerRow> & Pick<BannerRow, 'id' | 'displayName'>,
): BannerRow {
  return {
    namaTab: overrides.displayName,
    assetTag: null,
    cdnLink: null,
    cdnUrl: null,
    startTime: '2026-06-10',
    endTime: '2026-06-16',
    assetDone: true,
    cdnUploaded: false,
    placement: 'Shopping Mall',
    rowState: 'ready_to_upload',
    subWeekLabel: '10 - 16 Jun',
    ...overrides,
  };
}

describe('summarizeEvents', () => {
  const piggyBank = 'New Web Event - PIGGY BANK';

  const rows: BannerRow[] = [
    makeRow({
      id: '1',
      displayName: piggyBank,
      assetTag: 'Mall small',
      cdnUploaded: true,
    }),
    makeRow({
      id: '2',
      displayName: piggyBank,
      assetTag: 'Title mall',
      cdnUploaded: false,
    }),
    makeRow({
      id: '3',
      displayName: piggyBank,
      assetTag: 'Mall background',
      cdnUploaded: false,
    }),
    makeRow({
      id: '4',
      displayName: 'Token Ring [UNIVERSAL] - Super Fusion',
      assetTag: 'Lobby BG',
      placement: 'Gacha / Luck Royale',
      cdnUploaded: true,
    }),
    makeRow({
      id: '5',
      displayName: 'Token Ring [UNIVERSAL] - Super Fusion',
      assetTag: 'Tab',
      placement: 'Gacha / Luck Royale',
      cdnUploaded: true,
    }),
    makeRow({
      id: '6',
      displayName: 'Other Event',
      placement: 'Overview',
      cdnUrl: 'https://example.com/common/foo/overview.ff_extend',
      cdnUploaded: false,
    }),
  ];

  it('defaults to not_uploaded and deduplicates event names', () => {
    const result = summarizeEvents(rows, {}, 'not_uploaded');
    expect(result).toHaveLength(2);
    expect(result[0].eventName).toBe(piggyBank);
    expect(result[0].assets).toEqual([
      { tag: 'Title mall', placement: 'Shopping Mall' },
      { tag: 'Mall background', placement: 'Shopping Mall' },
    ]);
    expect(result[1].eventName).toBe('Other Event');
  });

  it('shows uploaded assets when filter is uploaded', () => {
    const result = summarizeEvents(rows, {}, 'uploaded');
    expect(result).toHaveLength(2);
    expect(result[0].assets).toEqual([
      { tag: 'Mall small', placement: 'Shopping Mall' },
    ]);
    expect(result[1].assets).toEqual([
      { tag: 'Lobby BG', placement: 'Gacha / Luck Royale' },
      { tag: 'Tab', placement: 'Gacha / Luck Royale' },
    ]);
  });

  it('respects QA upload overrides', () => {
    const result = summarizeEvents(rows, { '2': true }, 'not_uploaded');
    expect(result.find((r) => r.eventName === piggyBank)?.assets).toEqual([
      { tag: 'Mall background', placement: 'Shopping Mall' },
    ]);
  });
});

describe('rowsForEventSummary', () => {
  it('excludes Craftland rows unless toggle is on', () => {
    const rows: BannerRow[] = [
      makeRow({ id: '1', displayName: 'Banner Event' }),
      makeRow({
        id: '2',
        displayName: 'Map Alpha',
        placement: 'Craftland',
      }),
    ];

    expect(rowsForEventSummary(rows, false)).toHaveLength(1);
    expect(rowsForEventSummary(rows, true)).toHaveLength(2);
  });
});

describe('formatEventSummaryForCopy', () => {
  it('formats a readable numbered report grouped by placement', () => {
    const text = formatEventSummaryForCopy(
      [
        {
          eventName: 'Emote Protes Pinalti',
          assets: [{ tag: 'Overview', placement: 'Overview' }],
        },
        {
          eventName: 'Faded Wheel Bundle',
          assets: [
            { tag: 'Mall small', placement: 'Shopping Mall' },
            { tag: 'Title mall', placement: 'Shopping Mall' },
            { tag: 'Slidebanner', placement: 'Slide Banner' },
          ],
        },
      ],
      {
        filter: 'not_uploaded',
        weekLabel: '10 - 16 Jun',
        includeCraftland: false,
      },
    );

    expect(text).toContain('FFID CDN Event Summary');
    expect(text).toContain('Status: Not uploaded');
    expect(text).toContain('Events: 2');
    expect(text).toContain('Week: 10 - 16 Jun');
    expect(text).toContain('[1] Emote Protes Pinalti');
    expect(text).toContain('      • Overview');
    expect(text).toContain('[2] Faded Wheel Bundle');
    expect(text).toContain('      • Shopping Mall: Mall small, Title mall');
    expect(text).toContain('      • Slide Banner: Slidebanner');
  });

  it('indents multiline event names', () => {
    const text = formatEventSummaryForCopy(
      [
        {
          eventName: '[M1917 Gratis] - Cumulative Play\nDuration : 06/15/2026',
          assets: [{ tag: 'Event', placement: 'Event' }],
        },
      ],
      { filter: 'not_uploaded' },
    );

    expect(text).toContain('[1] [M1917 Gratis] - Cumulative Play');
    expect(text).toContain('    Duration : 06/15/2026');
    expect(text).toContain('      • Event');
  });
});

describe('groupAssetsByPlacement', () => {
  it('groups tags under each placement', () => {
    const grouped = groupAssetsByPlacement([
      { tag: 'Mall small', placement: 'Shopping Mall' },
      { tag: 'Title mall', placement: 'Shopping Mall' },
      { tag: 'Slidebanner', placement: 'Slide Banner' },
    ]);

    expect(grouped.get('Shopping Mall')).toEqual(['Mall small', 'Title mall']);
    expect(grouped.get('Slide Banner')).toEqual(['Slidebanner']);
  });
});
