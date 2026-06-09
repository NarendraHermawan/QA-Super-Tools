import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchWeek, refreshWeeks } from '../api/client';
import { BugControls } from '../components/BugControls';
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
  const confirmedBugs = useAppStore((s) => s.confirmedBugs);
  const confirmBug = useAppStore((s) => s.confirmBug);

  const [rows, setRows] = useState<BannerRow[]>([]);
  const [days, setDays] = useState<string[]>([]);
  const [includeUploaded, setIncludeUploaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [brokenRows, setBrokenRows] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  const viewAllWeek = isWeekViewAll(selectedDate);
  const activeDate =
    selectedDate ??
    (selectedWeek
      ? defaultDateForWeek(selectedWeek.start, selectedWeek.end)
      : '');
  const bugReportDate = viewAllWeek
    ? (selectedWeek?.start ?? '')
    : activeDate;

  const filterOpts = {
    activeDate: viewAllWeek ? '' : activeDate,
    includeUploaded,
    viewAllWeek,
    selectedPlacements,
  };
  const weekRange = selectedWeek
    ? { start: selectedWeek.start, end: selectedWeek.end }
    : undefined;

  useEffect(() => {
    if (!selectedWeek) {
      navigate('/banner');
      return;
    }

    setLoading(true);
    fetchWeek(selectedWeek.id)
      .then((data) => {
        setRows(Object.values(data.sections).flat());
        setDays(data.days);
        if (!selectedDate) {
          setSelectedDate(defaultDateForWeek(data.week.start, data.week.end));
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [selectedWeek, selectedDate, setSelectedDate, navigate]);

  const { banner, craftland } = useMemo(
    () => splitByCraftland(rows),
    [rows],
  );

  const bannerFiltered = useMemo(
    () => applyToolAFilters(banner, filterOpts),
    [banner, activeDate, includeUploaded, viewAllWeek, selectedPlacements],
  );

  const craftlandFiltered = useMemo(
    () => applyToolAFilters(craftland, { ...filterOpts, selectedPlacements: [] }),
    [craftland, activeDate, includeUploaded, viewAllWeek],
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
      ),
    [banner, bannerFiltered, activeDate, viewAllWeek, weekRange],
  );

  const craftlandMetrics = useMemo(
    () =>
      computeCdnMetrics(
        craftland,
        craftlandFiltered,
        activeDate,
        viewAllWeek,
        weekRange,
      ),
    [craftland, craftlandFiltered, activeDate, viewAllWeek, weekRange],
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshWeeks();
      if (!selectedWeek) return;
      const data = await fetchWeek(selectedWeek.id);
      setRows(Object.values(data.sections).flat());
    } finally {
      setRefreshing(false);
    }
  };

  const markBroken = (rowId: string) => {
    setBrokenRows((prev) => new Set(prev).add(rowId));
  };

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

        <div className="grid gap-3 sm:grid-cols-3">
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

        <BugControls bugs={confirmedBugs} />

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
              activeDate={bugReportDate}
              brokenRows={brokenRows}
              confirmedBugs={confirmedBugs}
              onBroken={markBroken}
              onConfirmBug={confirmBug}
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
                activeDate={bugReportDate}
                brokenRows={brokenRows}
                confirmedBugs={confirmedBugs}
                onBroken={markBroken}
                onConfirmBug={confirmBug}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
