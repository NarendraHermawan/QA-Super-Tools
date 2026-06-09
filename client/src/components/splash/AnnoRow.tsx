import type { SplashConfirmedBug, SplashRecord } from '../../types';
import { SplashRow } from './SplashRow';

interface Props {
  record: SplashRecord;
  duplicateSortIds: Set<number>;
  brokenRows: Set<string>;
  confirmedBugs: SplashConfirmedBug[];
  bugDate: string;
  onBroken: (rowId: string) => void;
  onConfirmBug: (bug: SplashConfirmedBug) => void;
  checked?: boolean;
  onToggleCheck?: (recordId: string) => void;
  carryOver?: boolean;
}

export function AnnoRow({
  record,
  duplicateSortIds,
  brokenRows,
  confirmedBugs,
  bugDate,
  onBroken,
  onConfirmBug,
  checked,
  onToggleCheck,
  carryOver,
}: Props) {
  if (onToggleCheck) {
    return (
      <tr className={checked ? 'bg-status-okBg/40' : ''}>
        <td className="w-8">
          <input
            type="checkbox"
            checked={checked ?? false}
            onChange={() => onToggleCheck(record.recordId)}
            className="h-3.5 w-3.5 rounded border-line"
          />
        </td>
        <td>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex min-w-[1.75rem] items-center justify-center rounded px-1.5 py-0.5 font-mono text-2xs tabular-nums ${
                record.sortId !== null && duplicateSortIds.has(record.sortId)
                  ? 'bg-status-errorBg text-status-error'
                  : 'bg-surface-sunken text-ink-secondary'
              }`}
            >
              {record.sortId ?? '—'}
            </span>
            <div>
              <p className="font-medium text-ink">{record.desc || '—'}</p>
              {carryOver && (
                <p className="text-2xs text-ink-muted">Carried from earlier day</p>
              )}
            </div>
          </div>
        </td>
        <td className="text-2xs tabular-nums text-ink-secondary">
          {record.start.slice(0, 10)} → {record.end.slice(0, 10)}
        </td>
        <td className="text-2xs text-ink-secondary">
          {record.uniqueId || '—'}
        </td>
      </tr>
    );
  }

  return (
    <SplashRow
      record={record}
      duplicateSortIds={duplicateSortIds}
      brokenRows={brokenRows}
      confirmedBugs={confirmedBugs}
      bugDate={bugDate}
      onBroken={onBroken}
      onConfirmBug={onConfirmBug}
    />
  );
}
