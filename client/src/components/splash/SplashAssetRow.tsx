import { CdnHealthIndicator } from '../CdnHealthIndicator';
import { CdnUploadButton } from '../CdnUploadButton';
import { CdnUploadStatusActions } from '../CdnUploadStatusActions';
import { StatusBadge } from '../ui/StatusBadge';
import { GoposField } from './GoposField';
import { SortIdBadge } from './SortIdBadge';
import type { SplashRecord } from '../../types';
import { effectiveSplashUploaded } from '../../utils/splashUploadOverrides';
import type { SplashUploadOverrides } from '../../utils/splashUploadOverrides';

function statusVariant(
  status: SplashRecord['status'],
): 'ok' | 'warn' | 'error' | 'neutral' {
  switch (status) {
    case 'scheduled':
    case 'done':
      return 'ok';
    case 'trello_done':
      return 'warn';
    case 'need_to_update_trello':
      return 'error';
    default:
      return 'neutral';
  }
}

function statusLabel(status: SplashRecord['status'], raw: string): string {
  switch (status) {
    case 'need_to_update_trello':
      return 'NEED TO UPDATE TRELLO';
    case 'trello_done':
      return 'TRELLO DONE';
    case 'scheduled':
      return 'SCHEDULED';
    case 'done':
      return 'DONE';
    default:
      return raw || 'Unknown';
  }
}

function formatWindow(start: string | null, end: string | null): string {
  if (!start && !end) return '—';
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta',
      hour12: false,
    });
  if (start && end) return `${fmt(start)} → ${fmt(end)} WIB`;
  if (start) return `${fmt(start)} WIB`;
  return `${fmt(end!)} WIB`;
}

interface BaseProps {
  record: SplashRecord;
  uploadOverrides: SplashUploadOverrides;
  cdnHealthRefreshToken?: number;
  onMarkUploaded?: () => void;
  onRevertUploaded?: () => void;
  showSortId?: boolean;
  duplicateSortId?: boolean;
  checked?: boolean;
  onToggleCheck?: (checked: boolean) => void;
  greyedOut?: boolean;
}

export function SplashAssetRow({
  record,
  uploadOverrides,
  cdnHealthRefreshToken = 0,
  onMarkUploaded,
  onRevertUploaded,
  showSortId = false,
  duplicateSortId = false,
  checked,
  onToggleCheck,
  greyedOut = false,
}: BaseProps) {
  const uploaded = effectiveSplashUploaded(record, uploadOverrides);
  const noDesc = record.descDisplay.startsWith('—');

  return (
    <tr className={greyedOut ? 'opacity-60' : undefined}>
      {onToggleCheck !== undefined && (
        <td className="w-10 px-3 py-3">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onToggleCheck(e.target.checked)}
            className="h-4 w-4 rounded border-line"
          />
        </td>
      )}
      {showSortId && (
        <td className="px-3 py-3">
          <SortIdBadge sortId={record.sortId} duplicate={duplicateSortId} />
        </td>
      )}
      <td className="px-3 py-3">
        <div className="space-y-1">
          <p
            className={`text-sm font-medium ${noDesc ? 'text-ink-muted' : 'text-ink'}`}
          >
            {record.descDisplay}
          </p>
          <p className="text-2xs text-ink-muted">
            {record.assetType === 'splash' ? 'Splash' : 'Anno'} ·{' '}
            {formatWindow(record.start, record.end)}
          </p>
          {record.statusHint && (
            <p className="text-2xs italic text-ink-muted">{record.statusHint}</p>
          )}
          {record.scheduledWithoutUrl && (
            <p className="text-2xs text-status-warn">
              SCHEDULED without CDN URL — inconsistent
            </p>
          )}
        </div>
      </td>
      <td className="px-3 py-3">
        <StatusBadge variant={statusVariant(record.status)}>
          {statusLabel(record.status, record.statusRaw)}
        </StatusBadge>
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-col gap-2">
          <GoposField
            label="GoPos"
            sheetValue={record.sheetGopos}
            lookup={record.goposLookup}
            field="gopos"
          />
          <GoposField
            label="Sub GoPos"
            sheetValue={record.sheetSubGopos}
            lookup={record.goposLookup}
            field="subGopos"
          />
        </div>
      </td>
      <td className="px-3 py-3">
        {record.cdnUrl ? (
          <div className="flex flex-col gap-2">
            <CdnHealthIndicator
              url={record.cdnUrl}
              refreshToken={cdnHealthRefreshToken}
            />
            <CdnUploadButton cdnUrl={record.cdnUrl} />
          </div>
        ) : (
          <span className="text-2xs text-ink-muted">—</span>
        )}
      </td>
      <td className="px-3 py-3">
        {record.status === 'trello_done' && onMarkUploaded && onRevertUploaded && (
          <CdnUploadStatusActions
            effectiveUploaded={uploaded}
            onMarkUploaded={onMarkUploaded}
            onRevertUnuploaded={onRevertUploaded}
          />
        )}
      </td>
    </tr>
  );
}
