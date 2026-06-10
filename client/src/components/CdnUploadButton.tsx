import { useState } from 'react';
import { resolveCdnOpsUploadUrl } from '../utils/cdnOpsUpload';

interface Props {
  cdnUrl: string | null;
  cdnLink?: string | null;
}

export function CdnUploadButton({ cdnUrl, cdnLink }: Props) {
  const [error, setError] = useState('');

  const cdnValue = cdnUrl ?? cdnLink;
  if (!cdnValue) return null;

  const handleClick = () => {
    setError('');
    const uploadUrl = resolveCdnOpsUploadUrl(cdnValue);
    if (!uploadUrl) {
      setError('Could not derive CDN upload path');
      return;
    }
    window.open(uploadUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex flex-col items-start gap-0.5">
      <button
        type="button"
        onClick={handleClick}
        className="btn-ghost text-2xs text-accent-hover"
      >
        Open CDN upload
      </button>
      {error && <span className="text-2xs text-status-error">{error}</span>}
    </div>
  );
}
