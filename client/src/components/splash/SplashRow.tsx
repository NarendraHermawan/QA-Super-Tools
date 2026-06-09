import { CdnHealthIndicator } from '../CdnHealthIndicator';
import type { SplashConfirmedBug, SplashRecord } from '../../types';
import { StatusBadge } from '../ui/StatusBadge';
import {
  splashStatusLabel,
  splashStatusVariant,
} from '../../utils/splashChecklist';
import { SplashBugActions } from './SplashBugActions';
import { SortIdBadge } from './SortIdBadge';
import { TimeIndicator } from './TimeIndicator';

interface Props {
  record: SplashRecord;
  duplicateSortIds: Set<number>;
  brokenRows: Set<string>;
  confirmedBugs: SplashConfirmedBug[];
  bugDate: string;
  onBroken: (rowId: string) => void;
  onConfirmBug: (bug: SplashConfirmedBug) => void;
}

export function SplashRow({
  record,
  duplicateSortIds,
  brokenRows,
  confirmedBugs,
  bugDate,
  onBroken,
  onConfirmBug,
}: Props) {
  const isBroken = brokenRows.has(record.recordId);
  const isConfirmed = confirmedBugs.some((b) => b.id === record.recordId);

  return (
    <tr className={isBroken ? 'bg-status-warnBg/60' : ''}>
      <td>
        <div className="flex items-center gap-2">
          <SortIdBadge
            sortId={record.sortId}
            duplicate={record.sortId !== null && duplicateSortIds.has(record.sortId)}
          />
          <p className="font-medium text-ink">{record.desc || '—'}</p>
        </div>
      </td>
      <td>
        <StatusBadge variant={splashStatusVariant(record.status)}>
          {splashStatusLabel(record.status)}
        </StatusBadge>
      </td>
      <td>
        <p className="cdn-path">{record.cdnUrl ?? '—'}</p>
      </td>
      <td className="text-2xs">
        <TimeIndicator iso={record.start} label="start" />
        <br />
        <TimeIndicator iso={record.end} label="end" />
      </td>
      <td>
        {record.cdnUrl ? (
          <CdnHealthIndicator
            url={record.cdnUrl}
            onBroken={() => onBroken(record.recordId)}
          />
        ) : (
          <span className="text-2xs text-ink-faint">No URL</span>
        )}
        <SplashBugActions
          rowId={record.recordId}
          eventName={record.desc}
          assetType={record.assetType}
          cdnUrl={record.cdnUrl}
          date={bugDate}
          isBroken={isBroken}
          isConfirmed={isConfirmed}
          onConfirm={onConfirmBug}
        />
      </td>
    </tr>
  );
}
