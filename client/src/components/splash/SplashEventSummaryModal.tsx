import { useEffect, useMemo, useState } from 'react';
import type { SplashRecord } from '../../types';
import {
  formatSplashEventSummaryForCopy,
  groupAssetsByType,
  summarizeSplashEvents,
  type SplashEventSummaryFilter,
} from '../../utils/splashEventSummary';
import type { SplashUploadOverrides } from '../../utils/splashUploadOverrides';

interface Props {
  open: boolean;
  onClose: () => void;
  records: SplashRecord[];
  uploadOverrides: SplashUploadOverrides;
  weekLabel?: string;
}

const FILTER_LABELS: Record<SplashEventSummaryFilter, string> = {
  not_uploaded: 'Not uploaded',
  uploaded: 'Uploaded',
};

export function SplashEventSummaryModal({
  open,
  onClose,
  records,
  uploadOverrides,
  weekLabel,
}: Props) {
  const [filter, setFilter] = useState<SplashEventSummaryFilter>('not_uploaded');
  const [copied, setCopied] = useState(false);

  const items = useMemo(
    () => summarizeSplashEvents(records, uploadOverrides, filter),
    [records, uploadOverrides, filter],
  );

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setFilter('not_uploaded');
      setCopied(false);
    }
  }, [open]);

  if (!open) return null;

  const handleCopy = async () => {
    const text = formatSplashEventSummaryForCopy(items, {
      filter,
      weekLabel,
    });
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-ink/40"
        aria-label="Close summary"
        onClick={onClose}
      />
      <div
        className="panel relative z-10 flex max-h-[min(85vh,720px)] w-full max-w-2xl flex-col shadow-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="splash-event-summary-title"
      >
        <div className="panel-header flex items-start justify-between gap-3">
          <div>
            <h2
              id="splash-event-summary-title"
              className="text-sm font-semibold text-ink"
            >
              Event summary
            </h2>
            <p className="mt-0.5 text-2xs text-ink-muted">
              {items.length} unique event{items.length === 1 ? '' : 's'} · Splash
              + Announcement
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost text-2xs text-ink-muted"
            aria-label="Close"
          >
            Close
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(FILTER_LABELS) as SplashEventSummaryFilter[]).map(
              (key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={`filter-chip ${
                    filter === key ? 'filter-chip-active' : 'hover:bg-surface-sunken'
                  }`}
                >
                  {FILTER_LABELS[key]}
                </button>
              ),
            )}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            disabled={items.length === 0}
            className="btn-secondary text-sm disabled:opacity-50"
          >
            {copied ? 'Copied' : 'Copy list'}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-muted">
              No events match this filter for the selected week.
            </p>
          ) : (
            <ul className="space-y-4">
              {items.map((item, index) => {
                const byType = groupAssetsByType(item.assets);
                const types = [...byType.keys()].sort((a, b) =>
                  a.localeCompare(b),
                );

                return (
                  <li
                    key={item.eventName}
                    className="border-b border-line pb-4 last:border-b-0 last:pb-0"
                  >
                    <p className="text-2xs font-medium tabular-nums text-ink-muted">
                      {index + 1}.
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap font-medium text-ink">
                      {item.eventName}
                    </p>
                    {types.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        <p className="text-2xs text-ink-muted">
                          {FILTER_LABELS[filter]} assets
                        </p>
                        {types.map((typeLabel) => (
                          <div
                            key={typeLabel}
                            className="flex flex-wrap items-center gap-1.5"
                          >
                            <span className="text-2xs font-medium text-ink-secondary">
                              {typeLabel}:
                            </span>
                            {(byType.get(typeLabel) ?? []).map((tag) => (
                              <span
                                key={`${typeLabel}-${tag}`}
                                className="inline-flex rounded border border-line bg-surface-sunken px-1.5 py-0.5 text-2xs font-medium text-ink-secondary"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
