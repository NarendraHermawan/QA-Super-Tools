import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchWeek } from '../api/client';
import { BugControls } from '../components/BugControls';
import { DateFilterBar } from '../components/DateFilterBar';
import { HeaderBar } from '../components/HeaderBar';
import { IncludeCraftlandToggle } from '../components/IncludeCraftlandToggle';
import { PlacementFilter } from '../components/PlacementFilter';
import { SectionDivider } from '../components/SectionDivider';
import {
  ChecklistProgress,
  ToolBChecklistGroups,
} from '../components/ToolBChecklistGroups';
import { useAppStore } from '../store/useAppStore';
import type { BannerRow } from '../types';
import { countCheckedUnique, groupChecklistRows } from '../utils/checklist';
import { defaultDateForWeek, isWeekViewAll } from '../utils/date';
import { applyToolBFilters, splitByCraftland } from '../utils/placements';
import { LoadingState } from '../components/ui/LoadingState';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Toolbar, ToolbarRow } from '../components/ui/Toolbar';
import { EmptyState } from '../components/ui/EmptyState';

export function ToolB() {
  const navigate = useNavigate();
  const selectedWeek = useAppStore((s) => s.selectedWeek);
  const selectedDate = useAppStore((s) => s.selectedDate);
  const setSelectedDate = useAppStore((s) => s.setSelectedDate);
  const selectedPlacements = useAppStore((s) => s.selectedPlacements);
  const togglePlacement = useAppStore((s) => s.togglePlacement);
  const setPlacements = useAppStore((s) => s.setPlacements);
  const includeCraftland = useAppStore((s) => s.includeCraftland);
  const checkedRowIds = useAppStore((s) => s.checkedRowIds);
  const toggleChecked = useAppStore((s) => s.toggleChecked);
  const confirmedBugs = useAppStore((s) => s.confirmedBugs);
  const confirmBug = useAppStore((s) => s.confirmBug);

  const [rows, setRows] = useState<BannerRow[]>([]);
  const [days, setDays] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [brokenRows, setBrokenRows] = useState<Set<string>>(new Set());

  const viewAllWeek = isWeekViewAll(selectedDate);
  const activeDate =
    selectedDate ??
    (selectedWeek
      ? defaultDateForWeek(selectedWeek.start, selectedWeek.end)
      : '');
  const bugReportDate = viewAllWeek
    ? (selectedWeek?.start ?? '')
    : activeDate;

  useEffect(() => {
    if (!selectedWeek) {
      navigate('/');
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
    () => applyToolBFilters(banner, selectedPlacements),
    [banner, selectedPlacements],
  );

  const craftlandFiltered = craftland;

  const bannerGrouped = useMemo(
    () => groupChecklistRows(bannerFiltered, activeDate),
    [bannerFiltered, activeDate],
  );

  const craftlandGrouped = useMemo(
    () => groupChecklistRows(craftlandFiltered, activeDate),
    [craftlandFiltered, activeDate],
  );

  const bannerProgress = useMemo(
    () =>
      countCheckedUnique(
        bannerFiltered,
        activeDate,
        checkedRowIds,
        viewAllWeek,
      ),
    [bannerFiltered, activeDate, checkedRowIds, viewAllWeek],
  );

  const craftlandProgress = useMemo(
    () =>
      countCheckedUnique(
        craftlandFiltered,
        activeDate,
        checkedRowIds,
        viewAllWeek,
      ),
    [craftlandFiltered, activeDate, checkedRowIds, viewAllWeek],
  );

  const bannerVisibleCount = bannerProgress.total;
  const craftlandVisibleCount = craftlandProgress.total;

  const markBroken = (rowId: string) => {
    setBrokenRows((prev) => new Set(prev).add(rowId));
  };

  if (loading) return <LoadingState message="Loading checklist…" />;
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
          title="In-Game QA Checklist"
          description="Verify banner state per day. Craftland maps are optional and tracked separately."
        />

        <StatCard
          label={viewAllWeek ? 'Viewing' : 'Selected day'}
          value={viewAllWeek ? 'Full week' : activeDate}
        />

        <SectionDivider
          title="In-game banners"
          description="Appear, disappear, and still-active checks for lobby and event placements."
        />

        <ChecklistProgress
          checked={bannerProgress.checked}
          total={bannerProgress.total}
        />

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
            <IncludeCraftlandToggle />
          </ToolbarRow>
        </Toolbar>

        {bannerVisibleCount === 0 ? (
          <EmptyState
            title={
              viewAllWeek
                ? 'No banner items this week'
                : 'Nothing to check for banners on this day'
            }
            description="Try another date or clear the placement filter."
          />
        ) : viewAllWeek ? (
          <ToolBChecklistGroups
            flatRows={bannerFiltered}
            flatTitle="All banners this week"
            activeDate={bugReportDate}
            checkedRowIds={checkedRowIds}
            brokenRows={brokenRows}
            confirmedBugs={confirmedBugs}
            onToggleChecked={toggleChecked}
            onBroken={markBroken}
            onConfirmBug={confirmBug}
          />
        ) : (
          <ToolBChecklistGroups
            grouped={bannerGrouped}
            activeDate={bugReportDate}
            checkedRowIds={checkedRowIds}
            brokenRows={brokenRows}
            confirmedBugs={confirmedBugs}
            onToggleChecked={toggleChecked}
            onBroken={markBroken}
            onConfirmBug={confirmBug}
          />
        )}

        {includeCraftland && (
          <>
            <SectionDivider
              title="Craftland maps"
              description="Map-specific QA items from the CRAFTLAND sheet section."
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <StatCard
                label="Craftland progress"
                value={`${craftlandProgress.checked} / ${craftlandProgress.total}`}
              />
              <StatCard
                label="Craftland items today"
                value={craftlandVisibleCount}
              />
            </div>

            {craftlandVisibleCount === 0 ? (
              <EmptyState
                title={
                  viewAllWeek
                    ? 'No Craftland items this week'
                    : 'No Craftland items for this day'
                }
                description="Try another date."
              />
            ) : viewAllWeek ? (
              <ToolBChecklistGroups
                flatRows={craftlandFiltered}
                flatTitle="All Craftland maps this week"
                activeDate={bugReportDate}
                checkedRowIds={checkedRowIds}
                brokenRows={brokenRows}
                confirmedBugs={confirmedBugs}
                onToggleChecked={toggleChecked}
                onBroken={markBroken}
                onConfirmBug={confirmBug}
              />
            ) : (
              <ToolBChecklistGroups
                grouped={craftlandGrouped}
                activeDate={bugReportDate}
                checkedRowIds={checkedRowIds}
                brokenRows={brokenRows}
                confirmedBugs={confirmedBugs}
                onToggleChecked={toggleChecked}
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
