import { describe, expect, it } from 'vitest';
import {
  filterRecordsByMonth,
  findActiveCohortSortIds,
  findDuplicateSortIds,
  parseSplashGrid,
  recordActiveOnDate,
  type SplashRecord,
} from './splashParser.js';
import type { GridRow } from './weekModel.js';

function makeHeaderRow(): GridRow {
  return [
    null,
    null,
    null,
    'Desc',
    null,
    'Start Anno',
    'End Anno',
    'Start Splash',
    'End Splash',
    'Order Anno',
    'Unique ID Anno',
    'Order Splash',
    'Unique ID Splash',
    'Status',
    'Anno Banner 265x595',
    null,
    'Splash Banner 880x520',
    null,
    null,
    null,
    null,
    null,
    'GoPos',
    'Sub GoPos / URL',
  ];
}

function makeCombinedRow(
  status = 'TRELLO DONE',
  splashUrl = '',
  annoUrl = '',
): GridRow {
  return [
    null,
    null,
    null,
    'Summer Event',
    null,
    '2026-06-10 10:00:00',
    '2026-06-16 23:59:00',
    '2026-06-10 08:00:00',
    '2026-06-16 23:59:00',
    '12',
    'anno-uid-1',
    '5',
    'splash-uid-1',
    status,
    annoUrl,
    null,
    splashUrl,
    null,
    null,
    null,
    null,
    null,
    '100',
    'sub-url',
  ];
}

describe('splashParser', () => {
  it('splits combined rows into splash and anno records', () => {
    const grid = [makeHeaderRow(), makeCombinedRow()];
    const records = parseSplashGrid(grid);
    expect(records.length).toBe(2);
    expect(records.map((r) => r.assetType).sort()).toEqual(['anno', 'splash']);
    expect(records.find((r) => r.assetType === 'splash')?.uniqueId).toBe(
      'splash-uid-1',
    );
    expect(records.find((r) => r.assetType === 'anno')?.uniqueId).toBe(
      'anno-uid-1',
    );
    expect(records[0].sourceRowIndex).toBe(1);
  });

  it('normalizes status values', () => {
    const grid = [
      makeHeaderRow(),
      makeCombinedRow('need to update trello'),
      makeCombinedRow('scheduled'),
      makeCombinedRow('done'),
      makeCombinedRow('weird status'),
    ];
    const records = parseSplashGrid(grid);
    const splashRecords = records.filter((r) => r.assetType === 'splash');
    expect(splashRecords[0].status).toBe('NEED TO UPDATE TRELLO');
    expect(splashRecords[1].status).toBe('SCHEDULED');
    expect(splashRecords[2].status).toBe('DONE');
    expect(splashRecords[3].status).toBe('unknown');
  });

  it('parses excel-serial date cells for start times', () => {
    const row = makeCombinedRow();
    row[7] = 46176.416666666664;
    const grid = [makeHeaderRow(), row];
    const records = parseSplashGrid(grid);
    const splash = records.find((r) => r.assetType === 'splash');
    expect(splash?.start.slice(0, 10)).toBe('2026-06-03');
  });

  it('scopes records to calendar month of start splash', () => {
    const grid = [makeHeaderRow(), makeCombinedRow()];
    const records = parseSplashGrid(grid);
    const june = filterRecordsByMonth(records, '2026-06');
    expect(june.length).toBe(2);

    const july = filterRecordsByMonth(records, '2026-07');
    expect(july.length).toBe(0);
  });

  it('detects duplicate sort ids in active cohort on a date', () => {
    const row1 = makeCombinedRow();
    row1[11] = '7';
    row1[13] = 'splash-uid-2';
    const row2 = makeCombinedRow();
    row2[3] = 'Other event';
    row2[11] = '7';
    row2[13] = 'splash-uid-3';

    const records = parseSplashGrid([makeHeaderRow(), row1, row2]);
    const splashOnly = records.filter((r) => r.assetType === 'splash');
    const date = '2026-06-10';
    expect(findDuplicateSortIds(splashOnly, date).has(7)).toBe(true);
    expect(findActiveCohortSortIds(splashOnly, date).has(7)).toBe(true);
  });

  it('checks active-on-date overlap', () => {
    const record: SplashRecord = {
      recordId: 'splash:test',
      sourceRowIndex: 1,
      assetType: 'splash',
      desc: 'Test',
      start: '2026-06-10T08:00:00+07:00',
      end: '2026-06-16T23:59:00+07:00',
      sortId: 1,
      uniqueId: 'test',
      cdnUrl: null,
      status: 'TRELLO DONE',
      goPos: null,
      subGoPos: null,
    };
    expect(recordActiveOnDate(record, '2026-06-10')).toBe(true);
    expect(recordActiveOnDate(record, '2026-06-12')).toBe(true);
    expect(recordActiveOnDate(record, '2026-06-09')).toBe(false);
    expect(recordActiveOnDate(record, '2026-06-17')).toBe(false);
  });
});
