import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchSplashUploadOverrides,
  fetchSplashWeek,
  refreshSplashWeeks,
  saveSplashUploadOverride,
} from '../api/splash';
import { DateFilterBar } from '../components/DateFilterBar';
import { SplashAssetTypeFilter } from '../components/splash/SplashAssetTypeFilter';
import { SplashCdnTable } from '../components/splash/SplashCdnTable';
import { SplashEventSummaryModal } from '../components/splash/SplashEventSummaryModal';
import { SplashHeaderBar } from '../components/splash/SplashHeaderBar';
import { useSplashStore } from '../store/useSplashStore';
import type { SplashAssetType, SplashRecord } from '../types';
import { clearClientCdnCheckCache } from '../utils/cdnCheckCache';
import { defaultDateForWeek, isWeekViewAll } from '../utils/date';
import {
  applyToolCSplashFilters,
  countSplashMetrics,
} from '../utils/splashFilters';
import { toolCSectionForRecord } from '../utils/splashUploadOverrides';
import { LoadingState } from '../components/ui/LoadingState';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Toolbar, ToolbarRow } from '../components/ui/Toolbar';
import { EmptyState } from '../components/ui/EmptyState';

export function ToolC() {
  const navigate = useNavigate();
  const selectedWeek = useSplashStore((s) => s.selectedWeek);
  const selectedDate = useSplashStore((s) => s.selectedDate);
  const setSelectedDate = useSplashStore((s) => s.setSelectedDate);
  const uploadOverrides = useSplashStore((s) => s.uploadOverrides);
  const setUploadOverridesState = useSplashStore((s) => s.setUploadOverridesState);
  const setUploadOverride = useSplashStore((s) => s.setUploadOverride);

  const [records, setRecords] = useState<SplashRecord[]>([]);
  const [days, setDays] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [selectedAssetTypes, setSelectedAssetTypes] = useState<SplashAssetType[]>(
    [],
  );
  const [brokenRows, setBrokenRows] = useState<Set<string>>(new Set());
  const [cdnHealthRefreshToken, setCdnHealthRefreshToken] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);

  const viewAllWeek = isWeekViewAll(selectedDate);
  const activeDate =
    selectedDate ??
    (selectedWeek
      ? defaultDateForWeek(selectedWeek.start, selectedWeek.end)
      : '');

  useEffect(() => {
    if (!selectedWeek) {
      navigate('/splash');
      return;
    }

    setLoading(true);
    Promise.all([
      fetchSplashWeek(selectedWeek.id),
      fetchSplashUploadOverrides(selectedWeek.id),
    ])
      .then(([data, overrideData]) => {
        setRecords(data.records);
        setDays(data.days);
        setUploadOverridesState(selectedWeek.id, overrideData.overrides);
        if (!selectedDate) {
          setSelectedDate(defaultDateForWeek(data.week.start, data.week.end));
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [
    selectedWeek,
    selectedDate,
    setSelectedDate,
    setUploadOverridesState,
    navigate,
  ]);

  const filtered = useMemo(
    () =>
      applyToolCSplashFilters(records, {
        activeDate: viewAllWeek ? '' : activeDate,
        viewAllWeek,
        includeUploaded: showAll,
        uploadOverrides,
        selectedAssetTypes,
      }),
    [records, activeDate, viewAllWeek, showAll, uploadOverrides, selectedAssetTypes],
  );

  const toggleAssetType = useCallback((assetType: SplashAssetType) => {
    setSelectedAssetTypes((prev) =>
      prev.includes(assetType)
        ? prev.filter((type) => type !== assetType)
        : [...prev, assetType],
    );
  }, []);

  const sections = useMemo(() => {
    const ready: SplashRecord[] = [];
    const assetNotReady: SplashRecord[] = [];
    const needsReview: SplashRecord[] = [];
    const uploaded: SplashRecord[] = [];

    for (const record of filtered) {
      const section = toolCSectionForRecord(record, uploadOverrides);
      if (section === 'ready') ready.push(record);
      else if (section === 'asset_not_ready') assetNotReady.push(record);
      else if (section === 'needs_review') needsReview.push(record);
      else uploaded.push(record);
    }
    return { ready, assetNotReady, needsReview, uploaded };
  }, [filtered, uploadOverrides]);

  const metrics = useMemo(
    () => countSplashMetrics(records, filtered, uploadOverrides),
    [records, filtered, uploadOverrides],
  );

  const handleRefresh = async () => {
    if (!selectedWeek) return;
    setRefreshing(true);
    try {
      clearClientCdnCheckCache();
      setBrokenRows(new Set());
      await refreshSplashWeeks();
      const [data, overrideData] = await Promise.all([
        fetchSplashWeek(selectedWeek.id),
        fetchSplashUploadOverrides(selectedWeek.id),
      ]);
      setRecords(data.records);
      setUploadOverridesState(selectedWeek.id, overrideData.overrides);
      setCdnHealthRefreshToken((t) => t + 1);
    } finally {
      setRefreshing(false);
    }
  };

  const persistOverride = useCallback(
    (rowId: string, uploaded: boolean) => {
      if (!selectedWeek) return;
      setUploadOverride(rowId, uploaded);
      void saveSplashUploadOverride(selectedWeek.id, rowId, uploaded).catch(
        console.error,
      );
    },
    [selectedWeek, setUploadOverride],
  );

  if (loading) return <LoadingState message="Loading upload checker…" />;
  if (error) {
    return (
      <div className="page-shell">
        <div className="panel border-status-error/30 bg-status-errorBg px-4 py-3 text-sm text-status-error">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div>
      <SplashHeaderBar />
      <div className="page-shell space-y-5">
        <PageHeader
          title="Splash & Anno Upload Checker"
          description="Entries needing upload action for the selected sub-week. Filter by day to see what overlaps that date."
          actions={
            <>
              <button
                type="button"
                onClick={() => setSummaryOpen(true)}
                className="btn-secondary"
              >
                Summarize
              </button>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                className="btn-secondary"
              >
                {refreshing ? 'Refreshing…' : 'Refresh sheet'}
              </button>
            </>
          }
        />

        <SplashEventSummaryModal
          open={summaryOpen}
          onClose={() => setSummaryOpen(false)}
          records={records}
          uploadOverrides={uploadOverrides}
          weekLabel={selectedWeek?.label}
        />

        <Toolbar>
          <ToolbarRow label="Day">
            <DateFilterBar
              days={days}
              selectedDate={selectedDate ?? activeDate}
              onSelect={setSelectedDate}
            />
          </ToolbarRow>
          <ToolbarRow label="Placement">
            <SplashAssetTypeFilter
              selected={selectedAssetTypes}
              onToggle={toggleAssetType}
              onClear={() => setSelectedAssetTypes([])}
            />
          </ToolbarRow>
          <ToolbarRow>
            <label className="flex items-center gap-2 text-2xs text-ink-secondary">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
              />
              Show all (including uploaded)
            </label>
          </ToolbarRow>
        </Toolbar>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Ready to upload" value={metrics.ready} />
          <StatCard label="Asset not ready" value={metrics.assetNotReady} />
          <StatCard label="QA marked uploaded" value={metrics.marked} />
          <StatCard label="Rows shown" value={metrics.shown} />
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title="Nothing needs action"
            description="No overlapping entries for this day or week filter."
          />
        ) : (
          <div className="space-y-6">
            <SplashCdnTable
              title="Ready to Upload"
              rows={sections.ready}
              uploadOverrides={uploadOverrides}
              brokenRows={brokenRows}
              cdnHealthRefreshToken={cdnHealthRefreshToken}
              onBroken={(id) => setBrokenRows((p) => new Set(p).add(id))}
              onMarkUploaded={(id) => persistOverride(id, true)}
              onRevertUploaded={(id) => persistOverride(id, false)}
            />
            <SplashCdnTable
              title="Asset Not Ready"
              rows={sections.assetNotReady}
              uploadOverrides={uploadOverrides}
              brokenRows={brokenRows}
              cdnHealthRefreshToken={cdnHealthRefreshToken}
              onBroken={(id) => setBrokenRows((p) => new Set(p).add(id))}
              onMarkUploaded={(id) => persistOverride(id, true)}
              onRevertUploaded={(id) => persistOverride(id, false)}
            />
            <SplashCdnTable
              title="Needs Review"
              rows={sections.needsReview}
              uploadOverrides={uploadOverrides}
              brokenRows={brokenRows}
              cdnHealthRefreshToken={cdnHealthRefreshToken}
              onBroken={(id) => setBrokenRows((p) => new Set(p).add(id))}
              showActions={false}
            />
            {showAll && (
              <SplashCdnTable
                title="Uploaded / Scheduled"
                rows={sections.uploaded}
                uploadOverrides={uploadOverrides}
                includeUploaded
                brokenRows={brokenRows}
                cdnHealthRefreshToken={cdnHealthRefreshToken}
                onBroken={(id) => setBrokenRows((p) => new Set(p).add(id))}
                onMarkUploaded={(id) => persistOverride(id, true)}
                onRevertUploaded={(id) => persistOverride(id, false)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
