import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchUploadOverrides,
  saveUploadOverride,
} from '../api/checklist';
import { fetchWeek, refreshWeeks } from '../api/client';
import { DateFilterBar } from '../components/DateFilterBar';
import { HeaderBar } from '../components/HeaderBar';
import { IncludeCraftlandToggle } from '../components/IncludeCraftlandToggle';
import { PlacementFilter } from '../components/PlacementFilter';
import { SectionDivider } from '../components/SectionDivider';
import { ToolACdnTable } from '../components/ToolACdnTable';
import { useAppStore } from '../store/useAppStore';
import { BANNER_PLACEMENTS, CRAFTLAND_PLACEMENT } from '../types';
import { defaultDateForWeek, isWeekViewAll } from '../utils/date';
import {
  applyToolAFilters,
  computeCdnMetrics,
  groupRowsByPlacement,
  splitByCraftland,
} from '../utils/placements';
import { clearClientCdnCheckCache } from '../utils/cdnCheckCache';
import { countMarkedUploaded } from '../utils/uploadOverrides';
import { LoadingState } from '../components/ui/LoadingState';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Toolbar, ToolbarRow } from '../components/ui/Toolbar';
import { EmptyState } from '../components/ui/EmptyState';
import type { BannerRow } from '../types';

export function ToolA() {
  const navigate = useNavigate();
  const selectedWeek = useAppStore((s) => s.selectedWeek);
  const selectedDate = useAppStore((s) => s.selectedDate);
  const setSelectedDate = useAppStore((s) => s.setSelectedDate);
  const selectedPlacements = useAppStore((s) => s.selectedPlacements);
  const togglePlacement = useAppStore((s) => s.togglePlacement);
  const setPlacements = useAppStore((s) => s.setPlacements);
  const includeCraftland = useAppStore((s) => s.includeCraftland);
  const uploadOverrides = useAppStore((s) => s.uploadOverrides);
  const setUploadOverridesState = useAppStore((s) => s.setUploadOverridesState);
  const setUploadOverride = useAppStore((s) => s.setUploadOverride);

  const [rows, setRows] = useState<BannerRow[]>([]);
  const [days, setDays] = useState<string[]>([]);
  const [includeUploaded, setIncludeUploaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [brokenRows, setBrokenRows] = useState<Set<string>>(new Set());
  const [cdnHealthRefreshToken, setCdnHealthRefreshToken] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const viewAllWeek = isWeekViewAll(selectedDate);
  const activeDate =
    selectedDate ??
    (selectedWeek
      ? defaultDateForWeek(selectedWeek.start, selectedWeek.end)
      : '');
  const filterOpts = {
    activeDate: viewAllWeek ? '' : activeDate,
    includeUploaded,
    viewAllWeek,
    selectedPlacements,
    uploadOverrides,
  };
  const weekRange = selectedWeek
    ? { start: selectedWeek.start, end: selectedWeek.end }
    : undefined;

  useEffect(() => {
    if (!selectedWeek) {
      navigate('/');
      return;
    }

    setLoading(true);
    Promise.all([
      fetchWeek(selectedWeek.id),
      fetchUploadOverrides(selectedWeek.id),
    ])
      .then(([data, overrideData]) => {
        setRows(Object.values(data.sections).flat());
        setDays(data.days);
        setUploadOverridesState(selectedWeek.id, overrideData.overrides);
        if (!selectedDate) {
          setSelectedDate(defaultDateForWeek(data.week.start, data.week.end));
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [selectedWeek, selectedDate, setSelectedDate, setUploadOverridesState, navigate]);

  const { banner, craftland } = useMemo(
    () => splitByCraftland(rows),
    [rows],
  );

  const bannerFiltered = useMemo(
    () => applyToolAFilters(banner, filterOpts),
    [banner, filterOpts],
  );

  const craftlandFiltered = useMemo(
    () =>
      applyToolAFilters(craftland, {
        ...filterOpts,
        selectedPlacements: [],
      }),
    [craftland, filterOpts],
  );

  const bannerGrouped = useMemo(
    () => groupRowsByPlacement(bannerFiltered, BANNER_PLACEMENTS),
    [bannerFiltered],
  );

  const bannerMetrics = useMemo(
    () =>
      computeCdnMetrics(
        banner,
        bannerFiltered,
        activeDate,
        viewAllWeek,
        weekRange,
        uploadOverrides,
      ),
    [banner, bannerFiltered, activeDate, viewAllWeek, weekRange, uploadOverrides],
  );

  const craftlandMetrics = useMemo(
    () =>
      computeCdnMetrics(
        craftland,
        craftlandFiltered,
        activeDate,
        viewAllWeek,
        weekRange,
        uploadOverrides,
      ),
    [craftland, craftlandFiltered, activeDate, viewAllWeek, weekRange, uploadOverrides],
  );

  const markedUploadedCount = useMemo(
    () => countMarkedUploaded(uploadOverrides),
    [uploadOverrides],
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      clearClientCdnCheckCache();
      setBrokenRows(new Set());
      await refreshWeeks();
      if (!selectedWeek) return;
      const [data, overrideData] = await Promise.all([
        fetchWeek(selectedWeek.id),
        fetchUploadOverrides(selectedWeek.id),
      ]);
      setRows(Object.values(data.sections).flat());
      setUploadOverridesState(selectedWeek.id, overrideData.overrides);
      setCdnHealthRefreshToken((token) => token + 1);
    } finally {
      setRefreshing(false);
    }
  };

  const markBroken = (rowId: string) => {
    setBrokenRows((prev) => new Set(prev).add(rowId));
  };

  const persistUploadOverride = useCallback(
    (rowId: string, uploaded: boolean) => {
      if (!selectedWeek) return;
      setUploadOverride(rowId, uploaded);
      void saveUploadOverride(selectedWeek.id, rowId, uploaded).catch(
        (err: Error) => console.error('Failed to save upload override:', err),
      );
    },
    [selectedWeek, setUploadOverride],
  );

  const handleMarkUploaded = useCallback(
    (rowId: string) => persistUploadOverride(rowId, true),
    [persistUploadOverride],
  );

  const handleRevertUnuploaded = useCallback(
    (rowId: string) => persistUploadOverride(rowId, false),
    [persistUploadOverride],
  );

  if (loading) return <LoadingState message="Loading CDN data…" />;
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
      <HeaderBar />
      <div className="page-shell space-y-5">
        <PageHeader
          title="CDN Upload Checker"
          description="In-game banner CDN status. Craftland maps are tracked separately."
          actions={
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="btn-secondary"
            >
              {refreshing ? 'Refreshing…' : 'Refresh sheet'}
            </button>
          }
        />

        <SectionDivider
          title="In-game banners"
          description="Overview, mall, gacha, event, and esports placements."
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Missing CDN (week)" value={bannerMetrics.missingWeek} />
          <StatCard
            label={viewAllWeek ? 'Go live this week' : 'Go live selected day'}
            value={bannerMetrics.goLiveDay}
            hint={
              viewAllWeek
                ? `${selectedWeek?.start} – ${selectedWeek?.end}`
                : activeDate
            }
          />
          <StatCard
            label="QA marked uploaded"
            value={markedUploadedCount}
            hint="Manual marks this week"
          />
          <StatCard
            label="Rows shown"
            value={bannerMetrics.rowsShown}
            hint={
              viewAllWeek
                ? includeUploaded
                  ? 'Full week, incl. uploaded'
                  : 'Full week, missing only'
                : includeUploaded
                  ? 'Including uploaded'
                  : 'Missing only'
            }
          />
        </div>

        <Toolbar>
          <ToolbarRow label="Day">
            <DateFilterBar
              days={days}
              selectedDate={activeDate}
              onSelect={setSelectedDate}
            />
          </ToolbarRow>
          <ToolbarRow label="Placement">
            <PlacementFilter
              selected={selectedPlacements}
              onToggle={togglePlacement}
              onClear={() => setPlacements([])}
            />
          </ToolbarRow>
          <ToolbarRow>
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink-secondary">
              <input
                type="checkbox"
                checked={includeUploaded}
                onChange={(e) => setIncludeUploaded(e.target.checked)}
                className="rounded border-line text-accent focus:ring-accent/30"
              />
              Include uploaded rows
            </label>
            <IncludeCraftlandToggle />
          </ToolbarRow>
        </Toolbar>

        {bannerMetrics.rowsShown === 0 ? (
          <EmptyState
            title="No banner rows match current filters"
            description="Try another day, clear the placement filter, or enable uploaded rows."
          />
        ) : (
          BANNER_PLACEMENTS.map((placement) => (
            <ToolACdnTable
              key={placement}
              placement={placement}
              rows={bannerGrouped[placement]}
              includeUploaded={includeUploaded}
              uploadOverrides={uploadOverrides}
              brokenRows={brokenRows}
              cdnHealthRefreshToken={cdnHealthRefreshToken}
              onBroken={markBroken}
              onMarkUploaded={handleMarkUploaded}
              onRevertUnuploaded={handleRevertUnuploaded}
            />
          ))
        )}

        {includeCraftland && (
          <>
            <SectionDivider
              title="Craftland maps"
              description="Map assets with separate CDN schema. Category rows without URLs are excluded from health checks."
            />

            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard
                label="Craftland missing CDN"
                value={craftlandMetrics.missingWeek}
              />
              <StatCard
                label={viewAllWeek ? 'Craftland go live (week)' : 'Craftland go live'}
                value={craftlandMetrics.goLiveDay}
                hint={
                  viewAllWeek
                    ? `${selectedWeek?.start} – ${selectedWeek?.end}`
                    : activeDate
                }
              />
              <StatCard
                label="Craftland rows shown"
                value={craftlandMetrics.rowsShown}
                hint={
                  viewAllWeek
                    ? includeUploaded
                      ? 'Full week, incl. uploaded'
                      : 'Full week, missing only'
                    : includeUploaded
                      ? 'Including uploaded'
                      : 'Missing only'
                }
              />
            </div>

            {craftlandMetrics.rowsShown === 0 ? (
              <EmptyState
                title="No Craftland rows for this day"
                description="Try another day or enable uploaded rows."
              />
            ) : (
              <ToolACdnTable
                placement={CRAFTLAND_PLACEMENT}
                rows={craftlandFiltered}
                includeUploaded={includeUploaded}
                uploadOverrides={uploadOverrides}
                brokenRows={brokenRows}
                cdnHealthRefreshToken={cdnHealthRefreshToken}
                onBroken={markBroken}
                onMarkUploaded={handleMarkUploaded}
                onRevertUnuploaded={handleRevertUnuploaded}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
