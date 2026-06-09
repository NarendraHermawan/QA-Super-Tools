import { create } from 'zustand';
import type { CanonicalPlacement, ConfirmedBug, SubWeek } from '../types';

interface AppState {
  selectedWeek: SubWeek | null;
  selectedDate: string | null;
  selectedPlacements: CanonicalPlacement[];
  includeCraftland: boolean;
  checkedRowIds: Set<string>;
  confirmedBugs: ConfirmedBug[];
  setSelectedWeek: (week: SubWeek | null) => void;
  setSelectedDate: (date: string | null) => void;
  togglePlacement: (placement: CanonicalPlacement) => void;
  setPlacements: (placements: CanonicalPlacement[]) => void;
  setIncludeCraftland: (include: boolean) => void;
  toggleChecked: (rowId: string) => void;
  confirmBug: (bug: ConfirmedBug) => void;
  resetSession: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  selectedWeek: null,
  selectedDate: null,
  selectedPlacements: [],
  includeCraftland: false,
  checkedRowIds: new Set<string>(),
  confirmedBugs: [],
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
  toggleChecked: (rowId) => {
    const next = new Set(get().checkedRowIds);
    if (next.has(rowId)) next.delete(rowId);
    else next.add(rowId);
    set({ checkedRowIds: next });
  },
  confirmBug: (bug) => {
    const existing = get().confirmedBugs;
    if (existing.some((item) => item.id === bug.id)) return;
    set({ confirmedBugs: [...existing, bug] });
  },
  resetSession: () =>
    set({
      selectedWeek: null,
      selectedDate: null,
      selectedPlacements: [],
      includeCraftland: false,
      checkedRowIds: new Set(),
      confirmedBugs: [],
    }),
}));
