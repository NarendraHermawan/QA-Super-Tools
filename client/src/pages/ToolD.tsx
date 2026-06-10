import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchSplashChecklist,
  fetchSplashWeek,
  saveSplashChecklistBatch,
  saveSplashChecklistItem,
} from '../api/splash';
import { DateFilterBar } from '../components/DateFilterBar';
import { AssetTypeTabs } from '../components/splash/AssetTypeTabs';
import { SplashCdnTable } from '../components/splash/SplashCdnTable';
import { SplashHeaderBar } from '../components/splash/SplashHeaderBar';
import { TimeIndicator } from '../components/splash/TimeIndicator';
import { useSplashStore } from '../store/useSplashStore';
import type { ChecklistGroup, SplashRecord } from '../types';
import {
  checklistStorageDate,
  groupTitle,
  resolveCheckedForDate,
} from '../utils/checklist';
import { defaultDateForWeek, isWeekViewAll } from '../utils/date';
import { applySplashDayFilter } from '../utils/splashFilters';
import {
  duplicateSortIds,
  groupSplashChecklistRows,
  isSameDaySplash,
  sortBySortId,
} from '../utils/splashChecklist';
import { LoadingState } from '../components/ui/LoadingState';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { Toolbar, ToolbarRow } from '../components/ui/Toolbar';

