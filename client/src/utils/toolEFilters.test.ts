import { describe, expect, it } from 'vitest';
import type { SplashRecord } from '../types';
import {
  applyToolEFilters,
  countToolEMetrics,
  hasNotionUrl,
  isAlreadyUploadedOnSheet,
} from './toolEFilters';

function record(partial: Partial<SplashRecord>): SplashRecord {
  return {
    id: 'uid-splash',
    assetType: 'splash',
    desc: 'Event',
    descDisplay: 'Event',
    start: null,
    end: null,
    sortId: 1,
    uniqueId: 'uid',
    status: 'trello_done',
    statusRaw: 'TRELLO DONE',
    statusHint: null,
    cdnUrl: null,
    trelloCard: 'https://notion.so/page',
    sheetGopos: null,
    sheetSubGopos: null,
    goposLookup: { status: 'not_found' },
    scheduledWithoutUrl: false,
    toolCSection: 'ready',
    monthId: null,
    ...partial,
  };
}

describe('toolEFilters', () => {
  it('includes only rows with Notion URL', () => {
    const rows = [
      record({ id: 'a-splash', trelloCard: 'https://notion.so/a' }),
      record({ id: 'b-splash', trelloCard: null }),
    ];
    const filtered = applyToolEFilters(rows, {
      assetTab: 'all',
      showAlreadyUploaded: true,
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('a-splash');
  });

  it('hides scheduled rows with CDN URL by default', () => {
    const rows = [
      record({
        id: 'scheduled-splash',
        status: 'scheduled',
        cdnUrl: 'https://dl.dir.freefiremobile.com/common/OB53/ID/splash/x.png',
      }),
      record({ id: 'ready-splash', status: 'trello_done' }),
    ];
    const filtered = applyToolEFilters(rows, {
      assetTab: 'all',
      showAlreadyUploaded: false,
    });
    expect(filtered.map((r) => r.id)).toEqual(['ready-splash']);
  });

  it('shows scheduled uploaded rows when toggled', () => {
    const rows = [
      record({
        id: 'scheduled-splash',
        status: 'scheduled',
        cdnUrl: 'https://dl.dir.freefiremobile.com/common/OB53/ID/splash/x.png',
      }),
    ];
    const filtered = applyToolEFilters(rows, {
      assetTab: 'all',
      showAlreadyUploaded: true,
    });
    expect(filtered).toHaveLength(1);
  });

  it('filters by asset tab', () => {
    const rows = [
      record({ id: 's-splash', assetType: 'splash' }),
      record({ id: 'a-anno', assetType: 'anno', uniqueId: 'anno' }),
    ];
    expect(
      applyToolEFilters(rows, { assetTab: 'splash', showAlreadyUploaded: true }),
    ).toHaveLength(1);
    expect(
      applyToolEFilters(rows, { assetTab: 'anno', showAlreadyUploaded: true }),
    ).toHaveLength(1);
    expect(
      applyToolEFilters(rows, { assetTab: 'all', showAlreadyUploaded: true }),
    ).toHaveLength(2);
  });

  it('counts splash and anno eligible rows', () => {
    const rows = [
      record({ id: 's-splash', assetType: 'splash' }),
      record({ id: 'a-anno', assetType: 'anno' }),
      record({ id: 'x-splash', trelloCard: null }),
    ];
    expect(countToolEMetrics(rows)).toEqual({ total: 2, splash: 1, anno: 1 });
  });

  it('detects notion url and sheet-uploaded rows', () => {
    expect(hasNotionUrl(record({ trelloCard: '  https://x  ' }))).toBe(true);
    expect(hasNotionUrl(record({ trelloCard: '' }))).toBe(false);
    expect(
      isAlreadyUploadedOnSheet(
        record({
          status: 'scheduled',
          cdnUrl: 'https://dl.dir.freefiremobile.com/common/OB53/ID/splash/a.png',
        }),
      ),
    ).toBe(true);
  });
});
