import type { ReactNode } from 'react';
import { EventNameWithTag } from '../EventNameWithTag';
import { CdnHealthIndicator } from '../CdnHealthIndicator';
import { CdnUploadButton } from '../CdnUploadButton';
import { CdnUploadStatusActions } from '../CdnUploadStatusActions';
import { StatusBadge } from '../ui/StatusBadge';
import { GoposField } from './GoposField';
import type { SplashRecord } from '../../types';
import { splashStatusLabel, splashStatusVariant } from '../../utils/splashStatus';
import {
  effectiveSplashUploaded,
  canMarkSplashUploaded,
  type SplashUploadOverrides,
} from '../../utils/splashUploadOverrides';

interface Props {
  title: string;
  rows: SplashRecord[];
  uploadOverrides: SplashUploadOverrides;
  includeUploaded?: boolean;
  brokenRows: Set<string>;
  cdnHealthRefreshToken: number;
  onBroken?: (rowId: string) => void;
  onMarkUploaded?: (rowId: string) => void;
  onRevertUploaded?: (rowId: string) => void;
  showActions?: boolean;
  checkedIds?: Set<string>;
  onToggleCheck?: (rowId: string, checked: boolean) => void;
  duplicateSortIds?: Set<number>;
}

function formatActivePeriod(
  start: string | null,
  end: string | null,
): ReactNode {
  if (!start && !end) return '—';
  const fmt = (iso: string) => iso.slice(0, 16).replace('T', ' ');
  if (start && end) {
    return (
      <>
        {fmt(start)}
        <br />
        <span className="text-ink-faint">to</span> {fmt(end)}
      </>
    );
  }
  return fmt(start ?? end!);
}

export function SplashCdnTable({
  title,
  rows,
  uploadOverrides,
  includeUploaded = false,
  brokenRows,
  cdnHealthRefreshToken,
  onBroken,
  onMarkUploaded,
  onRevertUploaded,
  showActions = true,
  checkedIds,
  onToggleCheck,
  duplicateSortIds,
}: Props) {
  if (rows.length === 0) return null;

  return (
    <section className="panel overflow-hidden">
      <div className="panel-header flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <span className="text-2xs tabular-nums text-ink-muted">
          {rows.length} row{rows.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              {onToggleCheck && <th className="w-10" />}
              <th className="w-[22%]">Event</th>
              <th className="w-[11%]">Status</th>
              <th className="w-[24%]">CDN path</th>
              <th className="w-[14%]">GoPos / Sub GoPos</th>
              <th className="w-[14%]">Active period</th>
              <th className="w-[15%]">Health</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((record) => {
              const uploaded = effectiveSplashUploaded(record, uploadOverrides);
              const greyed = uploaded && includeUploaded;
              const isBroken = brokenRows.has(record.id);
              const assetLabel =
                record.assetType === 'splash' ? 'Splash' : 'Anno';
              const dup =
                record.sortId !== null &&
                duplicateSortIds?.has(record.sortId);

              return (
                <tr
                  key={record.id}
                  className={`${greyed ? 'opacity-50' : ''} ${
                    isBroken ? 'bg-status-warnBg/60' : ''
                  }`}
                >
                  {onToggleCheck && (
                    <td>
                      <input
                        type="checkbox"
                        checked={checkedIds?.has(record.id)}
                        onChange={(e) =>
                          onToggleCheck(record.id, e.target.checked)
                        }
                        className="h-4 w-4 rounded border-line"
                      />
                    </td>
                  )}
                  <td>
                    <EventNameWithTag
                      displayName={record.descDisplay}
                      assetTag={assetLabel}
                    />
                    {record.statusHint && (
                      <p className="mt-1 text-2xs italic text-ink-muted">
                        {record.statusHint}
                      </p>
                    )}
                    {dup && (
                      <p className="mt-1 text-2xs text-status-warn">
                        Duplicate Sort_ID #{record.sortId}
                      </p>
                    )}
                    {record.scheduledWithoutUrl && (
                      <p className="mt-1 text-2xs text-status-warn">
                        SCHEDULED without CDN URL
                      </p>
                    )}
                  </td>
                  <td>
                    <StatusBadge variant={splashStatusVariant(record.status)}>
                      {splashStatusLabel(record.status, record.statusRaw)}
                    </StatusBadge>
                  </td>
                  <td>
                    <p className="cdn-path">
                      {record.cdnUrl ?? '—'}
                    </p>
                    <CdnUploadButton cdnUrl={record.cdnUrl} />
                  </td>
                  <td>
                    <div className="space-y-2">
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
                  <td className="text-2xs tabular-nums text-ink-secondary">
                    {formatActivePeriod(record.start, record.end)}
                  </td>
                  <td>
                    <div className="flex flex-col items-start gap-1.5">
                      {record.cdnUrl ? (
                        <CdnHealthIndicator
                          url={record.cdnUrl}
                          refreshToken={cdnHealthRefreshToken}
                          onBroken={() => onBroken?.(record.id)}
                        />
                      ) : (
                        <StatusBadge variant="neutral">N/A</StatusBadge>
                      )}
                      {showActions &&
                        canMarkSplashUploaded(record.status) &&
                        onMarkUploaded &&
                        onRevertUploaded && (
                          <CdnUploadStatusActions
                            effectiveUploaded={uploaded}
                            onMarkUploaded={() => onMarkUploaded(record.id)}
                            onRevertUnuploaded={() =>
                              onRevertUploaded(record.id)
                            }
                          />
                        )}
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
