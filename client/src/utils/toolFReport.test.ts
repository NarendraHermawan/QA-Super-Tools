import { describe, expect, it } from 'vitest';
import { buildToolFRunReport } from './toolFReport';

describe('buildToolFRunReport', () => {
  it('groups uploaded, skipped, and failed events', () => {
    const report = buildToolFRunReport([
      'Checklist tab: 17 – 24 Jun 26 Before Patch',
      'Skipped — Follow Us!: col L already checked',
      'Uploaded — Scythe Gratis Missions',
      'Failed — Token Ring: No asset found',
      'Run complete — uploaded: 1, failed: 1, skipped: 1',
    ]);

    expect(report.tabName).toBe('17 - 24 Jun 26 Before Patch');
    expect(report.summary).toEqual({ uploaded: 1, failed: 1, skipped: 1 });
    expect(report.uploaded[0]?.eventName).toBe('Scythe Gratis Missions');
    expect(report.failed[0]?.eventName).toBe('Token Ring');
    expect(report.skipped[0]?.eventName).toBe('Follow Us!');
  });
});
