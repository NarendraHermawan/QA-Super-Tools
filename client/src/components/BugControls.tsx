import type { ConfirmedBug } from '../types';

interface Props {
  onConfirm: (bug: ConfirmedBug) => void;
  rowId: string;
  eventName: string;
  placement: ConfirmedBug['placement'];
  cdnUrl: string | null;
  date: string;
  isBroken: boolean;
  isConfirmed: boolean;
}

export function BugRowActions({
  onConfirm,
  rowId,
  eventName,
  placement,
  cdnUrl,
  date,
  isBroken,
  isConfirmed,
}: Props) {
  if (!isBroken) return null;

  return (
    <button
      type="button"
      disabled={isConfirmed}
      onClick={() =>
        onConfirm({ id: rowId, eventName, placement, cdnUrl, date })
      }
      className="btn-ghost text-2xs text-status-warn disabled:opacity-50"
    >
      {isConfirmed ? 'Bug confirmed' : 'Confirm bug'}
    </button>
  );
}

interface BugControlsProps {
  bugs: ConfirmedBug[];
}

export function BugControls({ bugs }: BugControlsProps) {
  const copyReport = async () => {
    if (bugs.length === 0) return;
    const text = bugs
      .map(
        (bug, index) =>
          `${index + 1}. ${bug.eventName}\n   Placement: ${bug.placement}\n   CDN: ${bug.cdnUrl ?? 'N/A'}\n   Date: ${bug.date}`,
      )
      .join('\n\n');
    await navigator.clipboard.writeText(
      `FFID Banner QA Bug Report\n\n${text}`,
    );
  };

  if (bugs.length === 0) return null;

  return (
    <div className="panel flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <p className="text-sm text-ink-secondary">
        <span className="font-semibold text-ink">{bugs.length}</span> confirmed
        CDN bug{bugs.length === 1 ? '' : 's'}
      </p>
      <button type="button" onClick={copyReport} className="btn-primary text-sm">
        Copy bug report
      </button>
    </div>
  );
}