export function ToolD() {
  const navigate = useNavigate();
  const selectedWeek = useSplashStore((s) => s.selectedWeek);
  const selectedDate = useSplashStore((s) => s.selectedDate);
  const setSelectedDate = useSplashStore((s) => s.setSelectedDate);
  const setWeekDataCache = useSplashStore((s) => s.setWeekDataCache);
  const assetTypeTab = useSplashStore((s) => s.assetTypeTab);
  const setAssetTypeTab = useSplashStore((s) => s.setAssetTypeTab);
  const checklistByDate = useSplashStore((s) => s.checklistByDate);
  const setChecklistWeekState = useSplashStore((s) => s.setChecklistWeekState);
  const mergeChecklistDate = useSplashStore((s) => s.mergeChecklistDate);

  const [records, setRecords] = useState<SplashRecord[]>([]);
  const [days, setDays] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [brokenRows, setBrokenRows] = useState<Set<string>>(new Set());

  const viewAllWeek = isWeekViewAll(selectedDate);
  const activeDate =
    selectedDate ??
    (selectedWeek
      ? defaultDateForWeek(selectedWeek.start, selectedWeek.end)
      : '');
  const storageDate = checklistStorageDate(activeDate, viewAllWeek);

  useEffect(() => {
    if (!selectedWeek) {
      navigate('/splash');
      return;
    }

    const cached = useSplashStore.getState().weekDataCache;
    const hit =
      cached?.weekId === selectedWeek.id ? cached : null;

    if (hit) {
      setRecords(hit.records);
      setDays(hit.days);
      setLoading(false);
      setError('');
      return;
    }

    setLoading(true);
    fetchSplashWeek(selectedWeek.id)
      .then((data) => {
        setWeekDataCache({
          weekId: selectedWeek.id,
          records: data.records,
          days: data.days,
        });
        setRecords(data.records);
        setDays(data.days);
        if (!useSplashStore.getState().selectedDate) {
          setSelectedDate(
            defaultDateForWeek(data.week.start, data.week.end),
          );
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [selectedWeek, setWeekDataCache, setSelectedDate, navigate]);

  useEffect(() => {
    if (!selectedWeek) return;
    let cancelled = false;
    setChecklistLoading(true);
    fetchSplashChecklist(selectedWeek.id)
      .then((state) => {
        if (!cancelled) setChecklistWeekState(selectedWeek.id, state.byDate);
      })
      .finally(() => {
        if (!cancelled) setChecklistLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedWeek, setChecklistWeekState]);

  const dayFiltered = useMemo(
    () =>
      applySplashDayFilter(records, viewAllWeek ? '' : activeDate, viewAllWeek),
    [records, activeDate, viewAllWeek],
  );

  const splashRecords = useMemo(
    () => dayFiltered.filter((r) => r.assetType === 'splash'),
    [dayFiltered],
  );
  const annoRecords = useMemo(
    () => dayFiltered.filter((r) => r.assetType === 'anno'),
    [dayFiltered],
  );

  const tabRecords = assetTypeTab === 'splash' ? splashRecords : annoRecords;

  const grouped = useMemo(
    () => groupSplashChecklistRows(tabRecords, activeDate),
    [tabRecords, activeDate],
  );

  const simultaneouslyActive = useMemo(() => {
    const all = [...grouped.appear, ...grouped.active];
    return [...new Map(all.map((r) => [r.id, r])).values()];
  }, [grouped]);

  const duplicateSorts = useMemo(
    () => duplicateSortIds(simultaneouslyActive),
    [simultaneouslyActive],
  );

  useEffect(() => {
    if (viewAllWeek) return;
    const activeIds = simultaneouslyActive.map((r) => r.id);
    const resolved = resolveCheckedForDate(
      checklistByDate,
      activeDate,
      days,
      activeIds,
      false,
    );
    setCheckedIds(resolved.checkedIds);
    if (resolved.carryOverIds.length > 0 && selectedWeek) {
      saveSplashChecklistBatch(
        selectedWeek.id,
        activeDate,
        resolved.carryOverIds,
      ).then(() => mergeChecklistDate(activeDate, resolved.carryOverIds));
    }
  }, [
    checklistByDate,
    activeDate,
    days,
    simultaneouslyActive,
    selectedWeek,
    mergeChecklistDate,
    viewAllWeek,
  ]);

  const toggleCheck = useCallback(
    (rowId: string, checked: boolean) => {
      if (!selectedWeek) return;
      setCheckedIds((prev) => {
        const next = new Set(prev);
        if (checked) next.add(rowId);
        else next.delete(rowId);
        return next;
      });
      saveSplashChecklistItem(
        selectedWeek.id,
        storageDate,
        rowId,
        checked,
      ).catch(console.error);
    },
    [selectedWeek, storageDate],
  );

  const countProgress = (rows: SplashRecord[]) => {
    const g = groupSplashChecklistRows(rows, activeDate);
    const unique = [
      ...new Map(
        [...g.appear, ...g.disappear, ...g.active].map((r) => [r.id, r]),
      ).values(),
    ];
    return {
      total: unique.length,
      checked: unique.filter((r) => checkedIds.has(r.id)).length,
    };
  };

  const splashProgress = countProgress(splashRecords);
  const annoProgress = countProgress(annoRecords);

  const renderGroup = (group: ChecklistGroup, items: SplashRecord[]) => {
    const sorted = sortBySortId(items);
    if (sorted.length === 0) return null;
    const title =
      group === 'appear'
        ? `▶ ${groupTitle(group)}`
        : group === 'disappear'
          ? `■ ${groupTitle(group)}`
          : `● ${groupTitle(group)}`;

    return (
      <div key={group} className="space-y-2">
        <SplashCdnTable
          title={title}
          rows={sorted}
          uploadOverrides={{}}
          brokenRows={brokenRows}
          cdnHealthRefreshToken={0}
          onBroken={(id) => setBrokenRows((p) => new Set(p).add(id))}
          showActions={false}
          checkedIds={checkedIds}
          onToggleCheck={toggleCheck}
          duplicateSortIds={duplicateSorts}
        />
        {group === 'appear' && sorted.some((r) => isSameDaySplash(r)) && (
          <p className="text-2xs text-status-warn">
            Same-day entries — check at go-live AND after expiry.
          </p>
        )}
      </div>
    );
  };

  if (loading) return <LoadingState message="Loading in-game QA checklist…" />;
  if (error) {
    return (
      <div className="page-shell">
        <div className="panel border-status-error/30 bg-status-errorBg px-4 py-3 text-sm text-status-error">
          {error}
        </div>
      </div>
    );
  }

  const hasRows =
    grouped.appear.length + grouped.disappear.length + grouped.active.length > 0;

  return (
    <div>
      <SplashHeaderBar />
      <div className="page-shell space-y-5">
        <PageHeader
          title="Splash & Anno In-Game QA"
          description="Verify appear, disappear, and still-active entries for the selected day. Overlapping Splash/Anno stay visible when filtering by date."
        />

        <Toolbar>
          <ToolbarRow>
            <DateFilterBar
              days={days}
              selectedDate={selectedDate ?? activeDate}
              onSelect={setSelectedDate}
            />
          </ToolbarRow>
          <ToolbarRow>
            <AssetTypeTabs
              active={assetTypeTab}
              onChange={setAssetTypeTab}
              splashCount={splashProgress}
              annoCount={annoProgress}
            />
            {checklistLoading && (
              <span className="text-2xs text-ink-muted">Syncing checklist…</span>
            )}
          </ToolbarRow>
        </Toolbar>

        <TimeIndicator selectedDate={activeDate} records={tabRecords} />

        {!hasRows ? (
          <EmptyState
            title="No entries for this date"
            description="Pick another day in the sub-week or change scope."
          />
        ) : (
          <div className="space-y-6">
            {renderGroup('appear', grouped.appear)}
            {renderGroup('disappear', grouped.disappear)}
            {renderGroup('active', grouped.active)}
          </div>
        )}
      </div>
    </div>
  );
}
