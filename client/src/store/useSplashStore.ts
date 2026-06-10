import { create } from 'zustand';
import type { SplashAssetType, SubWeek } from '../types';

interface SplashState {
  selectedWeek: SubWeek | null;
  selectedDate: string | null;
  assetTypeTab: SplashAssetType;
  checklistWeekId: string | null;
  checklistByDate: Record<string, string[]>;
  uploadOverridesWeekId: string | null;
  uploadOverrides: Record<string, boolean>;
  setSelectedWeek: (week: SubWeek | null) => void;
  setSelectedDate: (date: string | null) => void;
  setAssetTypeTab: (tab: SplashAssetType) => void;
  setChecklistWeekState: (
    weekId: string,
    byDate: Record<string, string[]>,
  ) => void;
  mergeChecklistDate: (date: string, rowIds: string[]) => void;
  setChecklistDate: (date: string, rowIds: string[]) => void;
  setUploadOverridesState: (
    weekId: string,
    overrides: Record<string, boolean>,
  ) => void;
  setUploadOverride: (rowId: string, uploaded: boolean) => void;
  resetSplashSession: () => void;
}

export const useSplashStore = create<SplashState>((set, get) => ({
  selectedWeek: null,
  selectedDate: null,
  assetTypeTab: 'splash',
  checklistWeekId: null,
  checklistByDate: {},
  uploadOverridesWeekId: null,
  uploadOverrides: {},
  setSelectedWeek: (week) => set({ selectedWeek: week }),
  setSelectedDate: (date) => set({ selectedDate: date }),
  setAssetTypeTab: (tab) => set({ assetTypeTab: tab }),
  setChecklistWeekState: (weekId, byDate) =>
    set({ checklistWeekId: weekId, checklistByDate: byDate }),
  mergeChecklistDate: (date, rowIds) => {
    const existing = new Set(get().checklistByDate[date] ?? []);
    for (const rowId of rowIds) existing.add(rowId);
    set({
      checklistByDate: {
        ...get().checklistByDate,
        [date]: [...existing],
      },
    });
  },
  setChecklistDate: (date, rowIds) =>
    set({
      checklistByDate: {
        ...get().checklistByDate,
        [date]: rowIds,
      },
    }),
  setUploadOverridesState: (weekId, overrides) =>
    set({ uploadOverridesWeekId: weekId, uploadOverrides: overrides }),
  setUploadOverride: (rowId, uploaded) =>
    set({
      uploadOverrides: {
        ...get().uploadOverrides,
        [rowId]: uploaded,
      },
    }),
  resetSplashSession: () =>
    set({
      selectedWeek: null,
      selectedDate: null,
      assetTypeTab: 'splash',
      checklistWeekId: null,
      checklistByDate: {},
      uploadOverridesWeekId: null,
      uploadOverrides: {},
    }),
}));
