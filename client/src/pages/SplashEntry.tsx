import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchSplashConfig,
  fetchSplashMonths,
  fetchSplashSummary,
} from '../api/splash';
import { LoadingState } from '../components/ui/LoadingState';
import { PageHeader } from '../components/ui/PageHeader';
import { useSplashStore } from '../store/useSplashStore';
import { formatDayTab, todayWib } from '../utils/date';

function currentMonthId(): string {
  return todayWib().slice(0, 7);
}

export function SplashEntry() {
  const navigate = useNavigate();
  const setMonthId = useSplashStore((s) => s.setMonthId);
  const setSelectedDate = useSplashStore((s) => s.setSelectedDate);

  const [months, setMonths] = useState<string[]>([]);
  const [configured, setConfigured] = useState(true);
  const [monthId, setLocalMonth] = useState(currentMonthId());
  const [selectedDate, setLocalDate] = useState(todayWib());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState({
    activeCount: 0,
    readyCount: 0,
    blockedCount: 0,
  });

  const days = useMemo(() => {
    const [year, month] = monthId.split('-').map(Number);
    if (!year || !month) return [];
    const result: string[] = [];
    const cursor = new Date(Date.UTC(year, month - 1, 1));
    while (cursor.getUTCMonth() === month - 1) {
      result.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return result;
  }, [monthId]);

  useEffect(() => {
    fetchSplashConfig()
      .then((cfg) => {
        setConfigured(cfg.configured);
        if (!cfg.configured) return;
        return fetchSplashMonths().then((data) => {
          const list = data.months;
          setMonths(list);
          const current = currentMonthId();
          if (list.includes(current)) setLocalMonth(current);
          else if (list[0]) setLocalMonth(list[0]);
        });
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!configured || !monthId || !selectedDate) return;
    fetchSplashSummary(monthId, selectedDate)
      .then(setSummary)
      .catch(() => setSummary({ activeCount: 0, readyCount: 0, blockedCount: 0 }));
  }, [configured, monthId, selectedDate]);

  const openTool = (tool: 'c' | 'd') => {
    setMonthId(monthId);
    setSelectedDate(selectedDate);
    const params = new URLSearchParams({ month: monthId, date: selectedDate });
    navigate(tool === 'c' ? `/tool-c?${params}` : `/tool-d?${params}`);
  };

  if (loading) return <LoadingState message="Loading splash configuration…" />;

  if (!configured) {
    return (
      <div className="page-shell space-y-4">
        <PageHeader
          title="Splash & Anno"
          description="In-game publishing QA tools"
        />
        <div className="panel border-status-warn/30 bg-status-warnBg px-4 py-3 text-sm text-status-warn">
          SPLASH_SHEET_ID is not configured. Set it in server .env to use Tool C
          and Tool D.
        </div>
      </div>
    );
  }

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
    <div className="page-shell space-y-8">
      <PageHeader
        title="Splash & Anno — Select scope"
        description="Pick a calendar month and day, then open the upload checker or in-game QA checklist."
      />

      <section className="panel">
        <div className="panel-header flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">Month</h2>
            <p className="mt-0.5 text-2xs text-ink-muted">
              Scoped by Start Splash date in ID - Settings
            </p>
          </div>
          <select
            value={monthId}
            onChange={(e) => {
              setLocalMonth(e.target.value);
              const firstDay = `${e.target.value}-01`;
              setLocalDate(firstDay);
            }}
            className="field max-w-[12rem]"
          >
            {months.length === 0 && (
              <option value={monthId}>{monthId}</option>
            )}
            {months.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div className="space-y-4 p-4">
          <div className="flex flex-wrap gap-2">
            {days.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => setLocalDate(day)}
                className={`filter-chip ${
                  selectedDate === day
                    ? 'filter-chip-active'
                    : 'hover:bg-surface-sunken'
                }`}
              >
                {formatDayTab(day)}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="filter-chip filter-chip-active tabular-nums">
              {summary.activeCount} active
            </span>
            <span className="text-2xs text-ink-muted tabular-nums">
              {summary.readyCount} ready to upload · {summary.blockedCount} blocked
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => openTool('c')} className="btn-primary">
              Upload Checker (Tool C)
            </button>
            <button type="button" onClick={() => openTool('d')} className="btn-secondary">
              In-Game QA (Tool D)
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <article className="panel p-4">
          <h3 className="text-sm font-semibold text-ink">Tool C — Upload Checker</h3>
          <p className="mt-1 text-sm text-ink-secondary">
            Ready-to-upload, blocked, and needs-review assets grouped by splash,
            anno, or both.
          </p>
        </article>
        <article className="panel p-4">
          <h3 className="text-sm font-semibold text-ink">Tool D — In-Game QA</h3>
          <p className="mt-1 text-sm text-ink-secondary">
            Day-by-day appear, disappear, and still-active groups with persistent
            checkboxes and carry-over.
          </p>
        </article>
      </section>
    </div>
  );
}
