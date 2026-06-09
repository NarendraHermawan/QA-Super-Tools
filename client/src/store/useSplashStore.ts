import { create } from 'zustand';
import type { SplashAssetType } from '../types';

interface SplashStore {
  monthId: string | null;
  selectedDate: string | null;
  activeTab: SplashAssetType;
  checklistMonthId: string | null;
  checklistByDate: Record<string, string[]>;
  setMonthId: (monthId: string) => void;
  setSelectedDate: (date: string) => void;
  setActiveTab: (tab: SplashAssetType) => void;
  setChecklistMonthState: (
    monthId: string,
    byDate: Record<string, string[]>,
  ) => void;
  mergeChecklistDate: (date: string, rowIds: string[]) => void;
  setChecklistDate: (date: string, rowIds: string[]) => void;
  resetSplashSession: () => void;
}

export const useSplashStore = create<SplashStore>((set) => ({
  monthId: null,
  selectedDate: null,
  activeTab: 'splash',
  checklistMonthId: null,
  checklistByDate: {},
  setMonthId: (monthId) => set({ monthId }),
  setSelectedDate: (date) => set({ selectedDate: date }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setChecklistMonthState: (monthId, byDate) =>
    set({ checklistMonthId: monthId, checklistByDate: byDate }),
  mergeChecklistDate: (date, rowIds) =>
    set((state) => ({
      checklistByDate: { ...state.checklistByDate, [date]: rowIds },
    })),
  setChecklistDate: (date, rowIds) =>
    set((state) => {
      const next = { ...state.checklistByDate };
      if (rowIds.length === 0) delete next[date];
      else next[date] = rowIds;
      return { checklistByDate: next };
    }),
  resetSplashSession: () =>
    set({
      monthId: null,
      selectedDate: null,
      activeTab: 'splash',
      checklistMonthId: null,
      checklistByDate: {},
    }),
}));
