import { useMemo } from 'react';
import type { ToolFJob, ToolFLogEntry } from '../../api/toolF';
import { buildToolFRunReport } from '../../utils/toolFReport';
import { ToolFRunReport } from './ToolFRunReport';

interface Props {
  runStatus: string;
  logLines: string[];
  logEntries: ToolFLogEntry[];
  jobs: ToolFJob[];
  running: boolean;
  available: boolean;
  authError?: boolean;
  sheetTitle?: string | null;
  targetTab?: string | null;
  targetWeekLabel?: string | null;
  selectedJobId: string | null;
  onRun: () => void;
  onCancel: () => void;
  onLoadJobLog: (jobId: string) => void;
}

function statusLabel(status: string): string {
  switch (status) {
    case 'running':
      return 'Running';
    case 'completed':
      return 'Complete';
    case 'cancelled':
      return 'Cancelled';
    case 'failed':
      return 'Failed';
    default:
      return 'Idle';
  }
}

export function BannerUploadPanel({
  runStatus,
  logLines,
  logEntries,
  jobs,
  running,
  available,
  authError = false,
  sheetTitle,
  targetTab,
  targetWeekLabel,
  selectedJobId,
  onRun,
  onCancel,
  onLoadJobLog,
}: Props) {
  const liveReport = useMemo(
    () => buildToolFRunReport(logLines, logEntries),
    [logLines, logEntries],
  );

  const selectedJob = selectedJobId
    ? jobs.find((job) => job.id === selectedJobId)
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onRun}
          disabled={!available || running}
          className="btn-primary"
        >
          {running ? 'Running…' : 'Run upload for selected week'}
        </button>
        {running && (
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
        )}
        <span className="text-sm text-ink-secondary">
          Status: <strong>{statusLabel(runStatus)}</strong>
        </span>
      </div>

      {!available && !authError && (
        <p className="text-sm text-status-warn">
          Banner auto upload requires the local worker with CDN API credentials
          (WORKER_URL, CDN_API_TOKEN, NOTION_API_TOKEN). Start it with{' '}
          <code className="text-2xs">npm run dev:worker</code>.
        </p>
      )}

      {(targetWeekLabel || targetTab) && !running && runStatus === 'idle' && (
        <div className="rounded-md border border-line bg-surface-sunken px-3 py-2 text-sm text-ink-secondary">
          {targetWeekLabel && (
            <p>
              Sub-week:{' '}
              <span className="font-medium text-ink">{targetWeekLabel}</span>
            </p>
          )}
          {targetTab && (
            <p className={targetWeekLabel ? 'mt-1' : undefined}>
              Checklist tab:{' '}
              <span className="font-medium text-ink">{targetTab}</span>
              {sheetTitle ? (
                <>
                  {' '}
                  in <span className="font-medium text-ink">{sheetTitle}</span>
                </>
              ) : null}
            </p>
          )}
        </div>
      )}

      <section className="panel overflow-hidden">
        <div className="panel-header">
          <h2 className="text-sm font-semibold text-ink">
            {selectedJobId ? 'Run report' : 'Current run'}
          </h2>
        </div>
        <div className="p-4">
          <ToolFRunReport
            report={liveReport}
            sheetTitle={sheetTitle}
            targetTab={targetTab}
            targetWeekLabel={targetWeekLabel}
            emptyMessage={
              running
                ? 'Processing eligible rows…'
                : 'Run upload to see uploaded, skipped, and failed events here.'
            }
          />
        </div>
      </section>

      {jobs.length > 0 && (
        <section className="panel overflow-hidden">
          <div className="panel-header">
            <h2 className="text-sm font-semibold text-ink">Previous runs</h2>
          </div>
          <ul className="divide-y divide-line">
            {jobs.map((job) => (
              <li
                key={job.id}
                className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm ${
                  selectedJobId === job.id ? 'bg-surface-sunken' : ''
                }`}
              >
                <div>
                  <p className="font-medium text-ink">
                    {new Date(job.triggeredAt).toLocaleString('id-ID')}
                  </p>
                  <p className="text-2xs text-ink-muted">
                    {statusLabel(job.status)} — {job.succeeded} uploaded /{' '}
                    {job.failed} failed / {job.skipped} skipped
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onLoadJobLog(job.id)}
                  className="btn-ghost text-2xs"
                >
                  {selectedJobId === job.id ? 'Showing' : 'View report'}
                </button>
              </li>
            ))}
          </ul>
          {selectedJob && (
            <p className="border-t border-line px-4 py-2 text-2xs text-ink-muted">
              Viewing run from {new Date(selectedJob.triggeredAt).toLocaleString('id-ID')}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
