import { afterEach, describe, expect, it } from 'vitest';
import {
  addConfirmedBug,
  clearMemoryStorageForTests,
  getChecklistWeekState,
  getConfirmedBugs,
  setChecklistBatch,
  setChecklistItem,
  storageBackend,
} from './checklistRepo.js';

afterEach(() => {
  clearMemoryStorageForTests();
});

describe('checklistRepo (memory fallback)', () => {
  it('uses memory when DATABASE_URL is unset', () => {
    expect(storageBackend()).toBe('memory');
  });

  it('stores and retrieves checklist checks per date', async () => {
    const weekId = 'tab::10 - 16 Jun';
    await setChecklistItem(weekId, '2026-06-10', 'Overview-10 - 16 Jun-5', true);
    await setChecklistItem(weekId, '2026-06-11', 'Overview-10 - 16 Jun-5', true);

    const state = await getChecklistWeekState(weekId);
    expect(state.byDate['2026-06-10']).toEqual(['Overview-10 - 16 Jun-5']);
    expect(state.byDate['2026-06-11']).toEqual(['Overview-10 - 16 Jun-5']);
  });

  it('unchecks items', async () => {
    const weekId = 'tab::10 - 16 Jun';
    await setChecklistItem(weekId, '2026-06-10', 'row-1', true);
    await setChecklistItem(weekId, '2026-06-10', 'row-1', false);

    const state = await getChecklistWeekState(weekId);
    expect(state.byDate['2026-06-10']).toBeUndefined();
  });

  it('batch saves multiple row ids', async () => {
    const weekId = 'tab::10 - 16 Jun';
    await setChecklistBatch(weekId, '2026-06-11', ['row-a', 'row-b']);

    const state = await getChecklistWeekState(weekId);
    expect(state.byDate['2026-06-11']).toEqual(['row-a', 'row-b']);
  });

  it('stores confirmed bugs per date', async () => {
    const weekId = 'tab::10 - 16 Jun';
    const bug = {
      id: 'row-1',
      eventName: 'Test Event',
      placement: 'Overview' as const,
      cdnUrl: 'https://example.com/a.jpg',
      date: '2026-06-10',
    };
    await addConfirmedBug(weekId, bug);

    const bugs = await getConfirmedBugs(weekId, '2026-06-10');
    expect(bugs).toHaveLength(1);
    expect(bugs[0].eventName).toBe('Test Event');
  });
});
