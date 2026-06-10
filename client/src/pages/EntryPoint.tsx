import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchWeekForDate, fetchWeeks, refreshWeeks } from '../api/client';
import { useAppStore } from '../store/useAppStore';
import type { SubWeek } from '../types';
import { defaultDateForWeek, todayWib } from '../utils/date';
import { LoadingState } from '../components/ui/LoadingState';
import { PageHeader } from '../components/ui/PageHeader';

export function EntryPoint() {
  const navigate = useNavigate();
  const setSelectedWeek = useAppStore((s) => s.setSelectedWeek);
  const setSelectedDate = useAppStore((s) => s.setSelectedDate);

  const [weeks, setWeeks] = useState<SubWeek[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState('');
  const [pickedDate, setPickedDate] = useState(todayWib());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateWarning, setDateWarning] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadWeeks = () =>
    fetchWeeks()
      .then((data) => {
        setWeeks(data.weeks);
        setSelectedWeekId((current) => {
          if (current && data.weeks.some((week) => week.id === current)) {
            return current;
          }
          return data.weeks[0]?.id ?? '';
        });
      });

  useEffect(() => {
    loadWeeks()
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleRefreshWeeks = async () => {
    setRefreshing(true);
    setError('');
    try {
      const data = await refreshWeeks();
      setWeeks(data.weeks);
      setSelectedWeekId((current) => {
        if (current && data.weeks.some((week) => week.id === current)) {
          return current;
        }
        return data.weeks[0]?.id ?? '';
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh weeks');
    } finally {
      setRefreshing(false);
    }
  };

  const startTool = (tool: 'a' | 'b', week: SubWeek, date?: string) => {
    setSelectedWeek(week);
    setSelectedDate(date ?? defaultDateForWeek(week.start, week.end));
    navigate(tool === 'a' ? '/tool-a' : '/tool-b');
  };

  const handleDateMode = async (tool: 'a' | 'b') => {
    setDateWarning('');
    try {
      const { week } = await fetchWeekForDate(pickedDate);
      startTool(tool, week, pickedDate);
    } catch (err) {
      setDateWarning(
        err instanceof Error
          ? err.message
          : 'This date is not covered by any of the 4 most recent weeks.',
      );
    }
  };

  if (loading) return <LoadingState message="Loading available weeks…" />;

  if (error) {
    return (
      <div className="page-shell space-y-4">
        <div className="panel border-status-error/30 bg-status-errorBg px-4 py-3 text-sm text-status-error">
          {error}
        </div>
        <p className="text-sm text-ink-muted">
          Check that <code className="font-mono text-2xs">.env</code> is configured
          and the Google service account has Viewer access to the sheet.
        </p>
      </div>
    );
  }

  return (
    <div className="page-shell space-y-8">
      <PageHeader
        title="Select scope"
        description="Choose a sub-week or a specific date, then open the CDN checker or in-game QA checklist."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel">
          <div className="panel-header">
            <h2 className="text-sm font-semibold text-ink">By week</h2>
            <p className="mt-0.5 text-2xs text-ink-muted">
              Latest 4 sub-weeks from the master sheet
            </p>
          </div>
          <div className="space-y-4 p-3 sm:p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
              <label className="block min-w-0 flex-1">
                <span className="mb-1.5 block text-2xs font-medium uppercase tracking-wide text-ink-muted">
                  Sub-week
                </span>
                <select
                  value={selectedWeekId}
                  onChange={(e) => setSelectedWeekId(e.target.value)}
                  className="field"
                >
                  {weeks.map((week) => (
                    <option key={week.id} value={week.id}>
                      {week.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={handleRefreshWeeks}
                disabled={refreshing}
                className="btn-secondary shrink-0"
              >
                {refreshing ? 'Refreshing…' : 'Refresh weeks'}
              </button>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={() => {
                  const week = weeks.find((w) => w.id === selectedWeekId);
                  if (week) startTool('a', week);
                }}
                className="btn-primary w-full sm:w-auto"
              >
                CDN Checker
              </button>
              <button
                type="button"
                onClick={() => {
                  const week = weeks.find((w) => w.id === selectedWeekId);
                  if (week) startTool('b', week);
                }}
                className="btn-secondary w-full sm:w-auto"
              >
                QA Checklist
              </button>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2 className="text-sm font-semibold text-ink">By date</h2>
            <p className="mt-0.5 text-2xs text-ink-muted">
              Auto-detects the covering sub-week
            </p>
          </div>
          <div className="space-y-4 p-3 sm:p-4">
            <label className="block">
              <span className="mb-1.5 block text-2xs font-medium uppercase tracking-wide text-ink-muted">
                Date (WIB)
              </span>
              <input
                type="date"
                value={pickedDate}
                onChange={(e) => setPickedDate(e.target.value)}
                className="field"
              />
            </label>
            {dateWarning && (
              <p className="text-sm text-status-warn">{dateWarning}</p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={() => handleDateMode('a')}
                className="btn-primary w-full sm:w-auto"
              >
                CDN Checker
              </button>
              <button
                type="button"
                onClick={() => handleDateMode('b')}
                className="btn-secondary w-full sm:w-auto"
              >
                QA Checklist
              </button>
            </div>
          </div>
        </section>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <article className="panel p-4">
          <h3 className="text-sm font-semibold text-ink">Tool A — CDN Checker</h3>
          <p className="mt-1 text-sm text-ink-secondary">
            Lists banners missing CDN upload, grouped by placement. Filter by day
            to see what goes live on a specific date.
          </p>
        </article>
        <article className="panel p-4">
          <h3 className="text-sm font-semibold text-ink">Tool B — QA Checklist</h3>
          <p className="mt-1 text-sm text-ink-secondary">
            Day-by-day view of banners that should appear, disappear, or stay
            active. Check off items as you verify in-game.
          </p>
        </article>
      </section>
    </div>
  );
}
