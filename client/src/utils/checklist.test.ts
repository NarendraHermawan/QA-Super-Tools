import { describe, expect, it } from 'vitest';
import { resolveCheckedForDate } from './checklist';

describe('resolveCheckedForDate', () => {
  const weekDays = ['2026-06-10', '2026-06-11', '2026-06-12'];

  it('returns checks saved for the selected day', () => {
    const result = resolveCheckedForDate(
      { '2026-06-11': ['row-a'] },
      '2026-06-11',
      weekDays,
      [],
      false,
    );
    expect([...result.checkedIds]).toEqual(['row-a']);
    expect(result.carryOverIds).toEqual([]);
  });

  it('carries still-active checks from previous days in the week', () => {
    const result = resolveCheckedForDate(
      {
        '2026-06-10': ['row-active', 'row-disappear'],
        '2026-06-11': ['row-new'],
      },
      '2026-06-11',
      weekDays,
      ['row-active'],
      false,
    );
    expect([...result.checkedIds].sort()).toEqual(['row-active', 'row-new']);
    expect(result.carryOverIds).toEqual(['row-active']);
  });

  it('aggregates per-day checks in full-week view', () => {
    const result = resolveCheckedForDate(
      {
        __week_all__: ['row-week-only'],
        '2026-06-10': ['row-a', 'row-b'],
        '2026-06-11': ['row-c'],
      },
      '2026-06-11',
      weekDays,
      [],
      true,
    );
    expect([...result.checkedIds].sort()).toEqual([
      'row-a',
      'row-b',
      'row-c',
      'row-week-only',
    ]);
  });
});
