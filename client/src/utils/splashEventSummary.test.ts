import { describe, expect, it } from 'vitest';
import type { SplashRecord } from '../types';
import {
  formatSplashEventSummaryForCopy,
  groupAssetsByType,
  summarizeSplashEvents,
} from './splashEventSummary';

function makeRecord(
  overrides: Partial<SplashRecord> & Pick<SplashRecord, 'id'>,
): SplashRecord {
  return {
    assetType: 'splash',
    desc: 'Test Event',
    descDisplay: 'Test Event',
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

describe('summarizeSplashEvents', () => {
  const fusionEvent = 'Token Ring [UNIVERSAL] - Super Fusion';

  const records: SplashRecord[] = [
    makeRecord({
      id: 'splash-uploaded',
      desc: fusionEvent,
      assetType: 'splash',
      cdnUrl: 'https://cdn.example.com/splash/live.ff_extend',
      status: 'done',
      toolCSection: 'uploaded',
    }),
    makeRecord({
      id: 'splash-missing',
      desc: fusionEvent,
      assetType: 'splash',
      cdnUrl: 'https://cdn.example.com/splash/pending.ff_extend',
      status: 'trello_done',
    }),
    makeRecord({
      id: 'anno-missing',
      desc: fusionEvent,
      assetType: 'anno',
      cdnUrl: 'https://cdn.example.com/anno/pending.png',
      status: 'trello_done',
    }),
    makeRecord({
      id: 'other-uploaded',
      desc: 'Other Event',
      assetType: 'anno',
      cdnUrl: 'https://cdn.example.com/anno/other.png',
      status: 'scheduled',
      toolCSection: 'uploaded',
    }),
  ];

  it('defaults to not_uploaded and deduplicates event names', () => {
    const result = summarizeSplashEvents(records, {}, 'not_uploaded');
    expect(result).toHaveLength(1);
    expect(result[0].eventName).toBe(fusionEvent);
    expect(result[0].assets).toEqual([
      { tag: 'pending.ff_extend', assetType: 'splash' },
      { tag: 'pending.png', assetType: 'anno' },
    ]);
  });

  it('shows uploaded assets when filter is uploaded', () => {
    const result = summarizeSplashEvents(records, {}, 'uploaded');
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.eventName === fusionEvent)?.assets).toEqual([
      { tag: 'live.ff_extend', assetType: 'splash' },
    ]);
    expect(result.find((r) => r.eventName === 'Other Event')?.assets).toEqual([
      { tag: 'other.png', assetType: 'anno' },
    ]);
  });

  it('respects QA upload overrides', () => {
    const result = summarizeSplashEvents(
      records,
      { 'splash-missing': true },
      'not_uploaded',
    );
    expect(result[0].assets).toEqual([
      { tag: 'pending.png', assetType: 'anno' },
    ]);
  });
});

describe('formatSplashEventSummaryForCopy', () => {
  it('formats a readable numbered report grouped by asset type', () => {
    const text = formatSplashEventSummaryForCopy(
      [
        {
          eventName: 'Emote Protes Pinalti',
          assets: [
            {
              tag: 'splash-live.ff_extend',
              assetType: 'splash',
            },
          ],
        },
        {
          eventName: 'Faded Wheel Bundle',
          assets: [
            { tag: 'splash-live.ff_extend', assetType: 'splash' },
            { tag: 'anno-banner.png', assetType: 'anno' },
          ],
        },
      ],
      {
        filter: 'not_uploaded',
        weekLabel: '10 - 16 Jun',
      },
    );

    expect(text).toContain('FFID Splash & Anno Event Summary');
    expect(text).toContain('Status: Not uploaded');
    expect(text).toContain('Events: 2');
    expect(text).toContain('Week: 10 - 16 Jun');
    expect(text).toContain('[1] Emote Protes Pinalti');
    expect(text).toContain('      • Splash: splash-live.ff_extend');
    expect(text).toContain('[2] Faded Wheel Bundle');
    expect(text).toContain('      • Splash: splash-live.ff_extend');
    expect(text).toContain('      • Announcement: anno-banner.png');
  });
});

describe('groupAssetsByType', () => {
  it('groups tags under each asset type label', () => {
    const grouped = groupAssetsByType([
      { tag: 'splash-a.ff_extend', assetType: 'splash' },
      { tag: 'splash-b.ff_extend', assetType: 'splash' },
      { tag: 'anno.png', assetType: 'anno' },
    ]);

    expect(grouped.get('Splash')).toEqual([
      'splash-a.ff_extend',
      'splash-b.ff_extend',
    ]);
    expect(grouped.get('Announcement')).toEqual(['anno.png']);
  });
});
