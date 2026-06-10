import { describe, expect, it } from 'vitest';
import type { SplashRecord } from '../types';
import { countSplashMetrics } from './splashFilters';

function record(id: string, start: string, end: string): SplashRecord {
  return {
    id,
    assetType: 'splash',
    desc: 'Event',
    descDisplay: 'Event',
    start,
    end,
    sortId: 1,
    uniqueId: id,
    status: 'need_to_update_trello',
    statusRaw: '',
    statusHint: null,
    cdnUrl: null,
    trelloCard: null,
    sheetGopos: null,
    sheetSubGopos: null,
    goposLookup: { status: 'not_found' },
    scheduledWithoutUrl: false,
    toolCSection: 'ready',
    monthId: '2026-06',
  };
}

describe('countSplashMetrics', () => {
  it('counts ready/assetNotReady/marked from scope, shown from filtered', () => {
    const week = [
      record('a', '2026-06-10', '2026-06-12'),
      record('b', '2026-06-11', '2026-06-13'),
    ];
    week[1] = { ...week[1], toolCSection: 'asset_not_ready' };

    const dayScope = [week[0]];
    const filtered = [week[0]];

    const metrics = countSplashMetrics(dayScope, filtered, {});

    expect(metrics.ready).toBe(1);
    expect(metrics.assetNotReady).toBe(0);
    expect(metrics.shown).toBe(1);
  });

  it('shown reflects uploaded filter while scope stays day-wide', () => {
    const rows = [record('a', '2026-06-10', '2026-06-12')];
    const metrics = countSplashMetrics(rows, [], {});

    expect(metrics.ready).toBe(1);
    expect(metrics.shown).toBe(0);
  });
});
