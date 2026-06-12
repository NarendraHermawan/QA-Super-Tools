import { describe, expect, it } from 'vitest';
import { columnIndexToA1 } from './sheetsClient.js';

describe('columnIndexToA1', () => {
  it('converts standard banner checklist columns', () => {
    expect(columnIndexToA1(10)).toBe('K');
    expect(columnIndexToA1(11)).toBe('L');
    expect(columnIndexToA1(12)).toBe('M');
  });
});
