import type { ReactNode } from 'react';
import { EventNameWithTag } from './EventNameWithTag';
import { CdnHealthIndicator } from './CdnHealthIndicator';
import { CdnUploadButton } from './CdnUploadButton';
import { MobileFieldRow } from './ui/MobileFieldRow';
import type { BannerRow, ChecklistGroup } from '../types';
import { groupTitle, isSingleDayBanner } from '../utils/checklist';
import { StatusBadge } from './ui/StatusBadge';

const GROUP_META: Record<
  ChecklistGroup,
  { variant: 'ok' | 'warn' | 'neutral'; code: string }
> = {
  appear: { variant: 'ok', code: 'NEW' },
  disappear: { variant: 'warn', code: 'END' },
  active: { variant: 'neutral', code: 'ON' },
};

interface Props {
  grouped?: {
    appear: BannerRow[];
    disappear: BannerRow[];
    active: BannerRow[];
  };
  flatRows?: BannerRow[];
  flatTitle?: string;
  checkedRowIds: Set<string>;
  brokenRows: Set<string>;
  onToggleChecked: (rowId: string) => void;
  onBroken: (rowId: string) => void;
}

function renderMobileCard(
  row: BannerRow,
  group: ChecklistGroup | 'all',
  checkedRowIds: Set<string>,
  brokenRows: Set<string>,
  onToggleChecked: (rowId: string) => void,
  onBroken: (rowId: string) => void,
  notesColumn: 'period' | 'notes',
) {
  const checked = checkedRowIds.has(row.id);
  const singleDay = isSingleDayBanner(row);
  const isBroken = brokenRows.has(row.id);

  return (
    <article
      key={`mobile-${group}-${row.id}`}
      className={`mobile-card ${checked ? 'bg-surface opacity-70' : ''} ${
        isBroken ? 'bg-status-warnBg/60' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggleChecked(row.id)}
          aria-label={`Mark ${row.displayName} as verified`}
          className="mt-1 h-5 w-5 shrink-0 rounded border-line text-accent focus:ring-accent/30"
        />
        <div className="min-w-0 flex-1 space-y-3">
          <EventNameWithTag
            displayName={row.displayName}
            assetTag={row.assetTag}
            strikethrough={checked}
          />
          <MobileFieldRow label="Placement">
            <p className="text-sm text-ink-secondary">{row.placement}</p>
          </MobileFieldRow>
          <MobileFieldRow label="CDN">
            <StatusBadge variant={row.cdnUploaded ? 'ok' : 'warn'}>
              {row.cdnUploaded ? 'Uploaded' : 'Missing'}
            </StatusBadge>
          </MobileFieldRow>
          <MobileFieldRow label="Health">
            <div className="flex flex-col items-start gap-1.5">
              <CdnHealthIndicator
                url={row.cdnUrl}
                onBroken={() => onBroken(row.id)}
              />
              <CdnUploadButton cdnUrl={row.cdnUrl} cdnLink={row.cdnLink} />
            </div>
          </MobileFieldRow>
          <MobileFieldRow
            label={notesColumn === 'period' ? 'Active period' : 'Notes'}
          >
            <p className="text-sm tabular-nums text-ink-secondary">
              {row.startTime ? (
                <>
                  {row.startTime.slice(0, 10)}
                  <span className="text-ink-faint"> – </span>
                  {row.endTime.slice(0, 10)}
                </>
              ) : (
                '—'
              )}
              {singleDay && (
                <span className="mt-1 block text-xs text-status-warn">
                  Single-day — verify morning and evening
                </span>
              )}
            </p>
          </MobileFieldRow>
        </div>
      </div>
    </article>
  );
}

function renderRow(
  row: BannerRow,
  group: ChecklistGroup | 'all',
  checkedRowIds: Set<string>,
  brokenRows: Set<string>,
  onToggleChecked: (rowId: string) => void,
  onBroken: (rowId: string) => void,
) {
  const checked = checkedRowIds.has(row.id);
  const singleDay = isSingleDayBanner(row);
  const isBroken = brokenRows.has(row.id);
  return (
    <tr
      key={`${group}-${row.id}`}
      className={`${checked ? 'bg-surface opacity-70' : ''} ${
        isBroken ? 'bg-status-warnBg/60' : ''
      }`}
    >
      <td>
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggleChecked(row.id)}
          aria-label={`Mark ${row.displayName} as verified`}
          className="rounded border-line text-accent focus:ring-accent/30"
        />
      </td>
      <td>
        <EventNameWithTag
          displayName={row.displayName}
          assetTag={row.assetTag}
          strikethrough={checked}
        />
      </td>
      <td className="text-2xs text-ink-secondary">{row.placement}</td>
      <td>
        <StatusBadge variant={row.cdnUploaded ? 'ok' : 'warn'}>
          {row.cdnUploaded ? 'Uploaded' : 'Missing'}
        </StatusBadge>
      </td>
      <td>
        <div className="flex flex-col items-start gap-1.5">
          <CdnHealthIndicator
            url={row.cdnUrl}
            onBroken={() => onBroken(row.id)}
          />
          <CdnUploadButton cdnUrl={row.cdnUrl} cdnLink={row.cdnLink} />
        </div>
      </td>
      <td className="text-2xs tabular-nums text-ink-secondary">
        {row.startTime ? (
          <>
            {row.startTime.slice(0, 10)}
            <span className="text-ink-faint"> – </span>
            {row.endTime.slice(0, 10)}
          </>
        ) : (
          '—'
        )}
        {singleDay && (
          <p className="mt-1 text-status-warn">
            Single-day — verify morning and evening
          </p>
        )}
      </td>
    </tr>
  );
}

function ChecklistSection({
  title,
  badge,
  count,
  rows,
  group,
  checkedRowIds,
  brokenRows,
  onToggleChecked,
  onBroken,
  notesColumn,
}: {
  title: string;
  badge?: ReactNode;
  count: number;
  rows: BannerRow[];
  group: ChecklistGroup | 'all';
  checkedRowIds: Set<string>;
  brokenRows: Set<string>;
  onToggleChecked: (rowId: string) => void;
  onBroken: (rowId: string) => void;
  notesColumn: 'period' | 'notes';
}) {
  return (
    <section className="panel overflow-hidden">
      <div className="panel-header flex items-center gap-3">
        {badge}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          <p className="text-2xs text-ink-muted">
            {count} item{count === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      <div className="mobile-card-list">
        {rows.map((row) =>
          renderMobileCard(
            row,
            group,
            checkedRowIds,
            brokenRows,
            onToggleChecked,
            onBroken,
            notesColumn,
          ),
        )}
      </div>

      <div className="table-scroll hidden md:block">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-10" />
              <th className="w-[26%]">Event / Map</th>
              <th className="w-[16%]">Placement</th>
              <th className="w-[12%]">CDN</th>
              <th className="w-[14%]">Health</th>
              <th className="w-[32%]">
                {notesColumn === 'period' ? 'Active period' : 'Notes'}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) =>
              renderRow(
                row,
                group,
                checkedRowIds,
                brokenRows,
                onToggleChecked,
                onBroken,
              ),
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ToolBChecklistGroups({
  grouped,
  flatRows,
  flatTitle = 'All week',
  checkedRowIds,
  brokenRows,
  onToggleChecked,
  onBroken,
}: Props) {
  if (flatRows) {
    if (flatRows.length === 0) return null;
    const sorted = [...flatRows].sort((a, b) =>
      (a.startTime || '').localeCompare(b.startTime || ''),
    );
    return (
      <ChecklistSection
        title={flatTitle}
        count={sorted.length}
        rows={sorted}
        group="all"
        checkedRowIds={checkedRowIds}
        brokenRows={brokenRows}
        onToggleChecked={onToggleChecked}
        onBroken={onBroken}
        notesColumn="period"
      />
    );
  }

  if (!grouped) return null;

  const renderGroup = (group: ChecklistGroup, items: BannerRow[]) => {
    if (items.length === 0) return null;
    const meta = GROUP_META[group];
    return (
      <ChecklistSection
        key={group}
        title={groupTitle(group)}
        badge={<StatusBadge variant={meta.variant}>{meta.code}</StatusBadge>}
        count={items.length}
        rows={items}
        group={group}
        checkedRowIds={checkedRowIds}
        brokenRows={brokenRows}
        onToggleChecked={onToggleChecked}
        onBroken={onBroken}
        notesColumn="notes"
      />
    );
  };

  return (
    <>
      {renderGroup('appear', grouped.appear)}
      {renderGroup('disappear', grouped.disappear)}
      {renderGroup('active', grouped.active)}
    </>
  );
}

export function ChecklistProgress({
  checked,
  total,
}: {
  checked: number;
  total: number;
}) {
  const progressPct = total ? Math.round((checked / total) * 100) : 0;
  return (
    <>
      <div className="grid gap-3 grid-cols-2">
        <div className="panel px-3 py-3 sm:px-4">
          <p className="stat-label">Progress</p>
          <p className="stat-value mt-1">
            {checked} / {total}
          </p>
        </div>
        <div className="panel px-3 py-3 sm:px-4">
          <p className="stat-label">Completion</p>
          <p className="stat-value mt-1">{progressPct}%</p>
        </div>
      </div>
      <div className="panel h-2 overflow-hidden">
        <div
          className="h-full bg-accent transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </>
  );
}
