import { describe, expect, it } from 'vitest';
import type { GridRow } from './weekModel.js';
import {
  formatDescDisplay,
  normalizeDescForLookup,
  normalizeSplashStatus,
  parseSplashGrid,
} from './splashParser.js';

const header: GridRow = [
  '',
  '',
  '',
  'Desc',
  '',
  'Start Anno',
  'End Anno',
  'Start Splash',
  'End Splash',
  'Order Anno',
  'Unique ID Anno',
  'Order Splash / Sort_ID',
  'Unique ID Splash',
  'Status',
  'Anno Banner 265x595',
  '',
  'Splash Banner 880x520',
  '',
  '',
  '',
  '',
  '',
  'Splash GoPos',
  'Sub Gopos / URL',
  '',
  'Trello Card',
];

const dualRow: GridRow = [
  '',
  '',
  '',
  '#4 Super Fusion Bundle',
  '',
  '2026-06-12 15:00:00',
  '2026-06-14 23:59:00',
  '2026-06-10 10:00:00',
  '2026-06-16 23:59:00',
  38,
  'anno-1',
  12,
  'splash-1',
  'TRELLO DONE',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  'https://trello.com/c/abc',
];

describe('splashParser', () => {
  it('splits a row with both splash and anno into two records', () => {
    const records = parseSplashGrid([header, dualRow], 'https://cdn.example/');
    expect(records).toHaveLength(2);
    expect(records.map((r) => r.assetType).sort()).toEqual(['anno', 'splash']);
    expect(records.find((r) => r.assetType === 'splash')?.uniqueId).toBe('splash-1');
    expect(records.find((r) => r.assetType === 'anno')?.uniqueId).toBe('anno-1');
  });

  it('normalizes status case-insensitively', () => {
    expect(normalizeSplashStatus('  Trello Done ')).toBe('trello_done');
    expect(normalizeSplashStatus('scheduled')).toBe('scheduled');
    expect(normalizeSplashStatus('weird')).toBe('unknown');
  });

  it('flags SCHEDULED without CDN URL as inconsistent', () => {
    const row: GridRow = [...dualRow];
    row[13] = 'SCHEDULED';
    row[16] = '';
    row[14] = '';
    const records = parseSplashGrid([header, row], 'https://cdn.example/');
    for (const record of records) {
      expect(record.scheduledWithoutUrl).toBe(true);
      expect(record.toolCSection).toBe('needs_review');
    }
  });

  it('strips #N prefix for lookup names', () => {
    expect(normalizeDescForLookup('#4 Super Fusion Bundle')).toBe(
      'super fusion bundle',
    );
  });

  it('formats empty descriptions', () => {
    expect(formatDescDisplay('—')).toBe('— (no description)');
  });

  it('uses Index column (col B) as event name when Desc is absent', () => {
    const headerB: GridRow = [
      'Index',
      '',
      '',
      '',
      '',
      'Start Anno',
      'End Anno',
      'Start Splash',
      'End Splash',
      'Order Anno',
      'Unique ID Anno',
      'Order Splash / Sort_ID',
      'Unique ID Splash',
      'Status',
      'Anno Banner 265x595',
      '',
      'Splash Banner 880x520',
      '',
      '',
      '',
      '',
      '',
      'Splash GoPos',
      'Sub Gopos / URL',
      '',
      'Trello Card',
    ];
    const rowB: GridRow = [
      '#4 Super Fusion Bundle',
      '',
      '',
      '',
      '',
      '2026-06-12 15:00:00',
      '2026-06-14 23:59:00',
      '2026-06-10 10:00:00',
      '2026-06-16 23:59:00',
      38,
      'anno-1',
      12,
      'splash-1',
      'TRELLO DONE',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'https://trello.com/c/abc',
    ];
    const records = parseSplashGrid([headerB, rowB], 'https://cdn.example/');
    expect(records).toHaveLength(2);
    expect(records[0].desc).toBe('#4 Super Fusion Bundle');
  });
});
