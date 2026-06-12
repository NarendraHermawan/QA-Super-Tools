import { create } from 'zustand';
import type { ToolFJob, ToolFLogEntry, ToolFSseEvent } from '../api/toolF';

export type ToolFRunStatus = 'idle' | 'running' | 'complete' | 'failed' | 'cancelled';

interface ToolFState {
  runStatus: ToolFRunStatus;
  activeJobId: string | null;
  selectedJobId: string | null;
  logLines: string[];
  logEntries: ToolFLogEntry[];
  jobs: ToolFJob[];
  appendLog: (line: string) => void;
  handleSseEvent: (event: ToolFSseEvent) => void;
  setRunStatus: (status: ToolFRunStatus) => void;
  setActiveJobId: (jobId: string | null) => void;
  setSelectedJobId: (jobId: string | null) => void;
  setJobs: (jobs: ToolFJob[]) => void;
  setLogEntries: (entries: ToolFLogEntry[]) => void;
  resetLog: () => void;
}

export const useToolFStore = create<ToolFState>((set, get) => ({
  runStatus: 'idle',
  activeJobId: null,
  selectedJobId: null,
  logLines: [],
  logEntries: [],
  jobs: [],

  appendLog: (line) => {
    set({ logLines: [...get().logLines, line] });
  },

  handleSseEvent: (event) => {
    if (event.type === 'started') {
      set({
        runStatus: 'running',
        logLines: [],
        logEntries: [],
        selectedJobId: null,
      });
      return;
    }
    if (event.type === 'jobId') {
      set({ activeJobId: event.jobId });
      return;
    }
    if (event.type === 'log' || event.type === 'error') {
      get().appendLog(event.message);
      return;
    }
    if (event.type === 'complete') {
      const status =
        event.status === 'cancelled'
          ? 'cancelled'
          : event.status === 'failed' || (event.exitCode ?? 0) !== 0
            ? 'failed'
            : 'complete';
      set({ runStatus: status, activeJobId: null });
    }
  },

  setRunStatus: (runStatus) => set({ runStatus }),
  setActiveJobId: (activeJobId) => set({ activeJobId }),
  setSelectedJobId: (selectedJobId) => set({ selectedJobId }),
  setJobs: (jobs) => set({ jobs }),
  setLogEntries: (logEntries) => set({ logEntries }),
  resetLog: () => set({ logLines: [], logEntries: [], selectedJobId: null }),
}));
