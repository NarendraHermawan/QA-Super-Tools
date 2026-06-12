import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  cancelToolFRun,
  fetchToolFConfig,
  fetchToolFJobLog,
  fetchToolFJobs,
  runToolFUpload,
} from '../api/toolF';
import { BannerUploadPanel } from '../components/banner/BannerUploadPanel';
import { HeaderBar } from '../components/HeaderBar';
import { LoadingState } from '../components/ui/LoadingState';
import { PageHeader } from '../components/ui/PageHeader';
import { useAppStore } from '../store/useAppStore';
import { useToolFStore } from '../store/useToolFStore';
import { normalizeDash } from '../utils/dash';
import { subWeekGridLabel } from '../utils/subWeek';

export function ToolF() {
  const navigate = useNavigate();
  const abortRef = useRef<AbortController | null>(null);
  const selectedWeek = useAppStore((s) => s.selectedWeek);

  const runStatus = useToolFStore((s) => s.runStatus);
  const logLines = useToolFStore((s) => s.logLines);
  const logEntries = useToolFStore((s) => s.logEntries);
  const jobs = useToolFStore((s) => s.jobs);
  const selectedJobId = useToolFStore((s) => s.selectedJobId);
  const handleSseEvent = useToolFStore((s) => s.handleSseEvent);
  const setJobs = useToolFStore((s) => s.setJobs);
  const setRunStatus = useToolFStore((s) => s.setRunStatus);
  const setActiveJobId = useToolFStore((s) => s.setActiveJobId);
  const setSelectedJobId = useToolFStore((s) => s.setSelectedJobId);
  const setLogEntries = useToolFStore((s) => s.setLogEntries);
  const resetLog = useToolFStore((s) => s.resetLog);

  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(false);
  const [sheetTitle, setSheetTitle] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [authError, setAuthError] = useState(false);

  const targetTab = selectedWeek
    ? normalizeDash(selectedWeek.tabName)
    : null;
  const targetWeekLabel = selectedWeek
    ? normalizeDash(selectedWeek.label)
    : null;

  const loadMeta = useCallback(async () => {
    const [config, jobList] = await Promise.all([
      fetchToolFConfig(),
      fetchToolFJobs(),
    ]);
    setAvailable(config.available && Boolean(config.pythonConfigured));
    setSheetTitle(config.sheetTitle ?? null);
    setJobs(jobList.jobs);
    if (config.activeJobId) {
      setActiveJobId(config.activeJobId);
      setRunStatus('running');
    }
  }, [setActiveJobId, setJobs, setRunStatus]);

  useEffect(() => {
    setAuthError(false);
    setError('');
    loadMeta()
      .catch((err: Error) => {
        const message = err.message;
        if (message === 'Authentication required') {
          setAuthError(true);
          return;
        }
        setError(message);
      })
      .finally(() => setLoading(false));
  }, [loadMeta]);

  const handleRun = async () => {
    if (!selectedWeek) return;

    setError('');
    resetLog();
    setRunStatus('running');
    abortRef.current = new AbortController();

    try {
      await runToolFUpload(
        {
          tabName: selectedWeek.tabName,
          subWeekLabel: subWeekGridLabel(selectedWeek),
          weekLabel: selectedWeek.label,
        },
        handleSseEvent,
        abortRef.current.signal,
      );
      await loadMeta();
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setRunStatus('cancelled');
      } else {
        setError(err instanceof Error ? err.message : 'Run failed');
        setRunStatus('failed');
      }
    } finally {
      abortRef.current = null;
    }
  };

  const handleCancel = async () => {
    abortRef.current?.abort();
    try {
      await cancelToolFRun();
      setRunStatus('cancelled');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancel failed');
    }
  };

  const handleLoadJobLog = async (jobId: string) => {
    try {
      const { logs } = await fetchToolFJobLog(jobId);
      setSelectedJobId(jobId);
      setLogEntries(logs);
      useToolFStore.setState({
        logLines: logs.map((entry) => entry.message ?? '').filter(Boolean),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load log');
    }
  };

  if (!selectedWeek) {
    return <Navigate to="/banner" replace />;
  }

  if (loading) return <LoadingState message="Loading Tool F…" />;

  return (
    <div>
      <HeaderBar />
      <div className="page-shell space-y-5">
        <PageHeader
          title="Banner Auto Upload"
          description="Bulk upload eligible rows for the selected sub-week. Results show which events were uploaded, skipped, or failed."
          actions={
            <button
              type="button"
              onClick={() => navigate('/banner')}
              className="btn-secondary"
            >
              Back to banner tools
            </button>
          }
        />

        {authError && (
          <div className="panel border-status-error/30 bg-status-errorBg px-4 py-3 text-sm text-status-error">
            Session expired or you are not logged in.{' '}
            <a href="/login" className="font-medium underline">
              Sign in again
            </a>{' '}
            to use banner auto upload.
          </div>
        )}

        {error && (
          <div className="panel border-status-error/30 bg-status-errorBg px-4 py-3 text-sm text-status-error">
            {error}
          </div>
        )}

        <BannerUploadPanel
          runStatus={runStatus}
          logLines={logLines}
          logEntries={logEntries}
          jobs={jobs}
          running={runStatus === 'running'}
          available={available && !authError}
          authError={authError}
          sheetTitle={sheetTitle}
          targetTab={targetTab}
          targetWeekLabel={targetWeekLabel}
          selectedJobId={selectedJobId}
          onRun={handleRun}
          onCancel={handleCancel}
          onLoadJobLog={handleLoadJobLog}
        />
      </div>
    </div>
  );
}
