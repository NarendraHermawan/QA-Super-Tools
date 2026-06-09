import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  fetchSplashBugs,
  fetchSplashUpload,
  refreshSplashData,
  saveSplashBug,
} from '../api/splash';
import { CdnHealthIndicator } from '../components/CdnHealthIndicator';
import { SplashHeaderBar } from '../components/splash/SplashHeaderBar';
import { SplashBugActions } from '../components/splash/SplashBugActions';
import { SortIdBadge } from '../components/splash/SortIdBadge';
import { TimeIndicator } from '../components/splash/TimeIndicator';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingState } from '../components/ui/LoadingState';
import { PageHeader } from '../components/ui/PageHeader';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Toolbar, ToolbarRow } from '../components/ui/Toolbar';
import { useSplashStore } from '../store/useSplashStore';
import type { SplashConfirmedBug, SplashRecord } from '../types';
import {
  groupMergedUploadByAsset,
  mergeUploadRowsForDisplay,
  splashStatusLabel,
  splashStatusVariant,
  type MergedUploadRow,
} from '../utils/splashChecklist';

function UploadSectionTable({
  title,
  rows,
  duplicateSortIds,
  brokenRows,
  confirmedBugs,
  bugDate,
  onBroken,
  onConfirmBug,
  variant,
}: {
  title: string;
  rows: MergedUploadRow[];
  duplicateSortIds: Set<number>;
  brokenRows: Set<string>;
  confirmedBugs: SplashConfirmedBug[];
  bugDate: string;
  onBroken: (rowId: string) => void;
  onConfirmBug: (bug: SplashConfirmedBug) => void;
  variant: 'ok' | 'warn' | 'error' | 'neutral';
}) {
  if (rows.length === 0) return null;

  const renderRecordHealth = (record: SplashRecord) => {
    const isBroken = brokenRows.has(record.recordId);
    const isConfirmed = confirmedBugs.some((b) => b.id === record.recordId);
    return (
      <div className="space-y-1">
        {record.cdnUrl ? (
          <CdnHealthIndicator
            url={record.cdnUrl}
            onBroken={() => onBroken(record.recordId)}
          />
        ) : (
          <span className="text-2xs text-ink-faint">No URL</span>
        )}
        <SplashBugActions
          rowId={record.recordId}
          eventName={record.desc}
          assetType={record.assetType}
          cdnUrl={record.cdnUrl}
          date={bugDate}
          isBroken={isBroken}
          isConfirmed={isConfirmed}
          onConfirm={onConfirmBug}
        />
      </div>
    );
  };

  return (
    <section className="panel overflow-hidden">
      <div className="panel-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          <StatusBadge variant={variant}>{rows.length}</StatusBadge>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Type</th>
              <th>Status</th>
              <th>CDN</th>
              <th>Schedule</th>
              <th>Health</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const primary = row.record ?? row.splash ?? row.anno!;
              const rowBroken =
                (row.splash && brokenRows.has(row.splash.recordId)) ||
                (row.anno && brokenRows.has(row.anno.recordId)) ||
                (row.record && brokenRows.has(row.record.recordId));

              return (
                <tr
                  key={row.key}
                  className={rowBroken ? 'bg-status-warnBg/60' : ''}
                >
                  <td>
                    <div className="flex items-center gap-2">
                      <SortIdBadge
                        sortId={primary.sortId}
                        duplicate={
                          primary.sortId !== null &&
                          duplicateSortIds.has(primary.sortId)
                        }
                      />
                      <span className="font-medium text-ink">
                        {row.desc || '—'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <StatusBadge variant="neutral">
                      {row.group === 'both' ? 'Both' : row.group}
                    </StatusBadge>
                  </td>
                  <td>
                    <StatusBadge variant={splashStatusVariant(primary.status)}>
                      {splashStatusLabel(primary.status)}
                    </StatusBadge>
                  </td>
                  <td className="cdn-path">
                    {row.group === 'both' ? (
                      <div className="space-y-1 text-2xs">
                        <p>S: {row.splash?.cdnUrl ?? '—'}</p>
                        <p>A: {row.anno?.cdnUrl ?? '—'}</p>
                      </div>
                    ) : (
                      primary.cdnUrl ?? '—'
                    )}
                  </td>
                  <td className="text-2xs">
                    <TimeIndicator iso={primary.start} label="start" />
                    <br />
                    <TimeIndicator iso={primary.end} label="end" />
                  </td>
                  <td>
                    {row.group === 'both' ? (
                      <div className="space-y-2">
                        {row.splash && renderRecordHealth(row.splash)}
                        {row.anno && renderRecordHealth(row.anno)}
                      </div>
                    ) : (
                      renderRecordHealth(primary)
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ToolC() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const monthId = useSplashStore((s) => s.monthId);
  const selectedDate = useSplashStore((s) => s.selectedDate);
  const setMonthId = useSplashStore((s) => s.setMonthId);
  const setSelectedDate = useSplashStore((s) => s.setSelectedDate);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [sections, setSections] = useState({
    ready: [] as SplashRecord[],
    blocked: [] as SplashRecord[],
    needsReview: [] as SplashRecord[],
    scheduled: [] as SplashRecord[],
  });
  const [duplicateSortIds, setDuplicateSortIds] = useState<number[]>([]);
  const [brokenRows, setBrokenRows] = useState<Set<string>>(new Set());
  const [confirmedBugs, setConfirmedBugs] = useState<SplashConfirmedBug[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const activeMonth = monthId ?? params.get('month') ?? '';
  const activeDate = selectedDate ?? params.get('date') ?? '';

  useEffect(() => {
    if (params.get('month')) setMonthId(params.get('month')!);
    if (params.get('date')) setSelectedDate(params.get('date')!);
  }, [params, setMonthId, setSelectedDate]);

  useEffect(() => {
    if (!activeMonth || !activeDate) {
      navigate('/splash');
      return;
    }

    setLoading(true);
    fetchSplashUpload(activeMonth, activeDate, showAll)
      .then((data) => {
        setSections(data.sections);
        setDuplicateSortIds(data.duplicateSortIds);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [activeMonth, activeDate, showAll, navigate]);

  useEffect(() => {
    if (!activeMonth || !activeDate) return;
    fetchSplashBugs(activeMonth, activeDate)
      .then((data) => setConfirmedBugs(data.bugs))
      .catch(() => setConfirmedBugs([]));
  }, [activeMonth, activeDate]);

  const duplicateSet = useMemo(
    () => new Set(duplicateSortIds),
    [duplicateSortIds],
  );

  const readyMerged = useMemo(
    () => groupMergedUploadByAsset(mergeUploadRowsForDisplay(sections.ready)),
    [sections.ready],
  );
  const blockedMerged = useMemo(
    () => groupMergedUploadByAsset(mergeUploadRowsForDisplay(sections.blocked)),
    [sections.blocked],
  );
  const reviewMerged = useMemo(
    () =>
      groupMergedUploadByAsset(mergeUploadRowsForDisplay(sections.needsReview)),
    [sections.needsReview],
  );
  const scheduledMerged = useMemo(
    () =>
      groupMergedUploadByAsset(mergeUploadRowsForDisplay(sections.scheduled)),
    [sections.scheduled],
  );

  const onBroken = useCallback((rowId: string) => {
    setBrokenRows((prev) => new Set(prev).add(rowId));
  }, []);

  const onConfirmBug = useCallback(
    async (bug: SplashConfirmedBug) => {
      if (!activeMonth) return;
      await saveSplashBug(activeMonth, bug);
      setConfirmedBugs((prev) => [...prev, bug]);
    },
    [activeMonth],
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshSplashData();
      const data = await fetchSplashUpload(activeMonth, activeDate, showAll);
      setSections(data.sections);
      setDuplicateSortIds(data.duplicateSortIds);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) return <LoadingState message="Loading upload checker data…" />;

  const tableProps = {
    duplicateSortIds: duplicateSet,
    brokenRows,
    confirmedBugs,
    bugDate: activeDate,
    onBroken,
    onConfirmBug,
  };

  const totalRows =
    sections.ready.length +
    sections.blocked.length +
    sections.needsReview.length +
    sections.scheduled.length;

  return (
    <div>
      <SplashHeaderBar />
      <div className="page-shell space-y-6">
        <PageHeader
          title="Tool C — Upload Checker"
          description="Splash and announcement assets that need CDN upload or review."
        />

        {error && (
          <div className="panel border-status-error/30 bg-status-errorBg px-4 py-3 text-sm text-status-error">
            {error}
          </div>
        )}

        <Toolbar>
          <ToolbarRow>
            <label className="flex items-center gap-2 text-sm text-ink-secondary">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-line"
              />
              Show all (include scheduled)
            </label>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="btn-secondary"
            >
              {refreshing ? 'Refreshing…' : 'Refresh sheet'}
            </button>
          </ToolbarRow>
        </Toolbar>

        {totalRows === 0 ? (
          <EmptyState title="No upload items for this date." />
        ) : (
          <div className="space-y-6">
            <UploadSectionTable
              title="Ready to upload"
              rows={[
                ...readyMerged.both,
                ...readyMerged.splash,
                ...readyMerged.anno,
              ]}
              variant="warn"
              {...tableProps}
            />
            <UploadSectionTable
              title="Blocked"
              rows={[
                ...blockedMerged.both,
                ...blockedMerged.splash,
                ...blockedMerged.anno,
              ]}
              variant="error"
              {...tableProps}
            />
            <UploadSectionTable
              title="Needs review"
              rows={[
                ...reviewMerged.both,
                ...reviewMerged.splash,
                ...reviewMerged.anno,
              ]}
              variant="warn"
              {...tableProps}
            />
            {showAll && (
              <UploadSectionTable
                title="Scheduled"
                rows={[
                  ...scheduledMerged.both,
                  ...scheduledMerged.splash,
                  ...scheduledMerged.anno,
                ]}
                variant="neutral"
                {...tableProps}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
