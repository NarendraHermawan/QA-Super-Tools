import { describe, expect, it } from 'vitest';
import type { BannerRow, SplashRecord } from '../types.js';
import {
  filterRecentWeeks,
  lookupGopos,
  recordOverlapsMonth,
} from './splashService.js';

function bannerRow(
  displayName: string,
  gopos: string,
  subGopos: string,
  placement: BannerRow['placement'] = 'Event',
): BannerRow {
  return {
    id: displayName,
    namaTab: displayName,
    displayName,
    assetTag: null,
    cdnLink: null,
    cdnUrl: null,
    startTime: '2026-06-10',
    endTime: '2026-06-16',
    assetDone: true,
    cdnUploaded: false,
    qaDone: false,
    sheetRowNumber: 1,
    placement,
    rowState: 'ready_to_upload',
    subWeekLabel: '3-9 Jun',
    gopos,
    subGopos,
  };
}

const fadedWheelEvent =
  'Faded Wheel - Interactive Emote - Reverse Penalty! (909053005) (Red), Emote Multitasking (909053011)';

function splashRecord(
  overrides: Partial<SplashRecord> & Pick<SplashRecord, 'id'>,
): SplashRecord {
  return {
    assetType: 'splash',
    desc: 'Test',
    descDisplay: 'Test',
    start: null,
    end: null,
    sortId: null,
    uniqueId: overrides.id,
    status: 'trello_done',
    statusRaw: 'TRELLO DONE',
    statusHint: null,
    cdnUrl: null,
    trelloCard: null,
    sheetGopos: null,
    sheetSubGopos: null,
    goposLookup: { status: 'not_found' },
    scheduledWithoutUrl: false,
    toolCSection: 'ready',
    monthId: '2026-06',
    ...overrides,
  };
}

describe('filterRecentWeeks', () => {
  it('keeps entries ending within the window and drops older rows', () => {
    const recent = splashRecord({
      id: 'recent',
      end: new Date().toISOString(),
    });
    const old = splashRecord({
      id: 'old',
      start: '2019-01-01T00:00:00.000+07:00',
      end: '2019-01-07T23:59:00.000+07:00',
    });
    const filtered = filterRecentWeeks([recent, old], 4);
    expect(filtered.map((r) => r.id)).toEqual(['recent']);
  });
});

describe('recordOverlapsMonth', () => {
  it('includes entries that span into the selected month', () => {
    const record = splashRecord({
      id: 'span',
      start: '2026-05-28T10:00:00.000+07:00',
      end: '2026-06-10T23:59:00.000+07:00',
      monthId: '2026-05',
    });
    expect(recordOverlapsMonth(record, '2026-06')).toBe(true);
    expect(recordOverlapsMonth(record, '2026-05')).toBe(true);
    expect(recordOverlapsMonth(record, '2026-04')).toBe(false);
  });
});

describe('lookupGopos', () => {
  it('returns suggested when 1 exact match exists', () => {
    const rows = [bannerRow('Super Fusion Bundle', '99', 'link-a')];
    const result = lookupGopos('#4 Super Fusion Bundle', rows);
    expect(result.status).toBe('suggested');
    if (result.status === 'suggested') {
      expect(result.gopos).toBe('99');
      expect(result.subGopos).toBe('link-a');
      expect(result.matchCount).toBe(1);
    }
  });

  it('returns suggested when multiple exact matches agree', () => {
    const rows = Array.from({ length: 2 }, () =>
      bannerRow('Super Fusion Bundle', '99', 'link-a'),
    );
    const result = lookupGopos('Super Fusion Bundle', rows);
    expect(result.status).toBe('suggested');
    if (result.status === 'suggested') {
      expect(result.matchCount).toBe(2);
    }
  });

  it('returns not_found when exact matches disagree', () => {
    const rows = [
      bannerRow('Super Fusion Bundle', '99', 'a'),
      bannerRow('Super Fusion Bundle', '88', 'b'),
    ];
    const result = lookupGopos('Super Fusion Bundle', rows);
    expect(result.status).toBe('not_found');
  });

  it('returns not_found when no exact matches', () => {
    const rows = [bannerRow('Other Event', '99', 'a')];
    const result = lookupGopos('Super Fusion Bundle', rows);
    expect(result.status).toBe('not_found');
  });

  it('returns not_found for fuzzy-only matches', () => {
    const rows = [
      bannerRow('Super Fusion Bundle Extended', '99', 'fuzzy-a'),
      bannerRow('Super Fusion Bundle Promo', '99', 'fuzzy-b'),
    ];
    const result = lookupGopos('Super Fusion Bundle', rows);
    expect(result.status).toBe('not_found');
  });

  it('ignores Gacha rows when other placements agree on GoPos', () => {
    const rows = [
      bannerRow(fadedWheelEvent, '15', 'V2_chestId_19', 'Shopping Mall'),
      bannerRow(fadedWheelEvent, '15', 'V2_chestId_19', 'Slide Banner'),
      bannerRow(fadedWheelEvent, '19', 'Faded Wheel', 'Gacha / Luck Royale'),
    ];
    const result = lookupGopos(`#16 ${fadedWheelEvent}`, rows);
    expect(result.status).toBe('suggested');
    if (result.status === 'suggested') {
      expect(result.gopos).toBe('15');
      expect(result.subGopos).toBe('V2_chestId_19');
      expect(result.matchCount).toBe(2);
    }
  });
});
