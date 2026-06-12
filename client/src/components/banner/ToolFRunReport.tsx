import type { ToolFRunReport } from '../../utils/toolFReport';
import { normalizeDash } from '../../utils/dash';

interface Props {
  report: ToolFRunReport;
  sheetTitle?: string | null;
  targetTab?: string | null;
  targetWeekLabel?: string | null;
  emptyMessage?: string;
}

function ReportSection({
  title,
  tone,
  items,
}: {
  title: string;
  tone: 'ok' | 'warn' | 'error';
  items: ToolFRunReport['uploaded'];
}) {
  if (items.length === 0) return null;

  const toneClass =
    tone === 'ok'
      ? 'text-status-ok'
      : tone === 'warn'
        ? 'text-status-warn'
        : 'text-status-error';

  return (
    <div className="space-y-2">
      <h3 className={`text-xs font-semibold uppercase tracking-wide ${toneClass}`}>
        {title} ({items.length})
      </h3>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.message}
            className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
          >
            <p className="font-medium text-ink">{item.eventName}</p>
            {item.detail && item.detail !== item.eventName && (
              <p className="mt-0.5 text-2xs text-ink-muted">{item.detail}</p>
            )}
            {item.cdnUrl && (
              <a
                href={item.cdnUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block break-all text-2xs text-accent hover:underline"
              >
                {item.cdnUrl}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ToolFRunReport({
  report,
  sheetTitle,
  targetTab,
  targetWeekLabel,
  emptyMessage = 'Run upload to see results here.',
}: Props) {
  const tab = normalizeDash(report.tabName ?? targetTab ?? '');
  const subWeek = normalizeDash(report.subWeekLabel ?? targetWeekLabel ?? '');
  const showTab = tab.length > 0;
  const showSubWeek = subWeek.length > 0;
  const hasResults =
    report.uploaded.length > 0 ||
    report.failed.length > 0 ||
    report.skipped.length > 0 ||
    report.errors.length > 0;

  return (
    <div className="space-y-4">
      {(sheetTitle || showTab || showSubWeek) && (
        <div className="rounded-md border border-line bg-surface-sunken px-3 py-2 text-sm">
          {sheetTitle && (
            <p className="text-ink-secondary">
              Workbook: <span className="font-medium text-ink">{sheetTitle}</span>
            </p>
          )}
          {showSubWeek && (
            <p className="text-ink-secondary">
              Sub-week:{' '}
              <span className="font-medium text-ink">{subWeek}</span>
            </p>
          )}
          {showTab && (
            <p className="text-ink-secondary">
              Checklist tab:{' '}
              <span className="font-medium text-ink">{tab}</span>
            </p>
          )}
        </div>
      )}

      {report.summary && (
        <p className="text-sm text-ink-secondary">
          <span className="font-medium text-status-ok">{report.summary.uploaded} uploaded</span>
          {' · '}
          <span className="font-medium text-status-error">{report.summary.failed} failed</span>
          {' · '}
          <span className="font-medium text-status-warn">{report.summary.skipped} skipped</span>
        </p>
      )}

      {!hasResults ? (
        <p className="text-sm text-ink-muted">{emptyMessage}</p>
      ) : (
        <>
          <ReportSection title="CDN uploaded" tone="ok" items={report.uploaded} />
          <ReportSection title="Skipped" tone="warn" items={report.skipped} />
          <ReportSection title="Failed" tone="error" items={report.failed} />
          {report.errors.length > 0 && (
            <div className="space-y-1">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-status-error">
                Errors
              </h3>
              {report.errors.map((err) => (
                <p key={err} className="text-2xs text-status-error">
                  {err}
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
