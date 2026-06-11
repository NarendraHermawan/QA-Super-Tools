import { useState } from 'react';

interface Props {
  tokenName: string;
  cdnUrl: string;
  onRetry: () => void;
}

export function CdnPathDisplay({ tokenName, cdnUrl, onRetry }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(cdnUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-status-ok">
        Uploaded: {tokenName}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <p className="cdn-path flex-1">{cdnUrl}</p>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={handleCopy} className="btn-secondary text-2xs">
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button type="button" onClick={onRetry} className="btn-ghost text-2xs">
            Retry
          </button>
        </div>
      </div>
    </div>
  );
}
