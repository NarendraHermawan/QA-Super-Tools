import { useState } from 'react';
import type { SplashRecord } from '../../types';
import type { RowUploadState } from '../../store/useToolEStore';
import { CdnHealthIndicator } from '../CdnHealthIndicator';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { StatusBadge } from '../ui/StatusBadge';
import { DropZone } from './DropZone';
import { GoposField } from './GoposField';

interface Props {
  record: SplashRecord;
  uploadState: RowUploadState;
  disabled?: boolean;
  greyedOut?: boolean;
  cdnHealthRefreshToken?: number;
  onFileSelected: (file: File) => void;
  onRetry: () => void;
}

export function UploadRow({
  record,
  uploadState,
  disabled = false,
  greyedOut = false,
  cdnHealthRefreshToken = 0,
  onFileSelected,
  onRetry,
}: Props) {
  const [retryConfirmOpen, setRetryConfirmOpen] = useState(false);
  const noDesc = record.descDisplay.startsWith('—');

  const cdnUrlForHealth =
    uploadState.state === 'success' && uploadState.cdnUrl
      ? uploadState.cdnUrl
      : record.cdnUrl;

  const retryMessage =
    uploadState.state === 'success' && uploadState.tokenName
      ? `Are you sure you want to clear the upload record for "${record.descDisplay}"? The saved CDN path (${uploadState.tokenName}) will be removed and you will need to drop the file again.`
      : `Are you sure you want to clear the upload record for "${record.descDisplay}"? You will need to drop the file again.`;

  return (
    <>
      <article className={`panel p-4 ${greyedOut ? 'opacity-60' : ''}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              {record.sortId !== null && (
                <span className="text-2xs font-medium text-ink-muted">
                  #{record.sortId}
                </span>
              )}
              <h3
                className={`text-sm font-semibold ${
                  noDesc ? 'text-ink-muted' : 'text-ink'
                }`}
              >
                {record.descDisplay}
              </h3>
              <StatusBadge variant={record.assetType === 'splash' ? 'info' : 'neutral'}>
                {record.assetType === 'splash' ? 'Splash' : 'Anno'}
              </StatusBadge>
            </div>
            {record.trelloCard && (
              <a
                href={record.trelloCard}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex text-sm text-accent hover:text-accent-hover"
              >
                Open Notion
              </a>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
          <div className="min-w-0">
            <p className="text-2xs font-medium uppercase tracking-wide text-ink-muted">
              CDN health
            </p>
            <div className="mt-1.5">
              <CdnHealthIndicator
                url={cdnUrlForHealth}
                refreshToken={cdnHealthRefreshToken}
              />
            </div>
          </div>
        </div>

        <div className="mt-4">
          <DropZone
            assetType={record.assetType}
            uploadState={uploadState}
            disabled={disabled}
            onFileSelected={onFileSelected}
            onRetry={() => setRetryConfirmOpen(true)}
          />
        </div>
      </article>

      <ConfirmDialog
        open={retryConfirmOpen}
        title="Clear upload record?"
        message={retryMessage}
        confirmLabel="Clear and retry"
        onConfirm={() => {
          setRetryConfirmOpen(false);
          onRetry();
        }}
        onCancel={() => setRetryConfirmOpen(false)}
      />
    </>
  );
}
