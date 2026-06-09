import { todayWib } from '../../utils/date';

interface Props {
  iso: string;
  label?: string;
}

function formatWibTime(iso: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return date.toLocaleString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
    hour12: false,
  });
}

export function TimeIndicator({ iso, label }: Props) {
  const dayPart = iso ? iso.slice(0, 10) : '';
  const isToday = dayPart === todayWib();

  return (
    <span className="inline-flex items-center gap-1.5 text-2xs tabular-nums text-ink-secondary">
      {label && <span className="text-ink-faint">{label}</span>}
      <span className="font-mono">{formatWibTime(iso)}</span>
      {isToday && (
        <span className="rounded bg-accent-muted px-1 py-0.5 text-2xs font-medium text-accent-hover">
          WIB
        </span>
      )}
    </span>
  );
}
