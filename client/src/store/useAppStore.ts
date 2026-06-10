import { create } from 'zustand';
import type { CanonicalPlacement, ConfirmedBug, SubWeek } from '../types';
import type { UploadOverrides } from '../utils/uploadOverrides';

interface AppState {
  selectedWeek: SubWeek | null;
  selectedDate: string | null;
  selectedPlacements: CanonicalPlacement[];
  includeCraftland: boolean;
  checkedRowIds: Set<string>;
  confirmedBugs: ConfirmedBug[];
  uploadOverridesWeekId: string | null;
  uploadOverrides: UploadOverrides;
  checklistWeekId: string | null;
  checklistByDate: Record<string, string[]>;
  setSelectedWeek: (week: SubWeek | null) => void;
  setSelectedDate: (date: string | null) => void;
  togglePlacement: (placement: CanonicalPlacement) => void;
  setPlacements: (placements: CanonicalPlacement[]) => void;
  setIncludeCraftland: (include: boolean) => void;
  setCheckedRowIds: (rowIds: Set<string>) => void;
  setChecklistWeekState: (
    weekId: string,
    byDate: Record<string, string[]>,
  ) => void;
  mergeChecklistDate: (date: string, rowIds: string[]) => void;
  setChecklistDate: (date: string, rowIds: string[]) => void;
  toggleChecked: (rowId: string) => void;
  setConfirmedBugs: (bugs: ConfirmedBug[]) => void;
  confirmBug: (bug: ConfirmedBug) => void;
  setUploadOverridesState: (weekId: string, overrides: UploadOverrides) => void;
  setUploadOverride: (rowId: string, uploaded: boolean) => void;
  resetSession: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  selectedWeek: null,
  selectedDate: null,
  selectedPlacements: [],
  includeCraftland: false,
  checkedRowIds: new Set<string>(),
  confirmedBugs: [],
  uploadOverridesWeekId: null,
  uploadOverrides: {},
  checklistWeekId: null,
  checklistByDate: {},
  setSelectedWeek: (week) => set({ selectedWeek: week }),
  setSelectedDate: (date) => set({ selectedDate: date }),
  togglePlacement: (placement) => {
    const current = get().selectedPlacements;
    if (current.length === 0) {
      set({ selectedPlacements: [placement] });
      return;
    }
    if (current.includes(placement)) {
      const next = current.filter((p) => p !== placement);
      set({ selectedPlacements: next });
    } else {
      set({ selectedPlacements: [...current, placement] });
    }
  },
  setPlacements: (placements) => set({ selectedPlacements: placements }),
  setIncludeCraftland: (include) => set({ includeCraftland: include }),
  setCheckedRowIds: (rowIds) => set({ checkedRowIds: rowIds }),
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
  toggleChecked: (rowId) => {
    const next = new Set(get().checkedRowIds);
    if (next.has(rowId)) next.delete(rowId);
    else next.add(rowId);
    set({ checkedRowIds: next });
  },
  setConfirmedBugs: (bugs) => set({ confirmedBugs: bugs }),
  confirmBug: (bug) => {
    const existing = get().confirmedBugs;
    if (existing.some((item) => item.id === bug.id)) return;
    set({ confirmedBugs: [...existing, bug] });
  },
  setUploadOverridesState: (weekId, overrides) =>
    set({ uploadOverridesWeekId: weekId, uploadOverrides: overrides }),
  setUploadOverride: (rowId, uploaded) =>
    set({
      uploadOverrides: {
        ...get().uploadOverrides,
        [rowId]: uploaded,
      },
    }),
  resetSession: () =>
    set({
      selectedWeek: null,
      selectedDate: null,
      selectedPlacements: [],
      includeCraftland: false,
      checkedRowIds: new Set(),
      confirmedBugs: [],
      uploadOverridesWeekId: null,
      uploadOverrides: {},
      checklistWeekId: null,
      checklistByDate: {},
    }),
}));
