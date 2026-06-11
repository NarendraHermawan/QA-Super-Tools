import { useRef, useState, type DragEvent } from 'react';
import type { SplashAssetType } from '../../types';
import type { RowUploadState } from '../../store/useToolEStore';
import { Spinner } from '../ui/Spinner';
import { CdnPathDisplay } from './CdnPathDisplay';

const ACCEPTED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

interface Props {
  assetType: SplashAssetType;
  uploadState: RowUploadState;
  disabled?: boolean;
  onFileSelected: (file: File) => void;
  onRetry: () => void;
}

function borderClass(state: RowUploadState['state'], dragOver: boolean): string {
  if (dragOver) return 'border-accent bg-accent-muted';
  switch (state) {
    case 'success':
      return 'border-status-ok bg-status-okBg';
    case 'failed':
      return 'border-status-error bg-status-errorBg';
    case 'uploading':
      return 'border-line bg-surface-sunken';
    default:
      return 'border-dashed border-line bg-surface';
  }
}

export function DropZone({
  assetType,
  uploadState,
  disabled = false,
  onFileSelected,
  onRetry,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [toast, setToast] = useState('');

  const label = assetType === 'splash' ? 'splash.png' : 'anno.png';

  const handleFile = (file: File | undefined) => {
    if (!file || disabled) return;
    setToast('');

    if (!ACCEPTED_TYPES.has(file.type)) {
      setToast('Invalid file type — only image files accepted');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setToast('File is larger than 5MB — confirm this is the correct asset');
    }

    onFileSelected(file);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    handleFile(event.dataTransfer.files[0]);
  };

  if (uploadState.state === 'success' && uploadState.cdnUrl && uploadState.tokenName) {
    return (
      <div className={`panel border p-3 ${borderClass('success', false)}`}>
        <CdnPathDisplay
          tokenName={uploadState.tokenName}
          cdnUrl={uploadState.cdnUrl}
          onRetry={onRetry}
        />
      </div>
    );
  }

  if (uploadState.state === 'failed') {
    return (
      <div className={`panel space-y-2 border p-3 ${borderClass('failed', false)}`}>
        <p className="text-sm text-status-error">
          {uploadState.error ?? 'Upload failed'}
        </p>
        <button type="button" onClick={onRetry} className="btn-secondary text-2xs">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click();
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`panel cursor-pointer border p-4 text-center transition-colors ${borderClass(
          uploadState.state,
          dragOver,
        )} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        {uploadState.state === 'uploading' ? (
          <div className="flex items-center justify-center gap-2 text-sm text-ink-secondary">
            <Spinner className="h-4 w-4" />
            Uploading… renaming → sending to CDN
          </div>
        ) : (
          <p className="text-sm text-ink-secondary">
            {dragOver
              ? 'Release to upload'
              : `Drop ${label} here or click Browse`}
          </p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          disabled={disabled}
          onChange={(event) => {
            handleFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          disabled={disabled || uploadState.state === 'uploading'}
          onClick={() => inputRef.current?.click()}
          className="btn-secondary text-2xs"
        >
          Browse
        </button>
      </div>
      {toast && <p className="text-sm text-status-warn">{toast}</p>}
    </div>
  );
}
