import { BugRowActions } from './BugControls';
import { CdnHealthIndicator } from './CdnHealthIndicator';
import type { BannerRow, CanonicalPlacement, ConfirmedBug } from '../types';
import { rowStateLabel, rowStateVariant } from '../utils/checklist';
import { StatusBadge } from './ui/StatusBadge';

interface Props {
  placement: CanonicalPlacement;
  rows: BannerRow[];
  includeUploaded: boolean;
  activeDate: string;
  brokenRows: Set<string>;
  confirmedBugs: ConfirmedBug[];
  onBroken: (rowId: string) => void;
  onConfirmBug: (bug: ConfirmedBug) => void;
}

export function ToolACdnTable({
  placement,
  rows,
  includeUploaded,
  activeDate,
  brokenRows,
  confirmedBugs,
  onBroken,
  onConfirmBug,
}: Props) {
  if (rows.length === 0) return null;

  return (
    <section className="panel overflow-hidden">
      <div className="panel-header flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">{placement}</h2>
        <span className="text-2xs tabular-nums text-ink-muted">
          {rows.length} row{rows.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-[28%]">Event / Map</th>
              <th className="w-[12%]">Status</th>
              <th className="w-[32%]">CDN path</th>
              <th className="w-[14%]">Active period</th>
              <th className="w-[14%]">Health</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const greyed = row.cdnUploaded && includeUploaded;
              const isBroken = brokenRows.has(row.id);
              const isConfirmed = confirmedBugs.some((b) => b.id === row.id);
              return (
                <tr
                  key={row.id}
                  className={`${greyed ? 'opacity-50' : ''} ${
                    isBroken ? 'bg-status-warnBg/60' : ''
                  }`}
                >
                  <td>
                    <p className="font-medium text-ink">{row.displayName}</p>
                  </td>
                  <td>
                    <StatusBadge variant={rowStateVariant(row.rowState)}>
                      {rowStateLabel(row.rowState)}
                    </StatusBadge>
                  </td>
                  <td>
                    <p className="cdn-path">
                      {row.cdnUrl ?? row.cdnLink ?? '—'}
                    </p>
                  </td>
                  <td className="text-2xs tabular-nums text-ink-secondary">
                    {row.startTime ? (
                      <>
                        {row.startTime.slice(0, 10)}
                        <br />
                        <span className="text-ink-faint">to</span>{' '}
                        {row.endTime.slice(0, 10)}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <div className="flex flex-col items-start gap-1.5">
                      <CdnHealthIndicator
                        url={row.cdnUrl}
                        onBroken={() => onBroken(row.id)}
                      />
                      <BugRowActions
                        onConfirm={onConfirmBug}
                        rowId={row.id}
                        eventName={row.displayName}
                        placement={row.placement}
                        cdnUrl={row.cdnUrl}
                        date={activeDate}
                        isBroken={isBroken}
                        isConfirmed={isConfirmed}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
