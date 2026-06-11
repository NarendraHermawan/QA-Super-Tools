import { create } from 'zustand';
import type { AutoUploadHistoryRecord } from '../api/autoUpload';

export type UploadRowState = 'idle' | 'uploading' | 'success' | 'failed';

export interface RowUploadState {
  state: UploadRowState;
  tokenName?: string | null;
  cdnUrl?: string | null;
  error?: string | null;
  originalName?: string | null;
}

interface ToolEState {
  rowStates: Record<string, RowUploadState>;
  historyWeekId: string | null;
  setRowUploading: (rowId: string, originalName: string) => void;
  setRowResult: (
    rowId: string,
    result:
      | { state: 'success'; tokenName: string; cdnUrl: string }
      | { state: 'failed'; error: string },
  ) => void;
  resetRow: (rowId: string) => void;
  hydrateFromHistory: (weekId: string, records: AutoUploadHistoryRecord[]) => void;
}

function historyToRowState(record: AutoUploadHistoryRecord): RowUploadState {
  if (record.status === 'success' && record.cdnUrl) {
    return {
      state: 'success',
      tokenName: record.tokenName,
      cdnUrl: record.cdnUrl,
      originalName: record.originalName,
    };
  }
  if (record.status === 'failed') {
    return {
      state: 'failed',
      error: record.errorReason ?? 'Upload failed',
      tokenName: record.tokenName,
      originalName: record.originalName,
    };
  }
  if (record.status === 'uploading') {
    return { state: 'uploading', originalName: record.originalName };
  }
  return { state: 'idle' };
}

export const useToolEStore = create<ToolEState>((set, get) => ({
  rowStates: {},
  historyWeekId: null,

  setRowUploading: (rowId, originalName) =>
    set({
      rowStates: {
        ...get().rowStates,
        [rowId]: { state: 'uploading', originalName },
      },
    }),

  setRowResult: (rowId, result) =>
    set({
      rowStates: {
        ...get().rowStates,
        [rowId]:
          result.state === 'success'
            ? {
                state: 'success',
                tokenName: result.tokenName,
                cdnUrl: result.cdnUrl,
              }
            : {
                state: 'failed',
                error: result.error,
              },
      },
    }),

  resetRow: (rowId) =>
    set({
      rowStates: {
        ...get().rowStates,
        [rowId]: { state: 'idle' },
      },
    }),

  hydrateFromHistory: (weekId, records) => {
    const rowStates: Record<string, RowUploadState> = {};
    for (const record of records) {
      if (record.status === 'uploading') continue;
      rowStates[record.rowId] = historyToRowState(record);
    }
    set({ historyWeekId: weekId, rowStates });
  },
}));
