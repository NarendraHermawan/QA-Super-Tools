import { describe, expect, it } from 'vitest';
import type { BannerRow } from '../types';
import { effectiveCdnUploaded } from './uploadOverrides';

const baseRow: BannerRow = {
  id: 'row-1',
  namaTab: 'Tab',
  displayName: 'Test',
  assetTag: null,
  cdnLink: null,
  cdnUrl: 'https://example.com/a.ff_extend',
  startTime: '2026-06-10',
  endTime: '2026-06-16',
  assetDone: true,
  cdnUploaded: false,
  qaDone: false,
  sheetRowNumber: 1,
  placement: 'Overview',
  rowState: 'ready_to_upload',
  subWeekLabel: '3-9 Jun',
};

describe('effectiveCdnUploaded', () => {
  it('uses sheet value when no override exists', () => {
    expect(effectiveCdnUploaded(baseRow, {})).toBe(false);
  });

  it('treats row as uploaded when override is true', () => {
    expect(effectiveCdnUploaded(baseRow, { 'row-1': true })).toBe(true);
  });

  it('treats row as missing when override is false', () => {
    const uploadedRow = { ...baseRow, cdnUploaded: true };
    expect(effectiveCdnUploaded(uploadedRow, { 'row-1': false })).toBe(false);
  });
});
