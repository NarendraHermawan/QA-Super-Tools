import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  fetchSplashBugs,
  fetchSplashChecklist,
  fetchSplashChecks,
  saveSplashCheck,
  saveSplashCheckBatch,
} from '../api/splash';
import { AnnoRow } from '../components/splash/AnnoRow';
import { AssetTypeTabs } from '../components/splash/AssetTypeTabs';
import { SplashHeaderBar } from '../components/splash/SplashHeaderBar';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingState } from '../components/ui/LoadingState';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Toolbar, ToolbarRow } from '../components/ui/Toolbar';
import { useSplashStore } from '../store/useSplashStore';
import type { SplashChecklistGroups, SplashConfirmedBug } from '../types';
import { formatDayTab } from '../utils/date';
import { resolveSplashCheckedForDate } from '../utils/splashChecklist';

function ChecklistGroupTable({
  title,
  records,
  duplicateSortIds,
  checkedIds,
  carryOverIds,
  onToggle,
}: {
  title: string;
  records: SplashChecklistGroups['appear'];
  duplicateSortIds: Set<number>;
  checkedIds: Set<string>;
  carryOverIds: Set<string>;
  onToggle: (recordId: string) => void;
}) {
  if (records.length === 0) return null;

  return (
    <section className="panel overflow-hidden">
      <div className="panel-header">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <p className="mt-0.5 text-2xs text-ink-muted tabular-nums">
          {records.length} item{records.length === 1 ? '' : 's'}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-8" />
              <th>Description</th>
              <th>Schedule</th>
              <th>Unique ID</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <AnnoRow
                key={record.recordId}
                record={record}
                duplicateSortIds={duplicateSortIds}
                brokenRows={new Set()}
                confirmedBugs={[]}
                bugDate=""
                onBroken={() => {}}
                onConfirmBug={() => {}}
                checked={checkedIds.has(record.recordId)}
                onToggleCheck={onToggle}
                carryOver={carryOverIds.has(record.recordId)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ToolD() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const monthId = useSplashStore((s) => s.monthId);
  const selectedDate = useSplashStore((s) => s.selectedDate);
  const activeTab = useSplashStore((s) => s.activeTab);
  const setMonthId = useSplashStore((s) => s.setMonthId);
  const setSelectedDate = useSplashStore((s) => s.setSelectedDate);
  const setActiveTab = useSplashStore((s) => s.setActiveTab);
  const checklistByDate = useSplashStore((s) => s.checklistByDate);
  const setChecklistMonthState = useSplashStore((s) => s.setChecklistMonthState);
  const mergeChecklistDate = useSplashStore((s) => s.mergeChecklistDate);
  const setChecklistDate = useSplashStore((s) => s.setChecklistDate);

  const [loading, setLoading] = useState(true);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [error, setError] = useState('');
  const [groups, setGroups] = useState<SplashChecklistGroups>({
    appear: [],
    disappear: [],
    active: [],
  });
  const [duplicateSortIds, setDuplicateSortIds] = useState<number[]>([]);
  const [monthDays, setMonthDays] = useState<string[]>([]);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [carryOverIds, setCarryOverIds] = useState<Set<string>>(new Set());
  const [confirmedBugs, setConfirmedBugs] = useState<SplashConfirmedBug[]>([]);

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

    const [year, month] = activeMonth.split('-').map(Number);
    const days: string[] = [];
    const cursor = new Date(Date.UTC(year, month - 1, 1));
    while (cursor.getUTCMonth() === month - 1) {
      days.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    setMonthDays(days);

    setLoading(true);
    fetchSplashChecklist(activeMonth, activeDate, activeTab)
      .then((data) => {
        setGroups(data.groups);
        setDuplicateSortIds(data.duplicateSortIds);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [activeMonth, activeDate, activeTab, navigate]);

  useEffect(() => {
    if (!activeMonth) return;

    let cancelled = false;
    setChecklistLoading(true);
    fetchSplashChecks(activeMonth)
      .then((state) => {
        if (!cancelled) setChecklistMonthState(activeMonth, state.byDate);
      })
      .catch((err: Error) => {
        if (!cancelled) console.error('Failed to load splash checks:', err);
      })
      .finally(() => {
        if (!cancelled) setChecklistLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeMonth, setChecklistMonthState]);

  useEffect(() => {
    if (!activeMonth || !activeDate) return;
    fetchSplashBugs(activeMonth, activeDate)
      .then((data) => setConfirmedBugs(data.bugs))
      .catch(() => setConfirmedBugs([]));
  }, [activeMonth, activeDate]);

  const allGroupRecords = useMemo(() => {
    const map = new Map<string, SplashChecklistGroups['appear'][0]>();
    for (const r of [...groups.appear, ...groups.disappear, ...groups.active]) {
      map.set(r.recordId, r);
    }
    return [...map.values()];
  }, [groups]);

  useEffect(() => {
    const activeRowIds = allGroupRecords.map((r) => r.recordId);
    const resolved = resolveSplashCheckedForDate(
      checklistByDate,
      activeDate,
      monthDays,
      activeRowIds,
    );
    setCheckedIds(resolved.checkedIds);
    setCarryOverIds(new Set(resolved.carryOverIds));

    if (resolved.carryOverIds.length > 0) {
      saveSplashCheckBatch(activeMonth, activeDate, resolved.carryOverIds)
        .then(() =>
          mergeChecklistDate(activeDate, [...resolved.checkedIds]),
        )
        .catch((err) => console.error('Carry-over save failed:', err));
    }
  }, [
    checklistByDate,
    activeDate,
    monthDays,
    allGroupRecords,
    activeMonth,
    mergeChecklistDate,
  ]);

  const duplicateSet = useMemo(
    () => new Set(duplicateSortIds),
    [duplicateSortIds],
  );

  const progress = useMemo(() => {
    const total = allGroupRecords.length;
    const checked = allGroupRecords.filter((r) =>
      checkedIds.has(r.recordId),
    ).length;
    return { total, checked };
  }, [allGroupRecords, checkedIds]);

  const onToggle = useCallback(
    async (recordId: string) => {
      if (!activeMonth || !activeDate) return;
      const nextChecked = !checkedIds.has(recordId);
      const next = new Set(checkedIds);
      if (nextChecked) next.add(recordId);
      else next.delete(recordId);
      setCheckedIds(next);
      setChecklistDate(activeDate, [...next]);

      try {
        await saveSplashCheck(activeMonth, activeDate, recordId, nextChecked);
      } catch (err) {
        console.error('Failed to save splash check:', err);
      }
    },
    [activeMonth, activeDate, checkedIds, setChecklistDate],
  );

  if (loading) return <LoadingState message="Loading in-game QA checklist…" />;

  return (
    <div>
      <SplashHeaderBar />
      <div className="page-shell space-y-6">
        <PageHeader
          title="Tool D — In-Game QA"
          description="Verify splash and announcement schedules appear correctly in-game."
        />

        {error && (
          <div className="panel border-status-error/30 bg-status-errorBg px-4 py-3 text-sm text-status-error">
            {error}
          </div>
        )}

        <Toolbar>
          <ToolbarRow>
            <AssetTypeTabs active={activeTab} onChange={setActiveTab} />
            <div className="flex flex-wrap gap-2">
              {monthDays.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelectedDate(day)}
                  className={`filter-chip ${
                    activeDate === day
                      ? 'filter-chip-active'
                      : 'hover:bg-surface-sunken'
                  }`}
                >
                  {formatDayTab(day)}
                </button>
              ))}
            </div>
          </ToolbarRow>
        </Toolbar>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Progress"
            value={`${progress.checked}/${progress.total}`}
            hint={checklistLoading ? 'Loading saved checks…' : 'Checked today'}
          />
          <StatCard
            label="Confirmed bugs"
            value={String(confirmedBugs.length)}
            hint="This date"
          />
          <StatCard
            label="Duplicate Sort IDs"
            value={String(duplicateSortIds.length)}
            hint="Active cohort warnings"
          />
        </div>

        {allGroupRecords.length === 0 ? (
          <EmptyState title="No checklist items for this date and asset type." />
        ) : (
          <div className="space-y-6">
            <ChecklistGroupTable
              title="Should APPEAR today"
              records={groups.appear}
              duplicateSortIds={duplicateSet}
              checkedIds={checkedIds}
              carryOverIds={carryOverIds}
              onToggle={onToggle}
            />
            <ChecklistGroupTable
              title="Should DISAPPEAR today"
              records={groups.disappear}
              duplicateSortIds={duplicateSet}
              checkedIds={checkedIds}
              carryOverIds={carryOverIds}
              onToggle={onToggle}
            />
            <ChecklistGroupTable
              title="Still active"
              records={groups.active}
              duplicateSortIds={duplicateSet}
              checkedIds={checkedIds}
              carryOverIds={carryOverIds}
              onToggle={onToggle}
            />
          </div>
        )}
      </div>
    </div>
  );
}
