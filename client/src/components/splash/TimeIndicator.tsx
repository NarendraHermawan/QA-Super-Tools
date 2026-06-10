import { useEffect, useState } from 'react';
import type { SplashRecord } from '../../types';

function formatWibClock(): string {
  return new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
    hour12: false,
  });
}

function goesLiveSoon(record: SplashRecord, selectedDate: string): string | null {
  if (!record.start) return null;
  const startDate = record.start.slice(0, 10);
  if (startDate !== selectedDate) return null;

  const startMs = new Date(record.start).getTime();
  const nowMs = Date.now();
  const diffMs = startMs - nowMs;
  if (diffMs < 0 || diffMs > 2 * 60 * 60 * 1000) return null;

  const time = new Date(record.start).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
    hour12: false,
  });
  return `Goes live at ${time} WIB — check soon`;
}

interface Props {
  selectedDate: string;
  records: SplashRecord[];
}

export function TimeIndicator({ selectedDate, records }: Props) {
  const [clock, setClock] = useState(formatWibClock());
  const today = new Date().toLocaleDateString('en-CA', {
    timeZone: 'Asia/Jakarta',
  });
  const isToday = selectedDate === today;

  useEffect(() => {
    const timer = window.setInterval(() => setClock(formatWibClock()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const soonFlags = isToday
    ? records
        .map((record) => goesLiveSoon(record, selectedDate))
        .filter((flag): flag is string => Boolean(flag))
    : [];

  return (
    <div className="flex flex-wrap items-center gap-3 text-2xs text-ink-muted">
      <span>
        WIB now: <strong className="text-ink">{clock}</strong>
      </span>
      {soonFlags.slice(0, 3).map((flag) => (
        <span
          key={flag}
          className="rounded border border-status-warn/30 bg-status-warnBg px-2 py-0.5 text-status-warn"
        >
          {flag}
        </span>
      ))}
    </div>
  );
}
