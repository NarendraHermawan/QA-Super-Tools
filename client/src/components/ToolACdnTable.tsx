import { EventNameWithTag } from './EventNameWithTag';
import { CdnHealthIndicator } from './CdnHealthIndicator';
import { CdnUploadButton } from './CdnUploadButton';
import { CdnUploadStatusActions } from './CdnUploadStatusActions';
import { MobileFieldRow } from './ui/MobileFieldRow';
import type { BannerRow, CanonicalPlacement } from '../types';
import { rowStateLabel, rowStateVariant } from '../utils/checklist';
import {
  effectiveCdnUploaded,
  effectiveRowState,
  type UploadOverrides,
} from '../utils/uploadOverrides';
import { StatusBadge } from './ui/StatusBadge';

interface Props {
  placement: CanonicalPlacement;
  rows: BannerRow[];
  includeUploaded: boolean;
  uploadOverrides: UploadOverrides;
  brokenRows: Set<string>;
  cdnHealthRefreshToken: number;
  onBroken: (rowId: string) => void;
  onMarkUploaded: (rowId: string) => void;
  onRevertUnuploaded: (rowId: string) => void;
}

export function ToolACdnTable({
  placement,
  rows,
  includeUploaded,
  uploadOverrides,
  brokenRows,
  cdnHealthRefreshToken,
  onBroken,
  onMarkUploaded,
  onRevertUnuploaded,
}: Props) {
  if (rows.length === 0) return null;

  return (
    <section className="panel overflow-hidden">
      <div className="panel-header flex items-center justify-between gap-2">
        <h2 className="min-w-0 text-sm font-semibold text-ink">{placement}</h2>
        <span className="shrink-0 text-2xs tabular-nums text-ink-muted">
          {rows.length} row{rows.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="mobile-card-list">
        {rows.map((row) => {
          const uploaded = effectiveCdnUploaded(row, uploadOverrides);
          const greyed = uploaded && includeUploaded;
          const isBroken = brokenRows.has(row.id);
          const rowState = effectiveRowState(row, uploadOverrides);

          return (
            <article
              key={row.id}
              className={`mobile-card ${greyed ? 'opacity-50' : ''} ${
                isBroken ? 'bg-status-warnBg/60' : ''
              }`}
            >
              <EventNameWithTag
                displayName={row.displayName}
                assetTag={row.assetTag}
              />
              <MobileFieldRow label="Status">
                <StatusBadge variant={rowStateVariant(rowState)}>
                  {rowStateLabel(rowState)}
                </StatusBadge>
              </MobileFieldRow>
              <MobileFieldRow label="CDN path">
                <p className="cdn-path">{row.cdnUrl ?? row.cdnLink ?? '—'}</p>
                <CdnUploadButton cdnUrl={row.cdnUrl} cdnLink={row.cdnLink} />
              </MobileFieldRow>
              <MobileFieldRow label="Active period">
                <p className="text-sm tabular-nums text-ink-secondary">
                  {row.startTime ? (
                    <>
                      {row.startTime.slice(0, 10)}
                      <span className="text-ink-faint"> to </span>
                      {row.endTime.slice(0, 10)}
                    </>
                  ) : (
                    '—'
                  )}
                </p>
              </MobileFieldRow>
              <MobileFieldRow label="Health">
                <div className="flex flex-col items-start gap-1.5">
                  <CdnHealthIndicator
                    url={row.cdnUrl}
                    refreshToken={cdnHealthRefreshToken}
                    onBroken={() => onBroken(row.id)}
                  />
                  <CdnUploadStatusActions
                    effectiveUploaded={uploaded}
                    onMarkUploaded={() => onMarkUploaded(row.id)}
                    onRevertUnuploaded={() => onRevertUnuploaded(row.id)}
                  />
                </div>
              </MobileFieldRow>
            </article>
          );
        })}
      </div>

      <div className="table-scroll hidden md:block">
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
              const uploaded = effectiveCdnUploaded(row, uploadOverrides);
              const greyed = uploaded && includeUploaded;
              const isBroken = brokenRows.has(row.id);
              const rowState = effectiveRowState(row, uploadOverrides);
              return (
                <tr
                  key={row.id}
                  className={`${greyed ? 'opacity-50' : ''} ${
                    isBroken ? 'bg-status-warnBg/60' : ''
                  }`}
                >
                  <td>
                    <EventNameWithTag
                      displayName={row.displayName}
                      assetTag={row.assetTag}
                    />
                  </td>
                  <td>
                    <StatusBadge variant={rowStateVariant(rowState)}>
                      {rowStateLabel(rowState)}
                    </StatusBadge>
                  </td>
                  <td>
                    <p className="cdn-path">
                      {row.cdnUrl ?? row.cdnLink ?? '—'}
                    </p>
                    <CdnUploadButton
                      cdnUrl={row.cdnUrl}
                      cdnLink={row.cdnLink}
                    />
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
                        refreshToken={cdnHealthRefreshToken}
                        onBroken={() => onBroken(row.id)}
                      />
                      <CdnUploadStatusActions
                        effectiveUploaded={uploaded}
                        onMarkUploaded={() => onMarkUploaded(row.id)}
                        onRevertUnuploaded={() => onRevertUnuploaded(row.id)}
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
