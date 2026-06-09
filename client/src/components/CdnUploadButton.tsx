import { useState } from 'react';

interface Props {
  cdnUrl: string | null;
  cdnLink?: string | null;
}

async function fetchCdnOpsUploadUrl(cdnValue: string): Promise<string> {
  const params = new URLSearchParams({ url: cdnValue });
  const response = await fetch(`/api/cdnops-upload-url?${params}`, {
    credentials: 'include',
  });
  if (response.status === 401) {
    window.location.assign(
      `/login?from=${encodeURIComponent(window.location.pathname)}`,
    );
    throw new Error('Authentication required');
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }
  return payload.url as string;
}

export function CdnUploadButton({ cdnUrl, cdnLink }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const cdnValue = cdnUrl ?? cdnLink;
  if (!cdnValue) return null;

  const handleClick = async () => {
    setError('');
    setLoading(true);
    try {
      const uploadUrl = await fetchCdnOpsUploadUrl(cdnValue);
      window.open(uploadUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open CDN upload');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-0.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="btn-ghost text-2xs text-accent-hover disabled:opacity-50"
      >
        {loading ? 'Opening…' : 'Open CDN upload'}
      </button>
      {error && <span className="text-2xs text-status-error">{error}</span>}
    </div>
  );
}
